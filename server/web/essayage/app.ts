// Script de la page /essayage (navigateur ou WebView de l'app).
// Compilé par esbuild vers public/essayage/app.js.
//
// Essayage en direct avec Fal.ai, modèle Lucy VTON Realtime :
// la caméra part en WebRTC vers le modèle, qui renvoie la vidéo où le client
// porte le pull choisi. Le SDK officiel gère la signalisation et le WebRTC.
import { fal } from "@fal-ai/client";
import { lucyRealtime } from "@fal-ai/client/realtime/lucy";

const ENDPOINT = "decart/lucy2-vton/realtime";

interface Product {
  id: string;
  name: string;
  imageUrl: string | null;
}

interface GarmentInput extends Record<string, unknown> {
  prompt: string;
  reference_image_url: string;
}

const MODEL_DESCRIPTIONS: Record<string, string> = {
  "Le Classique": "crewneck sweatshirt in heavyweight brushed cotton fleece with ribbed collar, cuffs and hem",
  "L'Essentiel": "hoodie in heavyweight cotton fleece with a hood without drawstrings and a kangaroo pocket",
  "Le Signature": "half-zip knit pullover with a ribbed stand-up collar and a gunmetal metal zipper",
};
const COLORS: Record<string, { english: string; swatch: string; logo: string }> = {
  noir: { english: "black", swatch: "#141414", logo: "off-white" },
  creme: { english: "cream", swatch: "#E8E0D2", logo: "black" },
  moka: { english: "dark mocha brown", swatch: "#4E3629", logo: "off-white" },
};

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
let session: ReturnType<typeof openSession> | null = null;
let countdown: number | undefined;
/** Vrai quand c'est NOUS qui fermons la séance (fin du temps, changement d'onglet). */
let closingOnPurpose = false;

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

/** Consigne courte pour le modèle : le pull de la photo, sa couleur et son logo. */
function promptFor(product: Product): string {
  const { model, color } = split(product.name);
  const palette = COLORS[normalize(color)];
  const description = MODEL_DESCRIPTIONS[model] ?? "sweater";
  return `Substitute the current top with the ${palette?.english ?? ""} ${description} from the reference image, matching its color, material and fit, with the small ${palette?.logo ?? "embroidered"} embroidered "Ziko Shop" logo on the chest.`
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Photo du pull pour le modèle. En ligne (HTTPS), une simple adresse publique
 * suffit : Fal la télécharge. En local, Fal ne peut pas joindre notre machine,
 * donc on envoie l'image elle-même (data URI).
 */
async function referenceFor(product: Product): Promise<string> {
  const url = new URL(product.imageUrl ?? "", location.origin);
  const isPublic = url.protocol === "https:" && !["localhost", "127.0.0.1"].includes(url.hostname);
  if (isPublic) return url.href;
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function garmentInput(product: Product): Promise<GarmentInput> {
  return { prompt: promptFor(product), reference_image_url: await referenceFor(product) };
}

/** Jeton temporaire demandé à NOTRE serveur : la clé Fal n'arrive jamais ici. */
async function fetchToken(): Promise<string> {
  const response = await fetch("/try-on/token", { method: "POST" });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? "Le service d'essayage est indisponible.");
  }
  return response.text();
}

function openSession(input: GarmentInput, stream: MediaStream) {
  return fal.realtime.open(lucyRealtime<GarmentInput>({ endpoints: [ENDPOINT] }), {
    endpointId: ENDPOINT,
    input,
    localStream: stream,
    tokenProvider: fetchToken,
    tokenExpirationSeconds: 120,
    negotiationTimeoutMs: 20_000,
    onMedia: (remote) => {
      // La vidéo transformée remplace l'aperçu de la caméra.
      output.srcObject = remote;
      void output.play().catch(() => undefined);
      output.classList.remove("preview");
      garment.hidden = true;
      overlay.hidden = true;
      live.hidden = false;
      say("");
      notify("live");
      // Une renégociation peut republier la vidéo : le compte à rebours ne repart pas de zéro.
      if (countdown === undefined) startCountdown(maxSessionSeconds);
    },
    onState: (state) => {
      if (state === "failed") {
        stop();
        say(navigator.onLine ? "La connexion au service d'essayage a été interrompue." : "Connexion internet perdue. Vérifiez votre réseau, puis relancez.", true);
      } else if (state === "closed" && !closingOnPurpose) {
        stop();
        say("La séance d'essayage s'est terminée.");
        notify("ended");
      }
    },
    onError: (error) => {
      const text = error instanceof Error && /indisponible|activé|Patientez/.test(error.message) ? error.message : "Le service d'essayage ne répond pas pour le moment.";
      stop();
      say(text, true);
    },
  });
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
      dot.style.background = COLORS[normalize(variantColor)]?.swatch ?? "#ccc";
      button.append(dot);
      button.addEventListener("click", () => void select(variant.id));
      return button;
    }),
  );
}

/**
 * Changer de pull PENDANT la séance : on envoie la nouvelle photo et la
 * nouvelle consigne au modèle, sans couper la vidéo ni reconnecter.
 */
async function select(productId: string) {
  const product = products.find((item) => item.id === productId);
  if (!product || product.id === current?.id) return;
  showProduct(product);
  if (!session) return;
  try {
    session.send(await garmentInput(product));
  } catch {
    say("Impossible de changer de pull pour l'instant.", true);
  }
}

async function start() {
  if (!current || session) return;
  startButton.disabled = true;
  closingOnPurpose = false;
  say("Connexion à la caméra…");
  notify("ready");

  try {
    camera = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 25, max: 30 } },
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

  // Le client se voit tout de suite pendant que la connexion s'établit.
  output.srcObject = camera;
  output.classList.add("preview");
  void output.play().catch(() => undefined);
  garment.hidden = true;
  overlay.hidden = false;
  overlayText.textContent = "Préparation de l'essayage… Reculez d'un pas pour que tout le pull soit visible.";
  say("");

  try {
    session = openSession(await garmentInput(current), camera);
  } catch {
    stop();
    say("Le service d'essayage ne répond pas pour le moment.", true);
    return;
  }
  stopButton.hidden = false;
  startButton.hidden = true;
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

function stop() {
  closingOnPurpose = true;
  window.clearInterval(countdown);
  countdown = undefined;
  const closing = session;
  session = null;
  void closing?.close();
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

type TryOnConfig = { mode: "fal"; maxSessionSeconds: number } | { mode: "off" };

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

    if (config.mode !== "fal") {
      say("L'essayage en direct n'est pas encore activé sur cette boutique.", true);
      return;
    }
    maxSessionSeconds = config.maxSessionSeconds;
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
      say("Cet appareil ne permet pas l'essayage vidéo en direct.", true);
      return;
    }
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
window.addEventListener("pagehide", stop);
window.addEventListener("offline", () => {
  if (session) say("Connexion internet perdue. L'essayage reprendra si le réseau revient vite.");
});
window.addEventListener("online", () => {
  if (session) say("");
});
void init();
