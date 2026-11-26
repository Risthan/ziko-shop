// Script de la page /essayage (navigateur). Compilé par esbuild vers public/essayage/app.js.
import { createDecartClient, models, type RealTimeClient } from "@decartai/sdk";

interface Product {
  id: string;
  name: string;
  imageUrl: string | null;
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

let current: Product | null = null;
let session: RealTimeClient | null = null;
let camera: MediaStream | null = null;
let countdown: number | undefined;

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
}

/** Consigne courte (20-30 mots) recommandée par Decart pour le modèle d'essayage. */
function promptFor(product: Product): string {
  const { model, color } = split(product.name);
  const palette = COLORS[normalize(color)];
  const description = MODEL_DESCRIPTIONS[model] ?? "sweater";
  return `Substitute the current top with a ${palette?.english ?? ""} ${description}, with a small ${palette?.logo ?? "embroidered"} embroidered "ZIKO SHOP" logo on the chest.`
    .replace(/\s+/g, " ")
    .trim();
}

async function garmentBlob(product: Product): Promise<Blob | undefined> {
  if (!product.imageUrl) return undefined;
  const response = await fetch(product.imageUrl);
  return response.ok ? response.blob() : undefined;
}

function showProduct(product: Product, variants: Product[]) {
  current = product;
  const { model, color } = split(product.name);
  productLine.textContent = color ? `${model} · ${color}` : model;
  if (product.imageUrl) {
    garment.src = product.imageUrl;
    garment.alt = product.name;
    garment.hidden = session !== null;
  }

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
      button.addEventListener("click", () => void switchTo(variant, variants));
      return button;
    }),
  );
}

/** Pendant la séance, changer de couleur met à jour le pull porté, sans couper la vidéo. */
async function switchTo(product: Product, variants: Product[]) {
  showProduct(product, variants);
  if (!session) return;
  try {
    // set() remplace tout l'état : on renvoie la consigne ET l'image.
    await session.set({ prompt: promptFor(product), image: await garmentBlob(product), enhance: false });
  } catch {
    say("Impossible de changer de couleur pour l'instant.", true);
  }
}

async function start() {
  if (!current) return;
  startButton.disabled = true;
  say("Connexion à la caméra…");

  const model = models.realtime("lucy-vton-latest");
  try {
    camera = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", frameRate: model.fps, width: model.width, height: model.height },
    });
  } catch {
    startButton.disabled = false;
    say("Accès à la caméra refusé. Autorisez la caméra pour ce site, puis réessayez.", true);
    return;
  }

  say("Préparation de l'essayage…");
  overlayText.textContent = "Reculez d'un pas pour que tout le pull soit visible.";
  try {
    const client = createDecartClient({
      // Jeton temporaire demandé à NOTRE serveur : la vraie clé n'arrive jamais ici.
      apiKeyProvider: async () => {
        const response = await fetch("/try-on/token", { method: "POST" });
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error?.message ?? "Essayage indisponible.");
        return body.apiKey as string;
      },
    });
    session = await client.realtime.connect(camera, {
      model,
      mirror: "auto",
      initialState: { prompt: { text: promptFor(current), enhance: false }, image: await garmentBlob(current) },
      onRemoteStream: (stream) => {
        output.srcObject = stream;
        garment.hidden = true;
        overlay.hidden = true;
        live.hidden = false;
        say("");
      },
    });
    session.on("error", () => say("La connexion au service d'essayage a été interrompue.", true));
  } catch (error) {
    stop();
    say(error instanceof Error && error.message ? error.message : "Le service d'essayage est indisponible.", true);
    return;
  }

  stopButton.hidden = false;
  startButton.hidden = true;
  startCountdown(45);
}

function startCountdown(seconds: number) {
  let left = seconds;
  timer.hidden = false;
  const render = () => (timer.textContent = `0:${String(left).padStart(2, "0")}`);
  render();
  countdown = window.setInterval(() => {
    left -= 1;
    render();
    if (left <= 0) {
      stop();
      say("Séance terminée. Vous pouvez relancer un essayage.");
    }
  }, 1000);
}

function stop() {
  window.clearInterval(countdown);
  session?.disconnect();
  session = null;
  camera?.getTracks().forEach((track) => track.stop());
  camera = null;
  output.srcObject = null;
  garment.hidden = !current?.imageUrl;
  overlay.hidden = false;
  overlayText.textContent = "Placez-vous face à la caméra, le haut du corps bien visible.";
  live.hidden = true;
  timer.hidden = true;
  stopButton.hidden = true;
  startButton.hidden = false;
  startButton.disabled = false;
}

type TryOnConfig = { mode: "decart"; maxSessionSeconds: number } | { mode: "anywear"; widgetUrl: string } | { mode: "off" };

/**
 * Mode widget AnyWear : on affiche simplement la photo du pull choisi et on
 * charge le script officiel, qui détecte la photo et y ajoute son bouton.
 */
function useAnywearWidget(widgetUrl: string) {
  startButton.hidden = true;
  garment.hidden = false;
  overlayText.textContent = "Touchez le bouton « Try-On » sur la photo pour vous voir porter ce pull.";
  const script = document.createElement("script");
  script.src = widgetUrl;
  script.async = true;
  script.onerror = () => say("Le widget d'essayage n'a pas pu se charger.", true);
  document.body.append(script);
}

async function init() {
  const productId = new URLSearchParams(location.search).get("produit");
  try {
    const [productsResponse, configResponse] = await Promise.all([fetch("/products"), fetch("/try-on/config")]);
    if (!productsResponse.ok || !configResponse.ok) throw new Error();
    const { products } = (await productsResponse.json()) as { products: Product[] };
    const config = (await configResponse.json()) as TryOnConfig;
    const product = products.find((item) => item.id === productId) ?? products[0];
    if (!product) throw new Error();
    const variants = products.filter((item) => split(item.name).model === split(product.name).model);
    showProduct(product, variants);

    if (config.mode === "anywear") useAnywearWidget(config.widgetUrl);
    else if (config.mode === "decart") startButton.disabled = false;
    else say("L'essayage en direct n'est pas encore activé sur cette boutique.");
  } catch {
    productLine.textContent = "Produit introuvable.";
    say("Impossible de charger le produit. Revenez à l'app et réessayez.", true);
  }
}

if (!navigator.mediaDevices?.getUserMedia) {
  say("Votre navigateur ne permet pas d'utiliser la caméra ici.", true);
}
startButton.addEventListener("click", () => void start());
stopButton.addEventListener("click", stop);
window.addEventListener("pagehide", stop);
void init();
