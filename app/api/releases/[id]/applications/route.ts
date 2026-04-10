import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError, NotFoundError, ForbiddenError, ConflictError, ValidationError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { AssignApplicationSchema } from "@/lib/validations/application";

async function getRole(releaseId: string, userId: string) {
  const projectUser = await prisma.projectUser.findUnique({
    where: { releaseId_userId: { releaseId, userId } },
  });
  if (!projectUser) throw new NotFoundError("Release");
  return projectUser.role;
}

// GET /api/releases/[id]/applications — ApplicationSnapshots eines Releases
export const GET = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  await getRole(params.id, session.user.id);

  const applications = await prisma.applicationSnapshot.findMany({
    where: { releaseId: params.id },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: applications });
});

// POST /api/releases/[id]/applications — GlobalApplication einem Release zuweisen
export const POST = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const role = await getRole(params.id, session.user.id);
  if (!can(role, "release:manage")) throw new ForbiddenError();

  const body = await req.json();
  const result = AssignApplicationSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  const globalApp = await prisma.globalApplication.findUnique({
    where: { id: result.data.globalApplicationId },
  });
  if (!globalApp) throw new NotFoundError("Applikation");

  // Prüfen ob schon zugewiesen
  const existing = await prisma.applicationSnapshot.findUnique({
    where: {
      releaseId_globalApplicationId: {
        releaseId: params.id,
        globalApplicationId: result.data.globalApplicationId,
      },
    },
  });
  if (existing) throw new ConflictError("Diese Applikation ist diesem Release bereits zugewiesen.");

  const snapshot = await prisma.applicationSnapshot.create({
    data: {
      releaseId: params.id,
      globalApplicationId: globalApp.id,
      name: globalApp.name,
      prefix: globalApp.prefix,
      description: globalApp.description,
    },
  });

  return NextResponse.json({ data: snapshot }, { status: 201 });
});

// DELETE /api/releases/[id]/applications/[snapshotId] — Zuweisung aufheben
// (wird in separater [snapshotId]/route.ts implementiert)
