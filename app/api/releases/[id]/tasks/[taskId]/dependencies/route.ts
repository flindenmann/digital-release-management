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
import { z } from "zod";
import { DependencyType } from "@prisma/client";

const CreateDependencySchema = z
  .object({
    predecessorId: z.string().min(1).optional(),
    predecessorMilestoneId: z.string().min(1).optional(),
    type: z.nativeEnum(DependencyType).default("FS"),
  })
  .refine(
    (d) => Boolean(d.predecessorId) !== Boolean(d.predecessorMilestoneId),
    { message: "Entweder predecessorId (Task) oder predecessorMilestoneId muss gesetzt sein, aber nicht beide." }
  );

async function getTaskAndRole(releaseId: string, taskId: string, userId: string) {
  const projectUser = await prisma.projectUser.findUnique({
    where: { releaseId_userId: { releaseId, userId } },
  });
  if (!projectUser) throw new NotFoundError("Release");

  const task = await prisma.task.findFirst({ where: { id: taskId, releaseId } });
  if (!task) throw new NotFoundError("Task");

  return { task, role: projectUser.role };
}

// GET /api/releases/[id]/tasks/[taskId]/dependencies
export const GET = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  await getTaskAndRole(params.id, params.taskId, session.user.id);

  const [taskPredecessors, milestonePredecessors, successors] = await Promise.all([
    prisma.taskDependency.findMany({
      where: { successorId: params.taskId },
      include: {
        predecessor: {
          select: { id: true, key: true, title: true, status: true, isMilestone: true, startAt: true, endAt: true },
        },
      },
    }),
    prisma.taskMilestoneDependency.findMany({
      where: { taskId: params.taskId },
      include: {
        milestone: {
          select: { id: true, key: true, title: true, status: true, dateTime: true },
        },
      },
    }),
    prisma.taskDependency.findMany({
      where: { predecessorId: params.taskId },
      include: {
        successor: {
          select: { id: true, key: true, title: true, status: true, startAt: true, endAt: true },
        },
      },
    }),
  ]);

  return NextResponse.json({ data: { taskPredecessors, milestonePredecessors, successors } });
});

// POST /api/releases/[id]/tasks/[taskId]/dependencies
export const POST = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const { role } = await getTaskAndRole(params.id, params.taskId, session.user.id);
  if (!can(role, "task:edit")) throw new ForbiddenError();

  const body = await req.json();
  const result = CreateDependencySchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  const { predecessorId, predecessorMilestoneId, type } = result.data;

  // ── Meilenstein als Vorgänger ───────────────────────────────────────────────
  if (predecessorMilestoneId) {
    const milestone = await prisma.milestone.findFirst({
      where: { id: predecessorMilestoneId, releaseId: params.id },
    });
    if (!milestone) throw new NotFoundError("Meilenstein");

    const existing = await prisma.taskMilestoneDependency.findUnique({
      where: { taskId_milestoneId: { taskId: params.taskId, milestoneId: predecessorMilestoneId } },
    });
    if (existing) throw new ConflictError("Diese Abhängigkeit existiert bereits.");

    const dep = await prisma.taskMilestoneDependency.create({
      data: { taskId: params.taskId, milestoneId: predecessorMilestoneId, type },
      include: {
        milestone: {
          select: { id: true, key: true, title: true, status: true, dateTime: true },
        },
      },
    });

    return NextResponse.json({ data: dep }, { status: 201 });
  }

  // ── Task als Vorgänger ──────────────────────────────────────────────────────
  if (predecessorId === params.taskId) {
    throw new ValidationError("Ein Task kann nicht von sich selbst abhängen.");
  }

  const predecessor = await prisma.task.findFirst({
    where: { id: predecessorId!, releaseId: params.id },
  });
  if (!predecessor) throw new NotFoundError("Vorgänger-Task");

  const reverse = await prisma.taskDependency.findUnique({
    where: { predecessorId_successorId: { predecessorId: params.taskId, successorId: predecessorId! } },
  });
  if (reverse) throw new ConflictError("Diese Abhängigkeit würde einen Zyklus erzeugen.");

  const existing = await prisma.taskDependency.findUnique({
    where: { predecessorId_successorId: { predecessorId: predecessorId!, successorId: params.taskId } },
  });
  if (existing) throw new ConflictError("Diese Abhängigkeit existiert bereits.");

  const dep = await prisma.taskDependency.create({
    data: { predecessorId: predecessorId!, successorId: params.taskId, type },
    include: {
      predecessor: {
        select: { id: true, key: true, title: true, status: true, isMilestone: true, startAt: true, endAt: true },
      },
    },
  });

  return NextResponse.json({ data: dep }, { status: 201 });
});

// DELETE /api/releases/[id]/tasks/[taskId]/dependencies?predecessorId=xxx | ?predecessorMilestoneId=xxx
export const DELETE = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const { role } = await getTaskAndRole(params.id, params.taskId, session.user.id);
  if (!can(role, "task:edit")) throw new ForbiddenError();

  const { searchParams } = new URL(req.url);
  const predecessorId = searchParams.get("predecessorId");
  const predecessorMilestoneId = searchParams.get("predecessorMilestoneId");

  if (predecessorMilestoneId) {
    const dep = await prisma.taskMilestoneDependency.findUnique({
      where: { taskId_milestoneId: { taskId: params.taskId, milestoneId: predecessorMilestoneId } },
    });
    if (!dep) throw new NotFoundError("Abhängigkeit");
    await prisma.taskMilestoneDependency.delete({
      where: { taskId_milestoneId: { taskId: params.taskId, milestoneId: predecessorMilestoneId } },
    });
    return new NextResponse(null, { status: 204 });
  }

  if (predecessorId) {
    const dep = await prisma.taskDependency.findUnique({
      where: { predecessorId_successorId: { predecessorId, successorId: params.taskId } },
    });
    if (!dep) throw new NotFoundError("Abhängigkeit");
    await prisma.taskDependency.delete({
      where: { predecessorId_successorId: { predecessorId, successorId: params.taskId } },
    });
    return new NextResponse(null, { status: 204 });
  }

  throw new ValidationError("predecessorId oder predecessorMilestoneId ist erforderlich.");
});
