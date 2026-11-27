import { router } from "expo-router";

/** Après connexion ou inscription : retour là où était le client (commande en cours, profil…). */
export function leaveAuth() {
  if (router.canGoBack()) router.back();
  else router.replace("/profil");
}
