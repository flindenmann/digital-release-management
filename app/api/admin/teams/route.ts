import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { requireGlobalAdmin } from "@/lib/api/requireGlobalAdmin";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { z } from "zod";

const CreateTeamSchema = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

// GET /api/admin/teams — alle Teams
export const GET = withErrorHandling(async (_req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();
  await requireGlobalAdmin(session.user.id);

  const teams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { globalResources: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: teams });
});

// POST /api/admin/teams — neues Team erstellen
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();
  await requireGlobalAdmin(session.user.id);

  const body = await req.json();
  const parsed = CreateTeamSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Ungültige Eingabe.", parsed.error.flatten());

  const { name, description } = parsed.data;

  const existing = await prisma.team.findUnique({ where: { name } });
  if (existing) throw new ValidationError("Ein Team mit diesem Namen existiert bereits.");

  const team = await prisma.team.create({
    data: { name, description },
    select: { id: true, name: true, description: true, _count: { select: { globalResources: true } } },
  });

  return NextResponse.json({ data: team }, { status: 201 });
});
