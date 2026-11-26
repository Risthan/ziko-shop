import { withTransaction, type Db, type DbClient } from "../db/pool.js";
import { AppError, errors } from "../http/errors.js";
import type { CreateOrderInput } from "./orders.schemas.js";

export type OrderStatus = "en_attente" | "payee";

export interface Order {
  id: string;
  productId: string;
  product: { name: string; imageUrl: string | null };
  quantity: number;
  unitPriceCdf: number;
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
  product_id: string;
  quantity: number;
  unit_price_cdf: number;
  total_cdf: number;
  status: OrderStatus;
  created_at: Date;
  paid_at: Date | null;
  product_name: string;
  product_image_url: string | null;
  payment_id: string | null;
}

type Queryable = Db | DbClient;

const SELECT_ORDER = `
  SELECT o.id, o.product_id, o.quantity, o.unit_price_cdf, o.total_cdf, o.status,
         o.created_at, o.paid_at,
         p.name AS product_name, p.image_url AS product_image_url,
         pay.id AS payment_id
  FROM orders o
  JOIN products p ON p.id = o.product_id
  LEFT JOIN payments pay ON pay.order_id = o.id
`;

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    productId: row.product_id,
    product: { name: row.product_name, imageUrl: row.product_image_url },
    quantity: row.quantity,
    unitPriceCdf: row.unit_price_cdf,
    totalCdf: row.total_cdf,
    status: row.status,
    paymentId: row.payment_id,
    createdAt: row.created_at.toISOString(),
    paidAt: row.paid_at ? row.paid_at.toISOString() : null,
  };
}

async function findOrder(db: Queryable, where: "o.id" | "o.idempotency_key", value: string): Promise<Order | null> {
  const result = await db.query<OrderRow>(`${SELECT_ORDER} WHERE ${where} = $1`, [value]);
  const row = result.rows[0];
  return row ? toOrder(row) : null;
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "23505" &&
    (error as { constraint?: unknown }).constraint === constraint
  );
}

export async function getOrder(db: Db, id: string): Promise<Order> {
  const order = await findOrder(db, "o.id", id);
  if (!order) throw errors.orderNotFound();
  return order;
}

/**
 * Crée une commande « en attente ». Le stock est vérifié mais pas encore
 * décompté : il ne diminue qu'au paiement.
 *
 * Si l'app envoie une clé d'idempotence, renvoyer la même requête (réseau
 * coupé pendant la création) rend la commande déjà créée au lieu d'en créer
 * une seconde.
 */
export async function createOrder(
  db: Db,
  input: CreateOrderInput,
  idempotencyKey?: string,
): Promise<{ order: Order; replayed: boolean }> {
  if (idempotencyKey) {
    const existing = await findOrder(db, "o.idempotency_key", idempotencyKey);
    if (existing) return { order: assertSameOrder(existing, input), replayed: true };
  }

  const product = await db.query<{ price_cdf: number; stock: number }>(
    "SELECT price_cdf, stock FROM products WHERE id = $1",
    [input.productId],
  );
  const row = product.rows[0];
  if (!row) throw errors.productNotFound();
  if (row.stock < input.quantity) throw errors.insufficientStock(row.stock, input.quantity);

  try {
    const inserted = await db.query<{ id: string }>(
      `INSERT INTO orders (product_id, quantity, unit_price_cdf, total_cdf, idempotency_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [input.productId, input.quantity, row.price_cdf, row.price_cdf * input.quantity, idempotencyKey ?? null],
    );
    return { order: await getOrder(db, inserted.rows[0]!.id), replayed: false };
  } catch (error) {
    // Deux envois simultanés avec la même clé : le second récupère la commande du premier.
    if (idempotencyKey && isUniqueViolation(error, "orders_idempotency_key_key")) {
      const existing = await findOrder(db, "o.idempotency_key", idempotencyKey);
      if (existing) return { order: assertSameOrder(existing, input), replayed: true };
    }
    throw error;
  }
}

function assertSameOrder(order: Order, input: CreateOrderInput): Order {
  if (order.productId !== input.productId || order.quantity !== input.quantity) {
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
 * 3. Sinon, dans la MÊME transaction : on décompte le stock, on enregistre le
 *    paiement et on passe la commande à « payée ». Tout ou rien.
 * 4. Filet de sécurité : la base refuse un même identifiant de paiement deux
 *    fois (clé primaire) et un second paiement pour une commande (UNIQUE).
 */
export async function payOrder(
  db: Db,
  orderId: string,
  paymentId: string,
): Promise<{ order: Order; outcome: PaymentOutcome }> {
  try {
    return await withTransaction(db, async (client) => {
      const locked = await client.query<{ product_id: string; quantity: number; total_cdf: number; status: OrderStatus }>(
        "SELECT product_id, quantity, total_cdf, status FROM orders WHERE id = $1 FOR UPDATE",
        [orderId],
      );
      const order = locked.rows[0];
      if (!order) throw errors.orderNotFound();

      if (order.status === "payee") {
        const current = (await findOrder(client, "o.id", orderId))!;
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

      const product = await client.query<{ stock: number }>(
        "SELECT stock FROM products WHERE id = $1 FOR UPDATE",
        [order.product_id],
      );
      const stock = product.rows[0]!.stock;
      if (stock < order.quantity) throw errors.insufficientStock(stock, order.quantity);

      await client.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [order.quantity, order.product_id]);
      await client.query("INSERT INTO payments (id, order_id, amount_cdf) VALUES ($1, $2, $3)", [
        paymentId,
        orderId,
        order.total_cdf,
      ]);
      await client.query("UPDATE orders SET status = 'payee', paid_at = now() WHERE id = $1", [orderId]);

      return { order: (await findOrder(client, "o.id", orderId))!, outcome: "processed" as const };
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
