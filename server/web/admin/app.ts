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
interface AdminProduct extends Product {
  archived: boolean;
  orderCount: number;
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

let products: AdminProduct[] = [];

function say(id: string, text: string, ok = true) {
  const node = $(id);
  node.textContent = text;
  node.className = `message ${text ? (ok ? "ok" : "ko") : ""}`.trim();
}

async function loadProducts() {
  products = (await api<{ products: AdminProduct[] }>("/admin/products")).products;
  renderProducts();
  renderImageChoices();
}

/** Les photos déjà utilisées par la boutique (pour les choisir sans retaper d'adresse). */
const knownImages = () => [...new Set(products.map((product) => product.imageUrl).filter((url): url is string => !!url))];
const imageLabel = (url: string) => (url.startsWith("/images/") ? url.replace("/images/", "").replace(/\.\w+$/, "") : url);

function imageSelect(current: string | null) {
  const select = el("select");
  const choices = knownImages();
  if (current && !choices.includes(current)) choices.unshift(current);
  select.append(
    ...choices.map((url) => el("option", { value: url, textContent: imageLabel(url), selected: url === current })),
    el("option", { value: "custom", textContent: "Autre photo (adresse https://…)" }),
  );
  return select;
}

function productRow(product: AdminProduct) {
  const name = el("input", { type: "text", value: product.name, maxLength: 120, minLength: 2 });
  name.setAttribute("aria-label", "Nom du produit");
  const photo = imageSelect(product.imageUrl);
  photo.setAttribute("aria-label", `Photo de ${product.name}`);
  const price = el("input", { type: "number", min: "1", max: "10000000", step: "1", value: String(product.priceCdf) });
  price.setAttribute("aria-label", `Prix de ${product.name} en FC`);
  const stock = el("input", { type: "number", min: "0", max: "1000000", step: "1", value: String(product.stock) });
  stock.setAttribute("aria-label", `Stock de ${product.name}`);
  const image = el("img", { src: product.imageUrl ?? "", alt: "" });
  const save = el("button", { className: "button small", textContent: "Enregistrer", type: "button" });
  const remove = el("button", { className: "button small danger", textContent: "Supprimer", type: "button" });

  // « Autre photo » : on demande l'adresse, et l'aperçu se met à jour.
  photo.addEventListener("change", () => {
    if (photo.value !== "custom") return void (image.src = photo.value);
    const url = prompt("Adresse de la photo (https://…) :")?.trim();
    if (url && url.startsWith("https://")) {
      photo.prepend(el("option", { value: url, textContent: imageLabel(url), selected: true }));
      image.src = url;
    } else {
      photo.value = product.imageUrl ?? "";
      if (url) say("products-message", "La photo doit être une adresse https://…", false);
    }
  });

  save.addEventListener("click", async () => {
    const changes: Record<string, string | number> = {};
    if (name.value.trim() !== product.name) changes.name = name.value.trim();
    if (photo.value && photo.value !== "custom" && photo.value !== product.imageUrl) changes.imageUrl = photo.value;
    if (Number(price.value) !== product.priceCdf) changes.priceCdf = Number(price.value);
    if (Number(stock.value) !== product.stock) changes.stock = Number(stock.value);
    if (Object.keys(changes).length === 0) return say("products-message", `Aucune modification pour « ${product.name} ».`);
    save.disabled = true;
    try {
      const { product: updated } = await api<{ product: Product }>(`/products/${product.id}`, { method: "PATCH", body: changes });
      await loadProducts();
      say("products-message", `« ${updated.name} » enregistré : ${formatCdf(updated.priceCdf)}, stock ${updated.stock}.`);
    } catch (error) {
      say("products-message", (error as Error).message, false);
      save.disabled = false;
    }
  });

  remove.addEventListener("click", async () => {
    const warning =
      product.orderCount > 0
        ? `« ${product.name} » a déjà été commandé ${product.orderCount} fois : il sera retiré de la vente (invisible dans l'app), et les commandes passées resteront intactes. Continuer ?`
        : `Supprimer définitivement « ${product.name} » ? Il n'a jamais été commandé.`;
    if (!confirm(warning)) return;
    try {
      const { message } = await api<{ outcome: string; message: string }>(`/products/${product.id}`, { method: "DELETE" });
      await loadProducts();
      say("products-message", `« ${product.name} » : ${message}`);
    } catch (error) {
      say("products-message", (error as Error).message, false);
    }
  });

  return el(
    "div",
    { className: "row editable" },
    image,
    el("div", { className: "name-cell" }, el("label", {}, "Nom", name), el("label", {}, "Photo", photo)),
    el("label", { className: "price-field" }, "Prix (FC)", price),
    el("label", { className: "stock-field" }, "Stock", stock),
    el("div", { className: "actions" }, save, remove),
  );
}

function archivedRow(product: AdminProduct) {
  const restore = el("button", { className: "button small", textContent: "Remettre en vente", type: "button" });
  restore.addEventListener("click", async () => {
    try {
      await api(`/products/${product.id}/restore`, { method: "POST" });
      await loadProducts();
      say("products-message", `« ${product.name} » est de nouveau en vente.`);
    } catch (error) {
      say("products-message", (error as Error).message, false);
    }
  });
  return el(
    "div",
    { className: "row archived" },
    el("img", { src: product.imageUrl ?? "", alt: "" }),
    el("div", { className: "name-cell" }, el("div", { className: "name", textContent: product.name }), el("div", { className: "sub", textContent: `Retiré de la vente · ${formatCdf(product.priceCdf)} · commandé ${product.orderCount} fois` })),
    restore,
  );
}

function renderProducts() {
  const onSale = products.filter((product) => !product.archived);
  const archived = products.filter((product) => product.archived);
  $("products").replaceChildren(...onSale.map(productRow));
  $("archived-block").hidden = archived.length === 0;
  $("archived").replaceChildren(...archived.map(archivedRow));
}


$("reset-stock").addEventListener("click", async () => {
  if (!confirm("Remettre le stock des 15 pulls de la collection à l'état de départ ? Les commandes ne sont pas touchées.")) return;
  try {
    const { updated, products: fresh } = await api<{ updated: number; products: AdminProduct[] }>("/admin/reset-stock", { method: "POST" });
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
