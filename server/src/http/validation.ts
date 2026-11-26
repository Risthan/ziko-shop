import { z } from "zod";

// Messages de validation par défaut en français.
z.config(z.locales.fr());

/** Un identifiant de ressource. Un identifiant mal formé ne peut désigner aucune ressource. */
export const uuidSchema = z.uuid();

/**
 * Valide `input` avec `schema`. En cas d'échec, lève la ZodError : le
 * gestionnaire d'erreurs la transforme en réponse 400 lisible.
 */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  return schema.parse(input);
}

export function formatZodError(error: z.ZodError): { message: string; fields: { path: string; message: string }[] } {
  const fields = error.issues.map((issue) => ({
    path: issue.path.join(".") || "requête",
    message: issue.message,
  }));
  const first = fields[0];
  return {
    message: first ? `Données invalides — ${first.path} : ${first.message}` : "Données invalides.",
    fields,
  };
}
