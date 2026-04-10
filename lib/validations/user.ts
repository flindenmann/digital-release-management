import { z } from "zod";

export const CreateUserSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse.").max(255),
  username: z
    .string()
    .min(2, "Benutzername muss mindestens 2 Zeichen lang sein.")
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, "Benutzername darf nur Buchstaben, Ziffern, '.', '_' und '-' enthalten."),
  firstName: z.string().min(1, "Vorname ist erforderlich.").max(100),
  lastName: z.string().min(1, "Nachname ist erforderlich.").max(100),
  function: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  initialPassword: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein."),
});

export const UpdateUserSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse.").max(255).optional(),
  username: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  function: z.string().max(100).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
});

export const ResetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein."),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
