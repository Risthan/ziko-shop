// Script de la page /essayage (navigateur ou WebView de l'app).
// Compilé par esbuild vers public/essayage/app.js.
//
// Essayage en direct avec iKawn Mirror (capacité « tryon ») : la caméra part
// en WebRTC vers le service, qui renvoie la vidéo où le client porte le pull.
// Le SDK officiel est chargé depuis iKawn (mis en cache par le navigateur).
import { createMirrorClient, prepareMirrorRuntime, type MirrorLive } from "https://api.ikawn.com/sdk/mirror.js";

interface Product {
  id: string;
  name: string;
  imageUrl: string | null;
}

const COLORS: Record<string, string> = { noir: "#141414", creme: "#E8E0D2", moka: "#4E3629" };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const output = $<HTMLVideoElement>("output");
const garment = $<HTMLImageElement>("garment");
const overlay = $<HTMLDivElement>("overlay");
const overlayText = $<HTMLParagraphElement>("overlay-text");
const live = $<HTMLSpanElement>("live");
const timer = $<HTMLSpanElement>("timer");
const message = $<HTMLParagraphElement>("message");
const productLine = $<HTMLParagraphElement>("product-line");
const swatches = $<HTMLDivElement>("swatches");
const startButton = $<HTMLButtonElement>("start");
const stopButton = $<HTMLButtonElement>("stop");

/**
 * Mode « intégré » (?embed=1) : la page est affichée DANS l'app mobile
 * (WebView). Plein écran, lancement automatique, et l'app est informée de
 * l'état de la séance pour afficher ses propres indicateurs.
 */
const embedded = new URLSearchParams(location.search).get("embed") === "1";
if (embedded) document.body.classList.add("embed");

type TryOnStatus = "loading" | "ready" | "live" | "ended" | "error";
function notify(status: TryOnStatus, text?: string) {
  const payload = JSON.stringify({ source: "ziko-tryon", status, message: text });
  const bridge = (window as unknown as { ReactNativeWebView?: { postMessage(data: string): void } }).ReactNativeWebView;
  if (bridge) bridge.postMessage(payload);
  else if (window.parent !== window) window.parent.postMessage(payload, "*");
}

let products: Product[] = [];
let current: Product | null = null;
let maxSessionSeconds = 30;
let camera: MediaStream | null = null;
let session: MirrorLive | null = null;
let countdown: number | undefined;
/** Une seule mise à jour du vêtement à la fois (recommandation iKawn). */
let pendingUpdate: Promise<unknown> = Promise.resolve();
/** Un seul message d'erreur par séance : la première cause connue. */
let failureShown = false;
/**
 * Service occupé (le compte n'accepte qu'une séance active à la fois) : on
 * réessaie un peu plus tard, caméra allumée, au plus MAX_BUSY_RETRIES fois.
 * Une séance refusée n'est pas facturée.
 */
const MAX_BUSY_RETRIES = 2;
const BUSY_RETRY_DELAY_MS = 8_000;
let busyRetries = 0;
let retryTimer: number | undefined;

// Prépare le moteur du SDK dès l'ouverture : ne crée ni ne facture aucune séance.
const runtimeReady = prepareMirrorRuntime();

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

function split(name: string) {
  const [model = name, color = ""] = name.split(/\s+[—–-]\s+/, 2);
  return { model: model.trim(), color: color.trim() };
}

function say(text: string, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
  if (isError) notify("error", text);
}

function fail(text: string) {
  if (failureShown) return;
  failureShown = true;
  stop();
  say(text, true);
}

/**
 * Photo du pull, sous forme de fichier pour le SDK. Le même objet est
 * réutilisé pour un même pull : iKawn ne le renvoie pas une seconde fois.
 */
const garmentFiles = new Map<string, Promise<File>>();
function garmentFile(product: Product): Promise<File> {
  let file = garmentFiles.get(product.id);
  if (!file) {
    file = fetch(product.imageUrl ?? "")
      .then((response) => {
        if (!response.ok) throw new Error("Photo du pull introuvable.");
        return response.blob();
      })
      .then((blob) => new File([blob], `${product.id}.jpg`, { type: blob.type || "image/jpeg" }));
    file.catch(() => garmentFiles.delete(product.id));
    garmentFiles.set(product.id, file);
  }
  return file;
}

/** Traduit une erreur en message clair pour le client. */
function explain(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string } | null)?.code ?? "";
  if (/indisponible|activé|Patientez|autre client/i.test(text)) return text; // messages de notre API, déjà clairs
  if (!navigator.onLine || code === "NETWORK_ERROR") return "Connexion internet perdue. Vérifiez votre réseau, puis relancez.";
  if (code === "SESSION_TERMINAL" || code === "DISCONNECTED") return "La séance d'essayage s'est terminée.";
  return "Le service d'essayage ne répond pas pour le moment.";
}

/** Notre serveur crée la séance chez iKawn : la clé ne vient jamais ici. */
function sessionProvider(requestKey: string) {
  return async ({ capability }: { capability: string }) => {
    const response = await fetch("/try-on/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey },
      body: JSON.stringify({ capability }),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    if (!response.ok) {
      const error = new Error(body?.error?.message ?? "Le service d'essayage est indisponible.") as Error & { code?: string };
      error.code = body?.error?.code;
      throw error;
    }
    return body as Record<string, unknown>;
  };
}

function showProduct(product: Product) {
  current = product;
  const { model, color } = split(product.name);
  productLine.textContent = color ? `${model} · ${color}` : model;
  if (product.imageUrl) {
    garment.src = product.imageUrl;
    garment.alt = product.name;
    garment.hidden = session !== null;
  }
  const variants = products.filter((item) => split(item.name).model === model);
  swatches.replaceChildren(
    ...variants.map((variant) => {
      const variantColor = split(variant.name).color;
      const button = document.createElement("button");
      button.className = "swatch";
      button.type = "button";
      button.setAttribute("aria-label", `Couleur ${variantColor}`);
      button.setAttribute("aria-pressed", String(variant.id === product.id));
      const dot = document.createElement("span");
      dot.style.background = COLORS[normalize(variantColor)] ?? "#ccc";
      button.append(dot);
      button.addEventListener("click", () => void select(variant.id));
      return button;
    }),
  );
}

/**
 * Changer de pull PENDANT la séance : on envoie la nouvelle photo au service
 * (live.set), sans couper la vidéo ni reconnecter.
 */
async function select(productId: string) {
  const product = products.find((item) => item.id === productId);
  if (!product || product.id === current?.id) return;
  showProduct(product);
  void garmentFile(product); // téléchargement anticipé
  if (!session) return;
  const target = session;
  pendingUpdate = pendingUpdate
    .catch(() => undefined)
    .then(async () => target.set({ referenceImage: await garmentFile(product) }))
    .catch(() => say("Impossible de changer de pull pour l'instant.", true));
  await pendingUpdate;
}

async function start(automatic = false) {
  if (!current || session) return;
  startButton.disabled = true;
  failureShown = false;
  if (!automatic) busyRetries = 0;
  say("Connexion à la caméra…");
  notify("ready");

  if (!camera) {
    try {
      camera = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
    } catch (error) {
      startButton.disabled = false;
      const name = error instanceof DOMException ? error.name : "";
      say(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Accès à la caméra refusé. Autorisez la caméra pour Ziko Shop, puis relancez."
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "Aucune caméra frontale disponible sur cet appareil."
            : "Impossible d'ouvrir la caméra. Fermez les autres apps qui l'utilisent, puis relancez.",
        true,
      );
      return;
    }
  }

  // Le client se voit tout de suite pendant que la séance s'ouvre.
  output.autoplay = true;
  output.playsInline = true;
  output.muted = true;
  output.srcObject = camera;
  output.classList.add("preview");
  void output.play().catch(() => undefined);
  garment.hidden = true;
  overlay.hidden = false;
  overlayText.textContent = "Préparation de l'essayage… Reculez d'un pas pour que tout le pull soit visible.";
  say("");

  try {
    await runtimeReady;
    const reference = await garmentFile(current);
    // Une clé par tentative de connexion : un renvoi réseau ne crée pas de seconde séance.
    const mirror = createMirrorClient({
      sessionProvider: sessionProvider(crypto.randomUUID()),
      onError: (error) => {
        console.warn("[essayage] iKawn :", error.code ?? "", error.message); // diagnostic, sans donnée personnelle
        fail(explain(error));
      },
    });
    const stream = camera;
    if (!stream) return;
    session = await mirror.connect(stream, {
      capability: "tryon",
      referenceImage: reference,
      // Pas de consigne : iKawn remplace seulement le vêtement par celui de la photo.
      onRemoteStream: (remote) => {
        output.srcObject = remote;
        output.classList.remove("preview");
        void output.play().catch(() => say("Touchez la vidéo pour la lancer."));
        overlay.hidden = true;
        live.hidden = false;
        busyRetries = 0;
        say("");
        notify("live");
        // Une reconnexion peut republier la vidéo : le compte à rebours ne repart pas de zéro.
        if (countdown === undefined) startCountdown(maxSessionSeconds);
      },
    });
    stopButton.hidden = false;
    startButton.hidden = true;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "TRYON_BUSY" && busyRetries < MAX_BUSY_RETRIES) return retryLater();
    fail(explain(error));
  }
}

/** Service occupé : nouvelle tentative dans quelques secondes, caméra allumée. */
function retryLater() {
  busyRetries += 1;
  session = null;
  overlay.hidden = false;
  overlayText.textContent = "Le service d'essayage est très demandé. Nouvelle tentative dans quelques secondes…";
  window.clearTimeout(retryTimer);
  retryTimer = window.setTimeout(() => void start(true), BUSY_RETRY_DELAY_MS);
}

function startCountdown(seconds: number) {
  window.clearInterval(countdown);
  let left = seconds;
  timer.hidden = false;
  const render = () => (timer.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`);
  render();
  countdown = window.setInterval(() => {
    left -= 1;
    render();
    if (left <= 0) {
      stop();
      say("Séance terminée. Vous pouvez relancer un essayage.");
      notify("ended");
    }
  }, 1000);
}

/** Arrête la séance iKawn (fin de facturation) et la caméra. */
function stop() {
  window.clearInterval(countdown);
  countdown = undefined;
  window.clearTimeout(retryTimer);
  const closing = session;
  session = null;
  void closing?.disconnect().catch(() => undefined);
  camera?.getTracks().forEach((track) => track.stop());
  camera = null;
  output.srcObject = null;
  output.classList.remove("preview");
  garment.hidden = !current?.imageUrl;
  overlay.hidden = false;
  overlayText.textContent = "Placez-vous face à la caméra, le haut du corps bien visible.";
  live.hidden = true;
  timer.hidden = true;
  stopButton.hidden = true;
  startButton.hidden = false;
  startButton.disabled = false;
}

type TryOnConfig = { mode: "ikawn"; maxSessionSeconds: number } | { mode: "off" };

async function init() {
  const productId = new URLSearchParams(location.search).get("produit");
  try {
    const [productsResponse, configResponse] = await Promise.all([fetch("/products"), fetch("/try-on/config")]);
    if (!productsResponse.ok || !configResponse.ok) throw new Error();
    products = ((await productsResponse.json()) as { products: Product[] }).products;
    const config = (await configResponse.json()) as TryOnConfig;
    const product = products.find((item) => item.id === productId) ?? products[0];
    if (!product) throw new Error();
    showProduct(product);

    if (config.mode !== "ikawn") {
      say("L'essayage en direct n'est pas encore activé sur cette boutique.", true);
      return;
    }
    maxSessionSeconds = config.maxSessionSeconds;
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      say("Cet appareil ne permet pas l'essayage vidéo en direct.", true);
      return;
    }
    void garmentFile(product); // la photo est prête avant le lancement
    startButton.disabled = false;
    notify("ready");
    if (embedded) void start(); // dans l'app : lancement automatique, sans bouton à toucher
  } catch {
    productLine.textContent = "Produit introuvable.";
    say("Impossible de charger le produit. Vérifiez votre connexion et réessayez.", true);
  }
}

// Commandes envoyées par l'app (WebView) : changer de pull, arrêter, relancer.
(window as unknown as { zikoTryOn: unknown }).zikoTryOn = {
  select: (id: string) => void select(id),
  stop: () => stop(),
  start: () => void start(),
};

startButton.addEventListener("click", () => void start());
stopButton.addEventListener("click", () => {
  stop();
  notify("ended");
});
// Quitter la page (ou l'onglet Essayage de l'app) arrête la séance : elle n'est plus facturée.
window.addEventListener("pagehide", stop);
window.addEventListener("offline", () => {
  if (session) say("Connexion internet perdue. L'essayage reprendra si le réseau revient vite.");
});
window.addEventListener("online", () => {
  if (session) say("");
});
void init();
