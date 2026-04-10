import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { CreateReleaseSchema } from "@/lib/validations/release";

// GET /api/releases — alle Releases des eingeloggten Users
export const GET = withErrorHandling(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const releases = await prisma.release.findMany({
    where: {
      projectUsers: { some: { userId: session.user.id } },
    },
    include: {
      projectUsers: {
        where: { userId: session.user.id },
        select: { role: true },
      },
      _count: { select: { tasks: true, milestones: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: releases });
});

// POST /api/releases — neues Release erstellen (nur RELEASE_MANAGER)
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const body = await req.json();
  const result = CreateReleaseSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  const release = await prisma.release.create({
    data: {
      ...result.data,
      projectUsers: {
        create: { userId: session.user.id, role: "RELEASE_MANAGER" },
      },
    },
  });

  await logAudit({
    entity: "Release",
    entityId: release.id,
    action: "CREATE",
    userId: session.user.id,
    newValues: result.data,
  });

  return NextResponse.json({ data: release }, { status: 201 });
});
