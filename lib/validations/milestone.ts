import { z } from "zod";
import { MilestoneStatus } from "@prisma/client";

export const CreateMilestoneSchema = z.object({
  applicationSnapshotId: z.string().min(1, "Ungültige Applikations-ID."),
  title: z.string().min(1, "Titel ist erforderlich.").max(200),
  description: z.string().max(5000).optional(),
  dateTime: z.coerce.date({ required_error: "Datum/Zeit ist erforderlich." }),
  isFixed: z.boolean().optional().default(false),
  responsibleId: z.string().min(1).optional(),
});

export const UpdateMilestoneSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  dateTime: z.coerce.date().optional(),
  isFixed: z.boolean().optional(),
  status: z.nativeEnum(MilestoneStatus).optional(),
  responsibleId: z.string().min(1).nullable().optional(),
  // Optimistic Locking
  version: z.number().int().positive("Version ist erforderlich."),
});

export type CreateMilestoneInput = z.infer<typeof CreateMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof UpdateMilestoneSchema>;
