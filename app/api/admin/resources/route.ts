import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError, ValidationError, ConflictError } from "@/lib/errors";
import { CreateGlobalResourceSchema } from "@/lib/validations/resource";

const resourceSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      function: true,
      phone: true,
      username: true,
    },
  },
  team: { select: { id: true, name: true } },
  _count: { select: { resourceSnapshots: true } },
} as const;

// GET /api/admin/resources — alle GlobalResources
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const resources = await prisma.globalResource.findMany({
    select: resourceSelect,
    orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
  });

  return NextResponse.json({ data: resources });
});

// POST /api/admin/resources — neue GlobalResource erstellen
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const body = await req.json();
  const result = CreateGlobalResourceSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  const { userId, teamName } = result.data;

  // Prüfen ob User bereits als GlobalResource vorhanden
  const existing = await prisma.globalResource.findFirst({ where: { userId } });
  if (existing) {
    throw new ConflictError("Diese Person ist bereits in der globalen Ressourcenliste vorhanden.");
  }

  // Team nach Name suchen oder erstellen
  let teamId: string | null = null;
  if (teamName) {
    const team = await prisma.team.upsert({
      where: { name: teamName },
      update: {},
      create: { name: teamName },
    });
    teamId = team.id;
  }

  const resource = await prisma.globalResource.create({
    data: { userId, teamId },
    select: resourceSelect,
  });

  return NextResponse.json({ data: resource }, { status: 201 });
});
