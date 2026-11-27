import { ApiError } from "@/api/client";

/** Erreurs d'un formulaire : par champ (renvoyées par l'API) et un message général. */
export interface FormErrors {
  fields: Record<string, string>;
  general: string | null;
}

export const noErrors: FormErrors = { fields: {}, general: null };

/** Traduit la réponse de l'API (VALIDATION_ERROR, EMAIL_ALREADY_USED…) en erreurs affichables. */
export function formErrorsFrom(error: unknown): FormErrors {
  if (!(error instanceof ApiError)) return { fields: {}, general: "Une erreur inattendue est survenue. Réessayez." };
  if (error.isConnectivityIssue) return { fields: {}, general: `${error.message} Réessayez dans un instant.` };
  const list = (error.details?.fields as { path: string; message: string }[] | undefined) ?? [];
  const fields = Object.fromEntries(list.map((field) => [field.path, field.message]));
  return { fields, general: list.length > 0 && error.code === "VALIDATION_ERROR" ? null : error.message };
}

/** Vérifications immédiates, avant d'appeler le serveur (le serveur revérifie tout). */
export const checks = {
  email: (value: string) => (/^\S+@\S+\.\S+$/.test(value.trim()) ? null : "Entrez une adresse e-mail valide."),
  password: (value: string) => (value.length >= 8 ? null : "Au moins 8 caractères."),
  fullName: (value: string) => (value.trim().length >= 2 ? null : "Entrez votre nom complet."),
  phone: (value: string) => (!value.trim() || /^\+?[0-9 ]{8,20}$/.test(value.trim()) ? null : "Numéro invalide (ex. +243 81 234 5678)."),
};
