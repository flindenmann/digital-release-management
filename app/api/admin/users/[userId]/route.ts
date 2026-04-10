import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  ValidationError,
  ForbiddenError,
} from "@/lib/errors";
import { UpdateUserSchema, ResetPasswordSchema } from "@/lib/validations/user";

// PATCH /api/admin/users/[userId] — Benutzer aktualisieren oder Passwort zurücksetzen
export const PATCH = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const existing = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!existing) throw new NotFoundError("Benutzer");

  const body = await req.json();

  // Passwort-Reset-Pfad
  if ("newPassword" in body) {
    const result = ResetPasswordSchema.safeParse(body);
    if (!result.success) {
      throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
    }
    const passwordHash = await bcrypt.hash(result.data.newPassword, 12);
    const updated = await prisma.user.update({
      where: { id: params.userId },
      data: { passwordHash, mustChangePassword: true },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        function: true,
        phone: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { projectUsers: true } },
      },
    });
    return NextResponse.json({ data: updated });
  }

  // Stammdaten-Update-Pfad
  const result = UpdateUserSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  // Eindeutigkeit bei E-Mail / Username prüfen
  if (result.data.email && result.data.email !== existing.email) {
    const clash = await prisma.user.findUnique({ where: { email: result.data.email } });
    if (clash) throw new ConflictError("Diese E-Mail-Adresse wird bereits verwendet.");
  }
  if (result.data.username && result.data.username !== existing.username) {
    const clash = await prisma.user.findUnique({ where: { username: result.data.username } });
    if (clash) throw new ConflictError("Dieser Benutzername wird bereits verwendet.");
  }

  const updated = await prisma.user.update({
    where: { id: params.userId },
    data: result.data,
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      function: true,
      phone: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { projectUsers: true } },
    },
  });

  return NextResponse.json({ data: updated });
});

// DELETE /api/admin/users/[userId] — Benutzer löschen
export const DELETE = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  // Eigenes Konto nicht löschbar
  if (params.userId === session.user.id) {
    throw new ForbiddenError("Sie können Ihr eigenes Konto nicht löschen.");
  }

  const existing = await prisma.user.findUnique({
    where: { id: params.userId },
    include: { _count: { select: { projectUsers: true } } },
  });
  if (!existing) throw new NotFoundError("Benutzer");

  if (existing._count.projectUsers > 0) {
    throw new ConflictError(
      "Dieser Benutzer ist einem oder mehreren Releases zugewiesen und kann nicht gelöscht werden."
    );
  }

  await prisma.user.delete({ where: { id: params.userId } });

  return new NextResponse(null, { status: 204 });
});
