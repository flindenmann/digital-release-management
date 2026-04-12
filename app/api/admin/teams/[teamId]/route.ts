import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError, NotFoundError, ValidationError } from "@/lib/errors";
import { z } from "zod";

const UpdateTeamSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
});

// PATCH /api/admin/teams/[teamId]
export const PATCH = withErrorHandling(async (
  req: NextRequest,
  { params }: { params: { teamId: string } }
) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const team = await prisma.team.findUnique({ where: { id: params.teamId } });
  if (!team) throw new NotFoundError("Team nicht gefunden.");

  const body = await req.json();
  const parsed = UpdateTeamSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Ungültige Eingabe.", parsed.error.flatten());

  const { name, description } = parsed.data;

  if (name && name !== team.name) {
    const existing = await prisma.team.findUnique({ where: { name } });
    if (existing) throw new ValidationError("Ein Team mit diesem Namen existiert bereits.");
  }

  const updated = await prisma.team.update({
    where: { id: params.teamId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
    },
    select: { id: true, name: true, description: true, _count: { select: { globalResources: true } } },
  });

  return NextResponse.json({ data: updated });
});

// DELETE /api/admin/teams/[teamId]
export const DELETE = withErrorHandling(async (
  _req: NextRequest,
  { params }: { params: { teamId: string } }
) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const team = await prisma.team.findUnique({
    where: { id: params.teamId },
    include: { _count: { select: { globalResources: true } } },
  });
  if (!team) throw new NotFoundError("Team nicht gefunden.");

  if (team._count.globalResources > 0) {
    throw new ValidationError(
      `Das Team "${team.name}" ist ${team._count.globalResources} Ressource(n) zugewiesen und kann nicht gelöscht werden.`
    );
  }

  await prisma.team.delete({ where: { id: params.teamId } });

  return NextResponse.json({ success: true });
});
