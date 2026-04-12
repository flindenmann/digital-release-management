import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError, NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { can, canViewAllTasks } from "@/lib/permissions";
import { CreateTaskSchema } from "@/lib/validations/task";
import { generateTaskKey } from "@/lib/task-key";

async function getRole(releaseId: string, userId: string) {
  const projectUser = await prisma.projectUser.findUnique({
    where: { releaseId_userId: { releaseId, userId } },
  });
  if (!projectUser) throw new NotFoundError("Release");
  return projectUser.role;
}

// GET /api/releases/[id]/tasks
export const GET = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const role = await getRole(params.id, session.user.id);
  const { searchParams } = new URL(req.url);
  const onlyOwn = searchParams.get("onlyOwn") === "true";
  const status = searchParams.get("status") ?? undefined;
  const includeArchived = searchParams.get("archived") === "true";

  // Sachbearbeiter sehen nur eigene Tasks, ausser onlyOwn wird explizit überschrieben
  const restrictToOwn = !canViewAllTasks(role) || onlyOwn;

  const tasks = await prisma.task.findMany({
    where: {
      releaseId: params.id,
      ...(status ? { status: status as any } : {}),
      ...(!includeArchived ? { status: { not: "ARCHIVED" } } : {}),
      ...(restrictToOwn
        ? {
            assignees: {
              some: {
                resourceSnapshot: {
                  globalResource: { userId: session.user.id },
                },
              },
            },
          }
        : {}),
    },
    include: {
      applicationSnapshot: { select: { name: true, prefix: true } },
      assignees: {
        include: {
          resourceSnapshot: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      },
      _count: { select: { comments: true, attachments: true } },
      predecessors: {
        select: {
          type: true,
          predecessorId: true,
          predecessor: { select: { id: true, key: true, startAt: true, endAt: true } },
        },
      },
      successors: {
        select: {
          successorId: true,
          successor: { select: { id: true, key: true } },
        },
      },
    },
    orderBy: [
      { startAt: { sort: "asc", nulls: "last" } },
      { endAt: { sort: "asc", nulls: "last" } },
      { createdAt: "asc" },
    ],
  });

  return NextResponse.json({ data: tasks });
});

// POST /api/releases/[id]/tasks
export const POST = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const role = await getRole(params.id, session.user.id);
  if (!can(role, "task:create")) throw new ForbiddenError();

  const body = await req.json();
  const result = CreateTaskSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  // ApplicationSnapshot muss zu diesem Release gehören
  const appSnapshot = await prisma.applicationSnapshot.findFirst({
    where: { id: result.data.applicationSnapshotId, releaseId: params.id },
  });
  if (!appSnapshot) throw new NotFoundError("Applikation");

  const { key } = await generateTaskKey(result.data.applicationSnapshotId);

  const { assigneeIds, ...taskData } = result.data;

  const task = await prisma.task.create({
    data: {
      ...taskData,
      key,
      releaseId: params.id,
      createdById: session.user.id,
      updatedById: session.user.id,
      ...(assigneeIds?.length
        ? {
            assignees: {
              create: assigneeIds.map((resourceSnapshotId: string) => ({
                resourceSnapshotId,
              })),
            },
          }
        : {}),
    },
    include: {
      applicationSnapshot: { select: { name: true, prefix: true } },
      assignees: { include: { resourceSnapshot: true } },
    },
  });

  await logAudit({
    entity: "Task",
    entityId: task.id,
    action: "CREATE",
    userId: session.user.id,
    newValues: { key, title: task.title, status: task.status },
  });

  return NextResponse.json({ data: task }, { status: 201 });
});
