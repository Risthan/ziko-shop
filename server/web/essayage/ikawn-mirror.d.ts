// Types du SDK officiel iKawn Mirror, chargé depuis https://api.ikawn.com/sdk/mirror.js.
// Écrits d'après la documentation publique (Browser SDK, Live updates, Session lifecycle) :
// https://platform.ikawn.com/documentation/browser-sdk
declare module "https://api.ikawn.com/sdk/mirror.js" {
  export interface MirrorSession {
    id?: string;
    [key: string]: unknown;
  }

  export interface MirrorConnectOptions {
    capability: "tryon" | "video_edit";
    /** Photo du vêtement (File ou Blob, 10 Mio au plus). Obligatoire pour « tryon ». */
    referenceImage?: Blob;
    /** Vide ou absent : remplacement du vêtement seulement (recommandé pour l'essayage). */
    prompt?: string;
    onRemoteStream?: (stream: MediaStream) => void;
  }

  export interface MirrorLive {
    /** Change le vêtement ou la consigne sans reconnecter. Attendre avant l'envoi suivant. */
    set(update: { referenceImage?: Blob; prompt?: string }): Promise<unknown>;
    /** Termine la séance (à appeler quand le client arrête ou quitte). */
    disconnect(): Promise<unknown>;
  }

  export interface MirrorClient {
    connect(stream: MediaStream, options: MirrorConnectOptions): Promise<MirrorLive>;
  }

  export function createMirrorClient(options: {
    sessionProvider: (request: { capability: string }) => Promise<MirrorSession>;
    onError?: (error: Error & { code?: string }) => void;
    onStage?: (stage: { stage: string; elapsed_ms?: number }) => void;
    onUsage?: (usage: unknown) => void;
    onStats?: (stats: { rtt_ms?: number; frames_per_second?: number; packet_loss_ratio?: number }) => void;
  }): MirrorClient;

  /** Télécharge et prépare le moteur du SDK, sans créer ni facturer de séance. */
  export function prepareMirrorRuntime(): Promise<void>;
}
