import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError, NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { UpdateReleaseSchema } from "@/lib/validations/release";

async function getReleaseWithRole(releaseId: string, userId: string) {
  const projectUser = await prisma.projectUser.findUnique({
    where: { releaseId_userId: { releaseId, userId } },
  });
  if (!projectUser) throw new NotFoundError("Release");

  const release = await prisma.release.findUnique({ where: { id: releaseId } });
  if (!release) throw new NotFoundError("Release");

  return { release, role: projectUser.role };
}

// GET /api/releases/[id]
export const GET = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const { release, role } = await getReleaseWithRole(params.id, session.user.id);

  const data = await prisma.release.findUnique({
    where: { id: params.id },
    include: {
      projectUsers: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
      applicationSnapshots: true,
      resourceSnapshots: true,
      _count: { select: { tasks: true, milestones: true } },
    },
  });

  return NextResponse.json({ data: { ...data, currentUserRole: role } });
});

// PATCH /api/releases/[id]
export const PATCH = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const { release, role } = await getReleaseWithRole(params.id, session.user.id);
  if (!can(role, "release:manage")) throw new ForbiddenError();

  const body = await req.json();
  const result = UpdateReleaseSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  const updated = await prisma.release.update({
    where: { id: params.id },
    data: result.data,
  });

  await logAudit({
    entity: "Release",
    entityId: params.id,
    action: "UPDATE",
    userId: session.user.id,
    oldValues: { name: release.name, description: release.description ?? undefined },
    newValues: result.data,
  });

  return NextResponse.json({ data: updated });
});

// DELETE /api/releases/[id]
export const DELETE = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const { role } = await getReleaseWithRole(params.id, session.user.id);
  if (!can(role, "release:manage")) throw new ForbiddenError();

  await prisma.release.delete({ where: { id: params.id } });

  await logAudit({
    entity: "Release",
    entityId: params.id,
    action: "DELETE",
    userId: session.user.id,
  });

  return NextResponse.json({ data: null }, { status: 204 });
});
