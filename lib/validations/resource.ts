import { z } from "zod";

export const UpdateResourceSnapshotSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
  email:     z.string().email().max(200),
  phone:     z.string().max(50).nullable().optional(),
  function:  z.string().max(100).nullable().optional(),
  teamName:  z.string().max(100).nullable().optional(),
});

export const CreateGlobalResourceSchema = z.object({
  userId:   z.string().min(1),
  teamName: z.string().min(1).max(100).nullable().optional(),
});

export const UpdateGlobalResourceSchema = z.object({
  teamName: z.string().min(1).max(100).nullable().optional(),
});
