import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { requireGlobalAdmin } from "@/lib/api/requireGlobalAdmin";
import { UnauthorizedError, ValidationError, ConflictError } from "@/lib/errors";
import { CreateResourceWithUserSchema } from "@/lib/validations/resource";

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
      username: true,
      function: true,
      phone: true,
      mustChangePassword: true,
    },
  },
  team: { select: { id: true, name: true } },
  _count: { select: { resourceSnapshots: true } },
} as const;

// GET /api/admin/resources — alle GlobalResources
export const GET = withErrorHandling(async (_req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();
  await requireGlobalAdmin(session.user.id);

  const resources = await prisma.globalResource.findMany({
    select: resourceSelect,
    orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
  });

  return NextResponse.json({ data: resources });
});

// POST /api/admin/resources — neue Ressource + Benutzer gleichzeitig erstellen
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();
  await requireGlobalAdmin(session.user.id);

  const body = await req.json();
  const result = CreateResourceWithUserSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  const { firstName, lastName, email, username, initialPassword, teamName } = result.data;

  // Eindeutigkeit prüfen
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existingUser) {
    if (existingUser.email === email) {
      throw new ConflictError("Diese E-Mail-Adresse wird bereits verwendet.");
    }
    throw new ConflictError("Dieser Benutzername wird bereits verwendet.");
  }

  // Team suchen oder erstellen
  let teamId: string | null = null;
  if (teamName) {
    const team = await prisma.team.upsert({
      where: { name: teamName },
      update: {},
      create: { name: teamName },
    });
    teamId = team.id;
  }

  const passwordHash = await bcrypt.hash(initialPassword, 12);

  // User + GlobalResource in einer Transaktion erstellen
  const resource = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        username,
        firstName,
        lastName,
        function: result.data.function ?? null,
        phone: result.data.phone ?? null,
        passwordHash,
        mustChangePassword: true,
      },
    });

    return tx.globalResource.create({
      data: { userId: user.id, teamId },
      select: resourceSelect,
    });
  });

  return NextResponse.json({ data: resource }, { status: 201 });
});
