import { z } from "zod";

export const CreateReleaseSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich.").max(200),
  description: z.string().max(2000).optional(),
});

export const UpdateReleaseSchema = CreateReleaseSchema.partial();

export type CreateReleaseInput = z.infer<typeof CreateReleaseSchema>;
export type UpdateReleaseInput = z.infer<typeof UpdateReleaseSchema>;
