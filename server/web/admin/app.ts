// Script de la page /admin. Compilé par esbuild vers public/admin/app.js.
// Toutes les données sont insérées avec textContent : aucun HTML venant de
// la base n'est interprété (pas d'injection possible dans la page).

interface Product {
  id: string;
  name: string;
  priceCdf: number;
  stock: number;
  imageUrl: string | null;
}
interface Summary {
  totals: { orders: number; paid: number; revenue: number; customers: number };
  recentOrders: { id: string; totalCdf: number; status: "payee" | "en_attente"; createdAt: string; pieces: number; customer: string | null }[];
}

const KEY_STORAGE = "ziko-admin-key";
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const formatCdf = (value: number) => `${new Intl.NumberFormat("fr-FR").format(value).replace(/\s/g, " ")} FC`;
const reference = (id: string) => `ZK-${id.slice(0, 8).toUpperCase()}`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

/** La clé reste dans l'onglet (sessionStorage) : fermer l'onglet déconnecte. */
const adminKey = {
  get: () => sessionStorage.getItem(KEY_STORAGE),
  set: (key: string) => sessionStorage.setItem(KEY_STORAGE, key),
  clear: () => sessionStorage.removeItem(KEY_STORAGE),
};

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function api<T>(path: string, init: { method?: string; body?: unknown; key?: string } = {}): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", "X-Admin-Key": init.key ?? adminKey.get() ?? "" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!response.ok) {
    if (response.status === 401) {
      adminKey.clear();
      showLogin("Clé refusée ou expirée. Reconnectez-vous.");
    }
    throw new ApiError(payload.error?.message ?? `Erreur du serveur (${response.status}).`, response.status);
  }
  return payload as T;
}

// --- Connexion -------------------------------------------------------------

function showLogin(error = "") {
  $("login").hidden = false;
  $("dashboard").hidden = true;
  $("logout").hidden = true;
  $("login-error").textContent = error;
}

async function showDashboard() {
  $("login").hidden = true;
  $("dashboard").hidden = false;
  $("logout").hidden = false;
  await Promise.all([loadProducts(), loadSummary()]);
}

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const key = $<HTMLInputElement>("key").value.trim();
  $("login-error").textContent = "";
  try {
    await api("/admin/session", { key });
    adminKey.set(key);
    $<HTMLInputElement>("key").value = "";
    await showDashboard();
  } catch (error) {
    $("login-error").textContent = error instanceof ApiError && error.status === 401 ? "Clé d'administration incorrecte." : (error as Error).message;
  }
});

$("logout").addEventListener("click", () => {
  adminKey.clear();
  showLogin();
});

// --- Produits ---------------------------------------------------------------

let products: Product[] = [];

function say(id: string, text: string, ok = true) {
  const node = $(id);
  node.textContent = text;
  node.className = `message ${text ? (ok ? "ok" : "ko") : ""}`.trim();
}

async function loadProducts() {
  products = (await api<{ products: Product[] }>("/products")).products;
  renderProducts();
  renderImageChoices();
}

function renderProducts() {
  $("products").replaceChildren(
    ...products.map((product) => {
      const price = el("input", { type: "number", min: "1", max: "10000000", step: "1", value: String(product.priceCdf) });
      price.setAttribute("aria-label", `Prix de ${product.name} en FC`);
      const stock = el("input", { type: "number", min: "0", max: "1000000", step: "1", value: String(product.stock) });
      stock.setAttribute("aria-label", `Stock de ${product.name}`);
      const save = el("button", { className: "button small save", textContent: "Enregistrer", type: "button" });

      save.addEventListener("click", async () => {
        const changes: Partial<Product> = {};
        if (Number(price.value) !== product.priceCdf) changes.priceCdf = Number(price.value);
        if (Number(stock.value) !== product.stock) changes.stock = Number(stock.value);
        if (Object.keys(changes).length === 0) return say("products-message", `Aucune modification pour « ${product.name} ».`);
        save.disabled = true;
        try {
          const { product: updated } = await api<{ product: Product }>(`/products/${product.id}`, { method: "PATCH", body: changes });
          products = products.map((item) => (item.id === updated.id ? updated : item));
          renderProducts();
          say("products-message", `« ${updated.name} » enregistré : ${formatCdf(updated.priceCdf)}, stock ${updated.stock}.`);
        } catch (error) {
          say("products-message", (error as Error).message, false);
          save.disabled = false;
        }
      });

      const image = el("img", { src: product.imageUrl ?? "", alt: "" });
      return el(
        "div",
        { className: "row" },
        image,
        el("div", { className: "name-cell" }, el("div", { className: "name", textContent: product.name }), el("div", { className: `sub ${product.stock <= 3 ? "low" : ""}`, textContent: `${formatCdf(product.priceCdf)} · stock ${product.stock}` })),
        el("label", { className: "price-field" }, "Prix (FC)", price),
        el("label", { className: "stock-field" }, "Stock", stock),
        save,
      );
    }),
  );
}

$("reset-stock").addEventListener("click", async () => {
  if (!confirm("Remettre le stock des 9 pulls à l'état de départ (12, 9, 6, 10, 4, 7, 5, 3, 2) ? Les commandes ne sont pas touchées.")) return;
  try {
    const { updated, products: fresh } = await api<{ updated: number; products: Product[] }>("/admin/reset-stock", { method: "POST" });
    products = fresh;
    renderProducts();
    say("products-message", `Stock remis à l'état de départ (${updated} produits).`);
  } catch (error) {
    say("products-message", (error as Error).message, false);
  }
});

// --- Ajouter un produit -----------------------------------------------------

function renderImageChoices() {
  const select = $<HTMLSelectElement>("image-select");
  const paths = [...new Set(products.map((product) => product.imageUrl).filter((url): url is string => !!url))];
  select.replaceChildren(
    ...paths.map((url) => el("option", { value: url, textContent: url.replace("/images/", "Photo existante : ") })),
    el("option", { value: "custom", textContent: "Autre photo (adresse https://…)" }),
  );
}

$("image-select").addEventListener("change", () => {
  $("custom-image").hidden = $<HTMLSelectElement>("image-select").value !== "custom";
});

$("create-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.target as HTMLFormElement);
  const choice = String(form.get("imageUrl"));
  const imageUrl = choice === "custom" ? String(form.get("customImage") ?? "").trim() : choice;
  try {
    const { product } = await api<{ product: Product }>("/products", {
      method: "POST",
      body: {
        name: String(form.get("name")).trim(),
        priceCdf: Number(form.get("priceCdf")),
        stock: Number(form.get("stock")),
        ...(imageUrl ? { imageUrl } : {}),
      },
    });
    (event.target as HTMLFormElement).reset();
    $("custom-image").hidden = true;
    say("create-message", `« ${product.name} » ajouté. Il apparaît tout de suite dans l'app.`);
    await loadProducts();
  } catch (error) {
    say("create-message", (error as Error).message, false);
  }
});

// --- Chiffres et dernières commandes ----------------------------------------

async function loadSummary() {
  const { totals, recentOrders } = await api<Summary>("/admin/summary");
  const stat = (value: string, label: string) => el("div", { className: "stat" }, el("strong", { textContent: value }), el("span", { textContent: label }));
  $("stats").replaceChildren(
    stat(String(totals.orders), "Commandes"),
    stat(String(totals.paid), "Payées"),
    stat(formatCdf(totals.revenue), "Chiffre d'affaires"),
    stat(String(totals.customers), "Comptes clients"),
  );
  $("orders").replaceChildren(
    ...(recentOrders.length === 0
      ? [el("p", { className: "muted", textContent: "Aucune commande pour le moment." })]
      : recentOrders.map((order) =>
          el(
            "div",
            { className: "row order" },
            el("div", {}, el("div", { className: "name", textContent: reference(order.id) }), el("div", { className: "sub", textContent: new Date(order.createdAt).toLocaleString("fr-FR") })),
            el("div", { textContent: `${order.customer ?? "Invité (API)"} · ${order.pieces} pièce${order.pieces > 1 ? "s" : ""}` }),
            el("strong", { textContent: formatCdf(order.totalCdf) }),
            el("span", { className: `badge ${order.status}`, textContent: order.status === "payee" ? "Payée" : "En attente" }),
          ),
        )),
  );
}

// --- Démarrage ---------------------------------------------------------------

if (adminKey.get()) {
  showDashboard().catch(() => showLogin());
} else {
  showLogin();
}
