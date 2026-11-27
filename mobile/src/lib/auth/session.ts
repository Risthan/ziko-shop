import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import type { User } from "@/api/types";

/**
 * Session du client sur ce téléphone.
 * - Le jeton est gardé dans le trousseau sécurisé du téléphone (Keychain sur
 *   iPhone, Keystore sur Android). Sur le web (aperçu), AsyncStorage.
 * - Le profil (nom, e-mail) est gardé à part, pour s'afficher tout de suite au
 *   lancement ; il est ensuite rafraîchi auprès du serveur.
 */
const TOKEN_KEY = "ziko.session.token";
const USER_KEY = "ziko:session:user";

export type SessionStatus = "loading" | "signedOut" | "signedIn";
export interface SessionState {
  status: SessionStatus;
  token: string | null;
  user: User | null;
}

let state: SessionState = { status: "loading", token: null, user: null };
const listeners = new Set<() => void>();

function set(next: SessionState) {
  state = next;
  listeners.forEach((listener) => listener());
}

const tokenStore = {
  get: () => (Platform.OS === "web" ? AsyncStorage.getItem(TOKEN_KEY) : SecureStore.getItemAsync(TOKEN_KEY)),
  set: (token: string) => (Platform.OS === "web" ? AsyncStorage.setItem(TOKEN_KEY, token) : SecureStore.setItemAsync(TOKEN_KEY, token)),
  clear: () => (Platform.OS === "web" ? AsyncStorage.removeItem(TOKEN_KEY) : SecureStore.deleteItemAsync(TOKEN_KEY)),
};

/** Lu une fois au lancement de l'app. */
async function hydrate() {
  try {
    const [token, rawUser] = await Promise.all([tokenStore.get(), AsyncStorage.getItem(USER_KEY)]);
    const user = rawUser ? (JSON.parse(rawUser) as User) : null;
    set(token && user ? { status: "signedIn", token, user } : { status: "signedOut", token: null, user: null });
  } catch {
    set({ status: "signedOut", token: null, user: null });
  }
}
void hydrate();

export const session = {
  get: () => state,
  token: () => state.token,

  async signIn(token: string, user: User) {
    set({ status: "signedIn", token, user });
    await Promise.all([tokenStore.set(token), AsyncStorage.setItem(USER_KEY, JSON.stringify(user))]);
  },

  /** Profil mis à jour par le serveur (modification, rafraîchissement). */
  async setUser(user: User) {
    if (state.status !== "signedIn") return;
    set({ ...state, user });
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  async signOut() {
    if (state.status === "signedOut") return;
    set({ status: "signedOut", token: null, user: null });
    await Promise.all([tokenStore.clear(), AsyncStorage.removeItem(USER_KEY)]);
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useSession(): SessionState {
  return useSyncExternalStore(session.subscribe, session.get, session.get);
}
