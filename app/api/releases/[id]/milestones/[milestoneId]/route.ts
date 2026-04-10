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
import { UpdateMilestoneSchema } from "@/lib/validations/milestone";

async function getRole(releaseId: string, userId: string) {
  const projectUser = await prisma.projectUser.findUnique({
    where: { releaseId_userId: { releaseId, userId } },
  });
  if (!projectUser) throw new NotFoundError("Release");
  return projectUser.role;
}

const MILESTONE_INCLUDE = {
  applicationSnapshot: { select: { id: true, name: true, prefix: true } },
  responsible: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  predecessors: {
    select: {
      type: true,
      taskId: true,
      predecessorMilestoneId: true,
      task: {
        select: { id: true, key: true, title: true, endAt: true, startAt: true },
      },
      predecessorMilestone: {
        select: { id: true, title: true, dateTime: true },
      },
    },
  },
} as const;

// GET /api/releases/[id]/milestones/[milestoneId]
export const GET = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const role = await getRole(params.id, session.user.id);
  if (!can(role, "milestone:view")) throw new ForbiddenError();

  const milestone = await prisma.milestone.findFirst({
    where: { id: params.milestoneId, releaseId: params.id },
    include: MILESTONE_INCLUDE,
  });
  if (!milestone) throw new NotFoundError("Meilenstein");

  return NextResponse.json({ data: milestone });
});

// PATCH /api/releases/[id]/milestones/[milestoneId]
export const PATCH = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const role = await getRole(params.id, session.user.id);
  if (!can(role, "milestone:edit")) throw new ForbiddenError();

  const body = await req.json();
  const result = UpdateMilestoneSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  const { version, responsibleId, ...data } = result.data;

  // Wenn responsibleId gesetzt: sicherstellen, dass der Snapshot zu diesem Release gehört
  if (responsibleId) {
    const snapshot = await prisma.resourceSnapshot.findFirst({
      where: { id: responsibleId, releaseId: params.id },
    });
    if (!snapshot) throw new NotFoundError("Ressource");
  }

  // Optimistic Locking
  const existing = await prisma.milestone.findFirst({
    where: { id: params.milestoneId, releaseId: params.id },
    select: { version: true, title: true, dateTime: true, status: true, isFixed: true },
  });
  if (!existing) throw new NotFoundError("Meilenstein");
  if (existing.version !== version) throw new ConflictError();

  const milestone = await prisma.milestone.update({
    where: { id: params.milestoneId },
    data: {
      ...data,
      responsibleId: responsibleId ?? null,
      version: { increment: 1 },
    },
    include: MILESTONE_INCLUDE,
  });

  await logAudit({
    entity: "Milestone",
    entityId: milestone.id,
    action: "UPDATE",
    userId: session.user.id,
    oldValues: {
      title: existing.title,
      dateTime: existing.dateTime,
      status: existing.status,
      isFixed: existing.isFixed,
    },
    newValues: {
      title: milestone.title,
      dateTime: milestone.dateTime,
      status: milestone.status,
      isFixed: milestone.isFixed,
    },
  });

  return NextResponse.json({ data: milestone });
});

// DELETE /api/releases/[id]/milestones/[milestoneId]
export const DELETE = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const role = await getRole(params.id, session.user.id);
  if (!can(role, "milestone:edit")) throw new ForbiddenError();

  const milestone = await prisma.milestone.findFirst({
    where: { id: params.milestoneId, releaseId: params.id },
    select: { id: true, title: true },
  });
  if (!milestone) throw new NotFoundError("Meilenstein");

  await prisma.milestone.delete({ where: { id: params.milestoneId } });

  await logAudit({
    entity: "Milestone",
    entityId: params.milestoneId,
    action: "DELETE",
    userId: session.user.id,
    oldValues: { title: milestone.title },
  });

  return NextResponse.json({ data: { id: params.milestoneId } });
});
