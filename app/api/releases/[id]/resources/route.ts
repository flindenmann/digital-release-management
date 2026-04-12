import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import {
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from "@/lib/errors";
import { can } from "@/lib/permissions";
import { AssignResourceSchema } from "@/lib/validations/resource";

async function getRole(releaseId: string, userId: string) {
  const projectUser = await prisma.projectUser.findUnique({
    where: { releaseId_userId: { releaseId, userId } },
  });
  if (!projectUser) throw new NotFoundError("Release");
  return projectUser.role;
}

// GET /api/releases/[id]/resources — ResourceSnapshots eines Releases
export const GET = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  await getRole(params.id, session.user.id);

  const resources = await prisma.resourceSnapshot.findMany({
    where: { releaseId: params.id },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json({ data: resources });
});

// POST /api/releases/[id]/resources — GlobalResource einem Release zuweisen
export const POST = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const role = await getRole(params.id, session.user.id);
  if (!can(role, "release:manage")) throw new ForbiddenError();

  const body = await req.json();
  const result = AssignResourceSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  const globalResource = await prisma.globalResource.findUnique({
    where: { id: result.data.globalResourceId },
    include: {
      user: true,
      team: true,
    },
  });
  if (!globalResource) throw new NotFoundError("Ressource");
  if (!globalResource.user) {
    throw new ValidationError("Diese Ressource hat keinen verknüpften Benutzer und kann nicht zugewiesen werden.");
  }

  // Duplikat prüfen
  const existing = await prisma.resourceSnapshot.findUnique({
    where: {
      releaseId_globalResourceId: {
        releaseId: params.id,
        globalResourceId: result.data.globalResourceId,
      },
    },
  });
  if (existing) throw new ConflictError("Diese Ressource ist diesem Release bereits zugewiesen.");

  const snapshot = await prisma.resourceSnapshot.create({
    data: {
      releaseId:        params.id,
      globalResourceId: globalResource.id,
      firstName:        globalResource.user.firstName,
      lastName:         globalResource.user.lastName,
      email:            globalResource.user.email,
      phone:            globalResource.user.phone ?? null,
      function:         globalResource.user.function ?? null,
      teamName:         globalResource.team?.name ?? null,
    },
  });

  return NextResponse.json({ data: snapshot }, { status: 201 });
});
