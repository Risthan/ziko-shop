import { withTransaction, type Db, type DbClient } from "../db/pool.js";
import { AppError, errors } from "../http/errors.js";
import type { CreateOrderInput } from "./orders.schemas.js";

export type OrderStatus = "en_attente" | "payee";

export interface OrderItem {
  productId: string;
  product: { name: string; imageUrl: string | null };
  quantity: number;
  /** Prix figé au moment de la commande. */
  unitPriceCdf: number;
  lineTotalCdf: number;
}

export interface Order {
  id: string;
  /** Les articles, dans l'ordre où le client les a ajoutés. */
  items: OrderItem[];
  /** Nombre total de pièces (somme des quantités). */
  itemCount: number;
  totalCdf: number;
  status: OrderStatus;
  /** Identifiant du paiement qui a réglé la commande (null tant qu'elle n'est pas payée). */
  paymentId: string | null;
  createdAt: string;
  paidAt: string | null;
}

/**
 * Résultat d'un appel de paiement :
 * - "processed"         : ce paiement vient d'être enregistré (une seule fois) ;
 * - "already_processed" : ce même paiement avait déjà été enregistré, rien n'a été refait.
 */
export type PaymentOutcome = "processed" | "already_processed";

interface OrderRow {
  id: string;
  total_cdf: number;
  status: OrderStatus;
  created_at: Date;
  paid_at: Date | null;
  payment_id: string | null;
  user_id: string | null;
  items: OrderItem[];
}

type Queryable = Db | DbClient;

const SELECT_ORDER = `
  SELECT o.id, o.total_cdf, o.status, o.created_at, o.paid_at, o.user_id, pay.id AS payment_id,
         json_agg(
           json_build_object(
             'productId', i.product_id,
             'product', json_build_object('name', p.name, 'imageUrl', p.image_url),
             'quantity', i.quantity,
             'unitPriceCdf', i.unit_price_cdf,
             'lineTotalCdf', i.line_total_cdf
           ) ORDER BY i.position
         ) AS items
  FROM orders o
  JOIN order_items i ON i.order_id = o.id
  JOIN products p ON p.id = i.product_id
  LEFT JOIN payments pay ON pay.order_id = o.id
`;

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    items: row.items,
    itemCount: row.items.reduce((sum, item) => sum + item.quantity, 0),
    totalCdf: row.total_cdf,
    status: row.status,
    paymentId: row.payment_id,
    createdAt: row.created_at.toISOString(),
    paidAt: row.paid_at ? row.paid_at.toISOString() : null,
  };
}

/** La commande et son propriétaire (null : commande passée sans compte, via l'API du sujet). */
async function findOrder(
  db: Queryable,
  where: "o.id" | "o.idempotency_key",
  value: string,
): Promise<{ order: Order; ownerId: string | null } | null> {
  const result = await db.query<OrderRow>(`${SELECT_ORDER} WHERE ${where} = $1 GROUP BY o.id, pay.id`, [value]);
  const row = result.rows[0];
  return row ? { order: toOrder(row), ownerId: row.user_id } : null;
}

/**
 * Une commande rattachée à un compte n'est visible (et payable) que par son
 * propriétaire. Pour les autres, elle « n'existe pas » : on ne révèle rien.
 */
function assertVisible(ownerId: string | null, requesterId: string | null): void {
  if (ownerId !== null && ownerId !== requesterId) throw errors.orderNotFound();
}

/** L'historique d'un client : ses commandes, les plus récentes d'abord. */
export async function listOrdersForUser(db: Db, userId: string, limit = 50): Promise<Order[]> {
  const result = await db.query<OrderRow>(
    `${SELECT_ORDER} WHERE o.user_id = $1 GROUP BY o.id, pay.id ORDER BY o.created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return result.rows.map(toOrder);
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "23505" &&
    (error as { constraint?: unknown }).constraint === constraint
  );
}

export async function getOrder(db: Db, id: string, requesterId: string | null = null): Promise<Order> {
  const found = await findOrder(db, "o.id", id);
  if (!found) throw errors.orderNotFound();
  assertVisible(found.ownerId, requesterId);
  return found.order;
}

/**
 * Crée une commande « en attente » pour un ou plusieurs articles. Le stock de
 * chaque article est vérifié mais pas encore décompté : il ne diminue qu'au
 * paiement.
 *
 * Si l'app envoie une clé d'idempotence, renvoyer la même requête (réseau
 * coupé pendant la création) rend la commande déjà créée au lieu d'en créer
 * une seconde.
 *
 * `userId` : le client connecté (la commande lui est rattachée), ou null
 * pour une commande passée sans compte via l'API.
 */
export async function createOrder(
  db: Db,
  input: CreateOrderInput,
  idempotencyKey?: string,
  userId: string | null = null,
): Promise<{ order: Order; replayed: boolean }> {
  if (idempotencyKey) {
    const existing = await findOrder(db, "o.idempotency_key", idempotencyKey);
    if (existing) return { order: assertSameOrder(existing, input, userId), replayed: true };
  }

  const ids = input.items.map((item) => item.productId);
  const found = await db.query<{ id: string; name: string; price_cdf: number; stock: number }>(
    "SELECT id, name, price_cdf, stock FROM products WHERE id = ANY($1::uuid[])",
    [ids],
  );
  const products = new Map(found.rows.map((row) => [row.id, row]));
  const lines = input.items.map((item) => {
    const product = products.get(item.productId);
    if (!product) throw errors.productNotFound(item.productId);
    if (product.stock < item.quantity) throw errors.insufficientStock(product.stock, item.quantity, product);
    return { ...item, unitPriceCdf: product.price_cdf, lineTotalCdf: product.price_cdf * item.quantity };
  });
  const totalCdf = lines.reduce((sum, line) => sum + line.lineTotalCdf, 0);

  try {
    // La commande et ses lignes sont enregistrées ensemble, ou pas du tout.
    const orderId = await withTransaction(db, async (client) => {
      const inserted = await client.query<{ id: string }>(
        "INSERT INTO orders (total_cdf, idempotency_key, user_id) VALUES ($1, $2, $3) RETURNING id",
        [totalCdf, idempotencyKey ?? null, userId],
      );
      const id = inserted.rows[0]!.id;
      await client.query(
        `INSERT INTO order_items (order_id, product_id, position, quantity, unit_price_cdf, line_total_cdf)
         SELECT $1, line.product_id, line.position - 1, line.quantity, line.unit_price_cdf, line.line_total_cdf
         FROM unnest($2::uuid[], $3::int[], $4::int[], $5::int[])
              WITH ORDINALITY AS line(product_id, quantity, unit_price_cdf, line_total_cdf, position)`,
        [
          id,
          lines.map((line) => line.productId),
          lines.map((line) => line.quantity),
          lines.map((line) => line.unitPriceCdf),
          lines.map((line) => line.lineTotalCdf),
        ],
      );
      return id;
    });
    return { order: await getOrder(db, orderId, userId), replayed: false };
  } catch (error) {
    // Deux envois simultanés avec la même clé : le second récupère la commande du premier.
    if (idempotencyKey && isUniqueViolation(error, "orders_idempotency_key_key")) {
      const existing = await findOrder(db, "o.idempotency_key", idempotencyKey);
      if (existing) return { order: assertSameOrder(existing, input, userId), replayed: true };
    }
    throw error;
  }
}

function assertSameOrder({ order, ownerId }: { order: Order; ownerId: string | null }, input: CreateOrderInput, userId: string | null): Order {
  const same =
    ownerId === userId &&
    order.items.length === input.items.length &&
    order.items.every((item, index) => item.productId === input.items[index]!.productId && item.quantity === input.items[index]!.quantity);
  if (!same) {
    throw new AppError(
      422,
      "IDEMPOTENCY_KEY_REUSED",
      "Cette clé d'idempotence a déjà servi pour une autre commande.",
    );
  }
  return order;
}

/**
 * Paie une commande avec l'identifiant de paiement fourni par l'opérateur.
 *
 * Garantie : une commande n'est payée qu'une seule fois et un identifiant de
 * paiement n'est utilisé qu'une seule fois, même si l'app renvoie la requête
 * (réseau coupé) ou si plusieurs requêtes arrivent en même temps.
 *
 * Comment :
 * 1. `SELECT … FOR UPDATE` verrouille la ligne de la commande. Les requêtes
 *    concurrentes sur la même commande attendent leur tour.
 * 2. Une fois le verrou obtenu, on relit le statut : si la commande est déjà
 *    payée, on ne débite rien et on dit pourquoi.
 * 3. On verrouille les produits de la commande, TOUJOURS dans le même ordre
 *    (par identifiant) : deux paniers qui partagent des produits ne peuvent pas
 *    se bloquer mutuellement.
 * 4. Dans la MÊME transaction : on décompte le stock de chaque article, on
 *    enregistre le paiement et on passe la commande à « payée ». Tout ou rien :
 *    s'il manque une seule pièce, rien n'est débité.
 * 5. Filet de sécurité : la base refuse un même identifiant de paiement deux
 *    fois (clé primaire), un second paiement pour une commande (UNIQUE) et un
 *    stock négatif (CHECK).
 */
export async function payOrder(
  db: Db,
  orderId: string,
  paymentId: string,
  requesterId: string | null = null,
): Promise<{ order: Order; outcome: PaymentOutcome }> {
  try {
    return await withTransaction(db, async (client) => {
      const locked = await client.query<{ total_cdf: number; status: OrderStatus; user_id: string | null }>(
        "SELECT total_cdf, status, user_id FROM orders WHERE id = $1 FOR UPDATE",
        [orderId],
      );
      const order = locked.rows[0];
      if (!order) throw errors.orderNotFound();
      // Personne ne peut payer (ni voir) la commande d'un autre client.
      assertVisible(order.user_id, requesterId);

      if (order.status === "payee") {
        const current = (await findOrder(client, "o.id", orderId))!.order;
        if (current.paymentId === paymentId) {
          // Même paiement renvoyé (ex. : réponse perdue) : on confirme sans rien refaire.
          return { order: current, outcome: "already_processed" as const };
        }
        throw new AppError(
          409,
          "ORDER_ALREADY_PAID",
          "Cette commande est déjà payée. Aucun nouveau débit n'a été effectué.",
          { order: current },
        );
      }

      const reused = await client.query<{ order_id: string }>("SELECT order_id FROM payments WHERE id = $1", [paymentId]);
      if (reused.rows[0]) {
        throw new AppError(
          409,
          "PAYMENT_ID_ALREADY_USED",
          "Cet identifiant de paiement a déjà servi pour une autre commande. Aucun débit n'a été effectué.",
        );
      }

      const stock = await client.query<{ id: string; name: string; stock: number; quantity: number }>(
        `SELECT p.id, p.name, p.stock, i.quantity
         FROM products p
         JOIN order_items i ON i.product_id = p.id AND i.order_id = $1
         ORDER BY p.id
         FOR UPDATE OF p`,
        [orderId],
      );
      for (const line of stock.rows) {
        if (line.stock < line.quantity) throw errors.insufficientStock(line.stock, line.quantity, line);
      }

      await client.query(
        `UPDATE products p SET stock = p.stock - i.quantity
         FROM order_items i
         WHERE i.order_id = $1 AND p.id = i.product_id`,
        [orderId],
      );
      await client.query("INSERT INTO payments (id, order_id, amount_cdf) VALUES ($1, $2, $3)", [
        paymentId,
        orderId,
        order.total_cdf,
      ]);
      await client.query("UPDATE orders SET status = 'payee', paid_at = now() WHERE id = $1", [orderId]);

      return { order: (await findOrder(client, "o.id", orderId))!.order, outcome: "processed" as const };
    });
  } catch (error) {
    // Le même identifiant envoyé en même temps pour deux commandes différentes :
    // la base a refusé le second, et toute sa transaction a été annulée.
    if (isUniqueViolation(error, "payments_pkey")) {
      throw new AppError(
        409,
        "PAYMENT_ID_ALREADY_USED",
        "Cet identifiant de paiement a déjà servi pour une autre commande. Aucun débit n'a été effectué.",
      );
    }
    throw error;
  }
}
