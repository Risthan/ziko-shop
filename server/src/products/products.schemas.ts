import { z } from "zod";

export const MAX_PRICE_CDF = 10_000_000;
export const MAX_STOCK = 1_000_000;

export const createProductSchema = z.object({
  name: z
    .string({ error: "Le nom est obligatoire." })
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(120, "Le nom ne doit pas dépasser 120 caractères."),
  priceCdf: z
    .number({ error: "Le prix (en francs congolais) doit être un nombre." })
    .int("Le prix doit être un nombre entier de francs congolais.")
    .min(1, "Le prix doit être supérieur à 0 FC.")
    .max(MAX_PRICE_CDF, `Le prix ne peut pas dépasser ${MAX_PRICE_CDF} FC.`),
  stock: z
    .number({ error: "Le stock doit être un nombre." })
    .int("Le stock doit être un nombre entier.")
    .min(0, "Le stock ne peut pas être négatif.")
    .max(MAX_STOCK, `Le stock ne peut pas dépasser ${MAX_STOCK}.`),
  imageUrl: z
    .string()
    .max(500)
    .refine((value) => value.startsWith("https://") || /^\/images\/[\w.-]+$/.test(value), {
      message: "L'image doit être une adresse https:// ou un chemin /images/…",
    })
    .optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

/** Modifier un produit : seulement les champs envoyés (nom, prix, stock, image). */
export const updateProductSchema = createProductSchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined), "Aucune modification à enregistrer.");
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const listProductsQuerySchema = z.object({
  search: z.string().trim().max(60, "La recherche ne doit pas dépasser 60 caractères.").optional(),
});
