import { z } from "zod";

const email = z
  .string({ error: "L'adresse e-mail est obligatoire." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Cette adresse e-mail n'est pas valide." }).max(254, "Cette adresse e-mail est trop longue."));

const fullName = z
  .string({ error: "Le nom est obligatoire." })
  .trim()
  .min(2, "Le nom doit faire au moins 2 caractères.")
  .max(80, "Le nom ne peut pas dépasser 80 caractères.");

/** Numéro de téléphone facultatif, par exemple « +243 81 234 5678 ». */
const phone = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, " "))
  .pipe(z.string().regex(/^\+?[0-9 ]{8,20}$/, "Ce numéro de téléphone n'est pas valide (ex. +243 81 234 5678)."))
  .nullable()
  .optional();

export const registerSchema = z.object({
  fullName,
  email,
  password: z
    .string({ error: "Le mot de passe est obligatoire." })
    .min(8, "Le mot de passe doit faire au moins 8 caractères.")
    .max(128, "Le mot de passe ne peut pas dépasser 128 caractères."),
  phone: phone.or(z.literal("").transform(() => null)),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email,
  password: z.string({ error: "Le mot de passe est obligatoire." }).min(1, "Le mot de passe est obligatoire.").max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z
  .object({
    fullName: fullName.optional(),
    phone: phone.or(z.literal("").transform(() => null)),
  })
  .refine((value) => value.fullName !== undefined || value.phone !== undefined, "Aucune modification à enregistrer.");
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const deleteAccountSchema = z.object({
  password: z.string({ error: "Confirmez avec votre mot de passe." }).min(1, "Confirmez avec votre mot de passe.").max(128),
});
