import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { ValidationError, UnauthorizedError } from "@/lib/errors";

const SetPasswordSchema = z
  .object({
    password: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein."),
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: "Passwörter stimmen nicht überein.",
    path: ["passwordConfirm"],
  });

export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const body = await req.json();
  const result = SetPasswordSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", {
      issues: result.error.issues,
    });
  }

  const passwordHash = await bcrypt.hash(result.data.password, 12);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  return NextResponse.json({ ok: true });
});
