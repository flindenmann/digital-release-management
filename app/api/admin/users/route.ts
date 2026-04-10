import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError, ValidationError, ConflictError } from "@/lib/errors";
import { CreateUserSchema } from "@/lib/validations/user";

// GET /api/admin/users — alle Benutzer auflisten
export const GET = withErrorHandling(async (_req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const users = await prisma.user.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
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

  return NextResponse.json({ data: users });
});

// POST /api/admin/users — neuen Benutzer erstellen
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const body = await req.json();
  const result = CreateUserSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  const { email, username, firstName, lastName, initialPassword } = result.data;

  // Eindeutigkeit prüfen
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing) {
    if (existing.email === email) {
      throw new ConflictError("Diese E-Mail-Adresse wird bereits verwendet.");
    }
    throw new ConflictError("Dieser Benutzername wird bereits verwendet.");
  }

  const passwordHash = await bcrypt.hash(initialPassword, 12);

  const user = await prisma.user.create({
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

  return NextResponse.json({ data: user }, { status: 201 });
});
