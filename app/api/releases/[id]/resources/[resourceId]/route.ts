import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import {
  UnauthorizedError,
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { UpdateResourceSnapshotSchema } from "@/lib/validations/resource";

async function getRole(releaseId: string, userId: string) {
  const projectUser = await prisma.projectUser.findUnique({
    where: { releaseId_userId: { releaseId, userId } },
  });
  if (!projectUser) throw new NotFoundError("Release");
  return projectUser.role;
}

// PATCH /api/releases/[id]/resources/[resourceId]
export const PATCH = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const role = await getRole(params.id, session.user.id);
  if (!can(role, "release:manage")) throw new ForbiddenError();

  const snapshot = await prisma.resourceSnapshot.findFirst({
    where: { id: params.resourceId, releaseId: params.id },
  });
  if (!snapshot) throw new NotFoundError("Ressource");

  const body = await req.json();
  const result = UpdateResourceSnapshotSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  const updated = await prisma.resourceSnapshot.update({
    where: { id: params.resourceId },
    data: {
      firstName: result.data.firstName,
      lastName:  result.data.lastName,
      email:     result.data.email,
      phone:     result.data.phone ?? null,
      function:  result.data.function ?? null,
      teamName:  result.data.teamName ?? null,
    },
  });

  await logAudit({
    entity:    "ResourceSnapshot",
    entityId:  updated.id,
    action:    "UPDATE",
    userId:    session.user.id,
    oldValues: {
      firstName: snapshot.firstName,
      lastName:  snapshot.lastName,
      email:     snapshot.email,
      phone:     snapshot.phone,
      function:  snapshot.function,
      teamName:  snapshot.teamName,
    },
    newValues: {
      firstName: updated.firstName,
      lastName:  updated.lastName,
      email:     updated.email,
      phone:     updated.phone,
      function:  updated.function,
      teamName:  updated.teamName,
    },
  });

  return NextResponse.json({ data: updated });
});

// DELETE /api/releases/[id]/resources/[resourceId]
export const DELETE = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const role = await getRole(params.id, session.user.id);
  if (!can(role, "release:manage")) throw new ForbiddenError();

  const snapshot = await prisma.resourceSnapshot.findFirst({
    where: { id: params.resourceId, releaseId: params.id },
    include: {
      _count: { select: { taskAssignees: true, responsibleMilestones: true } },
    },
  });
  if (!snapshot) throw new NotFoundError("Ressource");

  const usageCount = snapshot._count.taskAssignees + snapshot._count.responsibleMilestones;
  if (usageCount > 0) {
    throw new ConflictError(
      `Diese Ressource ist noch ${usageCount === 1 ? "einer Zuweisung" : `${usageCount} Zuweisungen`} zugeordnet und kann nicht entfernt werden.`
    );
  }

  await prisma.resourceSnapshot.delete({ where: { id: params.resourceId } });

  await logAudit({
    entity:    "ResourceSnapshot",
    entityId:  params.resourceId,
    action:    "DELETE",
    userId:    session.user.id,
    oldValues: {
      firstName: snapshot.firstName,
      lastName:  snapshot.lastName,
      email:     snapshot.email,
    },
  });

  return NextResponse.json({ data: { id: params.resourceId } });
});
