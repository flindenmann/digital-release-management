import { z } from "zod";

export const CreateApplicationSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich.").max(100),
  prefix: z
    .string()
    .min(1, "Prefix ist erforderlich.")
    .max(10)
    .regex(/^[A-Z0-9]+$/, "Prefix darf nur Grossbuchstaben und Ziffern enthalten."),
  description: z.string().max(1000).optional(),
});

export const UpdateApplicationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  // Prefix ist nach Erstellung nicht mehr änderbar
});

export const AssignApplicationSchema = z.object({
  globalApplicationId: z.string().min(1, "Ungültige Applikations-ID."),
});

export type CreateApplicationInput = z.infer<typeof CreateApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof UpdateApplicationSchema>;
export type AssignApplicationInput = z.infer<typeof AssignApplicationSchema>;
