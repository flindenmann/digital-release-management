import { z } from "zod";

export const UpdateResourceSnapshotSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
  email:     z.string().email().max(200),
  phone:     z.string().max(50).nullable().optional(),
  function:  z.string().max(100).nullable().optional(),
  teamName:  z.string().max(100).nullable().optional(),
});

// Erstellt User + GlobalResource in einem Schritt
export const CreateResourceWithUserSchema = z.object({
  firstName:       z.string().min(1, "Vorname ist erforderlich.").max(100),
  lastName:        z.string().min(1, "Nachname ist erforderlich.").max(100),
  email:           z.string().email("Ungültige E-Mail-Adresse.").max(200),
  username:        z
    .string()
    .min(2, "Benutzername muss mindestens 2 Zeichen lang sein.")
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, "Benutzername darf nur Buchstaben, Ziffern, '.', '_' und '-' enthalten."),
  initialPassword: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein."),
  function:        z.string().max(100).nullable().optional(),
  phone:           z.string().max(50).nullable().optional(),
  teamName:        z.string().min(1).max(100).nullable().optional(),
});

export const AssignResourceSchema = z.object({
  globalResourceId: z.string().min(1),
});

export const UpdateGlobalResourceSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName:  z.string().min(1).max(100).optional(),
  email:     z.string().email().max(200).optional(),
  username:  z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .optional(),
  phone:     z.string().max(50).nullable().optional(),
  function:  z.string().max(100).nullable().optional(),
  teamName:  z.string().min(1).max(100).nullable().optional(),
});
