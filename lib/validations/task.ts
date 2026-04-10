import { z } from "zod";
import { TaskStatus } from "@prisma/client";

export const CreateTaskSchema = z.object({
  applicationSnapshotId: z.string().min(1, "Ungültige Applikations-ID."),
  title: z.string().min(1, "Titel ist erforderlich.").max(200),
  description: z.string().max(5000).optional(),
  isMilestone: z.boolean().optional().default(false),
  isSummaryTask: z.boolean().optional().default(false),
  parentTaskId: z.string().nullable().optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  durationMinutes: z.number().int().positive().optional(),
  assigneeIds: z.array(z.string().min(1)).optional(),
});

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  isMilestone: z.boolean().optional(),
  isSummaryTask: z.boolean().optional(),
  parentTaskId: z.string().nullable().optional(),
  startAt: z.coerce.date().nullable().optional(),
  endAt: z.coerce.date().nullable().optional(),
  durationMinutes: z.number().int().positive().nullable().optional(),
  assigneeIds: z.array(z.string().min(1)).optional(),
  // Optimistic Locking — muss mitgeschickt werden
  version: z.number().int().positive("Version ist erforderlich."),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;
