import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { requireGlobalAdmin } from "@/lib/api/requireGlobalAdmin";
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  ValidationError,
  ForbiddenError,
} from "@/lib/errors";
import { UpdateGlobalResourceSchema } from "@/lib/validations/resource";
import { ResetPasswordSchema } from "@/lib/validations/user";

const resourceSelect = {
  id: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      username: true,
      function: true,
      phone: true,
      mustChangePassword: true,
    },
  },
  team: { select: { id: true, name: true } },
  _count: { select: { resourceSnapshots: true } },
} as const;

// PATCH /api/admin/resources/[resourceId] — Ressource aktualisieren oder Passwort zurücksetzen
export const PATCH = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();
  await requireGlobalAdmin(session.user.id);

  const existing = await prisma.globalResource.findUnique({ where: { id: params.resourceId } });
  if (!existing) throw new NotFoundError("Ressource");

  const body = await req.json();

  // Passwort-Reset-Pfad
  if ("newPassword" in body) {
    if (!existing.userId) throw new ForbiddenError("Diese Ressource hat keinen verknüpften Benutzer.");
    const result = ResetPasswordSchema.safeParse(body);
    if (!result.success) {
      throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
    }
    const passwordHash = await bcrypt.hash(result.data.newPassword, 12);
    await prisma.user.update({
      where: { id: existing.userId },
      data: { passwordHash, mustChangePassword: true },
    });
    const updated = await prisma.globalResource.findUnique({
      where: { id: params.resourceId },
      select: resourceSelect,
    });
    return NextResponse.json({ data: updated });
  }

  // Stammdaten-Update-Pfad
  const result = UpdateGlobalResourceSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  const { teamName, firstName, lastName, email, username, phone, function: func } = result.data;

  // User-Felder aktualisieren
  if (existing.userId) {
    // Eindeutigkeit bei E-Mail / Benutzername prüfen
    if (email) {
      const clash = await prisma.user.findFirst({
        where: { email, NOT: { id: existing.userId } },
      });
      if (clash) throw new ConflictError("Diese E-Mail-Adresse wird bereits verwendet.");
    }
    if (username) {
      const clash = await prisma.user.findFirst({
        where: { username, NOT: { id: existing.userId } },
      });
      if (clash) throw new ConflictError("Dieser Benutzername wird bereits verwendet.");
    }

    const userUpdate: Record<string, unknown> = {};
    if (firstName !== undefined) userUpdate.firstName = firstName;
    if (lastName !== undefined)  userUpdate.lastName  = lastName;
    if (email !== undefined)     userUpdate.email     = email;
    if (username !== undefined)  userUpdate.username  = username;
    if (phone !== undefined)     userUpdate.phone     = phone ?? null;
    if (func !== undefined)      userUpdate.function  = func ?? null;

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({ where: { id: existing.userId }, data: userUpdate });
    }
  }

  // Team aktualisieren
  let teamId: string | null = existing.teamId;
  if (teamName !== undefined) {
    if (!teamName) {
      teamId = null;
    } else {
      const team = await prisma.team.upsert({
        where: { name: teamName },
        update: {},
        create: { name: teamName },
      });
      teamId = team.id;
    }
  }

  const updated = await prisma.globalResource.update({
    where: { id: params.resourceId },
    data: { teamId },
    select: resourceSelect,
  });

  return NextResponse.json({ data: updated });
});

// DELETE /api/admin/resources/[resourceId] — Ressource (und verknüpften User) löschen
export const DELETE = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();
  await requireGlobalAdmin(session.user.id);

  const existing = await prisma.globalResource.findUnique({
    where: { id: params.resourceId },
    include: {
      _count: { select: { resourceSnapshots: true } },
      user: { select: { id: true, _count: { select: { projectUsers: true } } } },
    },
  });
  if (!existing) throw new NotFoundError("Ressource");

  if (existing._count.resourceSnapshots > 0) {
    throw new ConflictError(
      "Diese Ressource ist einem oder mehreren Releases zugewiesen und kann nicht gelöscht werden."
    );
  }

  if (existing.user && existing.user._count.projectUsers > 0) {
    throw new ConflictError(
      "Der Benutzer dieser Ressource ist einem Release als Projektmitglied zugewiesen und kann nicht gelöscht werden."
    );
  }

  // Eigenes Konto nicht löschbar
  if (existing.userId && existing.userId === session.user.id) {
    throw new ForbiddenError("Sie können Ihr eigenes Konto nicht löschen.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.globalResource.delete({ where: { id: params.resourceId } });
    if (existing.userId) {
      await tx.user.delete({ where: { id: existing.userId } });
    }
  });

  return new NextResponse(null, { status: 204 });
});
