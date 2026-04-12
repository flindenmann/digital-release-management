import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError, NotFoundError, ForbiddenError, ConflictError, ValidationError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { can, canViewAllTasks } from "@/lib/permissions";
import { UpdateTaskSchema } from "@/lib/validations/task";

async function getTaskAndRole(releaseId: string, taskId: string, userId: string) {
  const projectUser = await prisma.projectUser.findUnique({
    where: { releaseId_userId: { releaseId, userId } },
  });
  if (!projectUser) throw new NotFoundError("Release");

  const task = await prisma.task.findFirst({
    where: { id: taskId, releaseId },
  });
  if (!task) throw new NotFoundError("Task");

  if (!canViewAllTasks(projectUser.role)) {
    const isAssigned = await prisma.taskAssignee.findFirst({
      where: {
        taskId,
        resourceSnapshot: { globalResource: { userId } },
      },
    });
    if (!isAssigned) throw new ForbiddenError();
  }

  return { task, role: projectUser.role };
}

// GET /api/releases/[id]/tasks/[taskId]
export const GET = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  await getTaskAndRole(params.id, params.taskId, session.user.id);

  const task = await prisma.task.findUnique({
    where: { id: params.taskId },
    include: {
      applicationSnapshot: true,
      assignees: { include: { resourceSnapshot: true } },
      attachments: true,
      comments: {
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: "asc" },
      },
      predecessors: { include: { predecessor: { select: { id: true, key: true, title: true } } } },
      successors: { include: { successor: { select: { id: true, key: true, title: true } } } },
    },
  });

  return NextResponse.json({ data: task });
});

// PATCH /api/releases/[id]/tasks/[taskId]
export const PATCH = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const { task, role } = await getTaskAndRole(params.id, params.taskId, session.user.id);
  if (!can(role, "task:edit")) throw new ForbiddenError();

  const body = await req.json();
  const result = UpdateTaskSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  const { version, assigneeIds, ...updateData } = result.data;

  // Optimistic Locking
  const updated = await prisma.task.updateMany({
    where: { id: params.taskId, version },
    data: { ...updateData, updatedById: session.user.id, version: { increment: 1 } },
  });

  if (updated.count === 0) {
    throw new ConflictError();
  }

  // Assignees aktualisieren wenn mitgeschickt
  if (assigneeIds !== undefined) {
    await prisma.taskAssignee.deleteMany({ where: { taskId: params.taskId } });
    if (assigneeIds.length > 0) {
      await prisma.taskAssignee.createMany({
        data: assigneeIds.map((resourceSnapshotId) => ({
          taskId: params.taskId,
          resourceSnapshotId,
        })),
      });
    }
  }

  const fresh = await prisma.task.findUnique({
    where: { id: params.taskId },
    include: {
      applicationSnapshot: { select: { name: true, prefix: true } },
      assignees: { include: { resourceSnapshot: true } },
    },
  });

  await logAudit({
    entity: "Task",
    entityId: params.taskId,
    action: "UPDATE",
    userId: session.user.id,
    oldValues: { title: task.title, status: task.status, startAt: task.startAt, endAt: task.endAt },
    newValues: updateData,
  });

  return NextResponse.json({ data: fresh });
});

// DELETE /api/releases/[id]/tasks/[taskId]
export const DELETE = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const { task, role } = await getTaskAndRole(params.id, params.taskId, session.user.id);
  if (!can(role, "task:delete")) throw new ForbiddenError();

  await prisma.task.delete({ where: { id: params.taskId } });

  await logAudit({
    entity: "Task",
    entityId: params.taskId,
    action: "DELETE",
    userId: session.user.id,
    oldValues: { key: task.key, title: task.title },
  });

  return new NextResponse(null, { status: 204 });
});
