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

const CreateMilestoneDependencySchema = z
  .object({
    taskId: z.string().min(1).optional(),
    predecessorMilestoneId: z.string().min(1).optional(),
    type: z.nativeEnum(DependencyType).default("FS"),
  })
  .refine(
    (d) => Boolean(d.taskId) !== Boolean(d.predecessorMilestoneId),
    { message: "Entweder taskId oder predecessorMilestoneId muss gesetzt sein, aber nicht beide." }
  );

async function getRoleAndMilestone(releaseId: string, milestoneId: string, userId: string) {
  const projectUser = await prisma.projectUser.findUnique({
    where: { releaseId_userId: { releaseId, userId } },
  });
  if (!projectUser) throw new NotFoundError("Release");

  const milestone = await prisma.milestone.findFirst({
    where: { id: milestoneId, releaseId },
  });
  if (!milestone) throw new NotFoundError("Meilenstein");

  return { milestone, role: projectUser.role };
}

// GET /api/releases/[id]/milestones/[milestoneId]/dependencies
export const GET = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  await getRoleAndMilestone(params.id, params.milestoneId, session.user.id);

  const predecessors = await prisma.milestoneDependency.findMany({
    where: { milestoneId: params.milestoneId },
    include: {
      task: {
        select: { id: true, key: true, title: true, status: true, startAt: true, endAt: true },
      },
      predecessorMilestone: {
        select: { id: true, title: true, dateTime: true, status: true },
      },
    },
  });

  return NextResponse.json({ data: { predecessors } });
});

// POST /api/releases/[id]/milestones/[milestoneId]/dependencies
export const POST = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const { role } = await getRoleAndMilestone(params.id, params.milestoneId, session.user.id);
  if (!can(role, "milestone:edit")) throw new ForbiddenError();

  const body = await req.json();
  const result = CreateMilestoneDependencySchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  const { taskId, predecessorMilestoneId, type } = result.data;

  if (predecessorMilestoneId === params.milestoneId) {
    throw new ValidationError("Ein Meilenstein kann nicht von sich selbst abhängen.");
  }

  // Vorgänger-Task muss im selben Release liegen
  if (taskId) {
    const task = await prisma.task.findFirst({
      where: { id: taskId, releaseId: params.id },
    });
    if (!task) throw new NotFoundError("Task");
  }

  // Vorgänger-Meilenstein muss im selben Release liegen
  if (predecessorMilestoneId) {
    const predMs = await prisma.milestone.findFirst({
      where: { id: predecessorMilestoneId, releaseId: params.id },
    });
    if (!predMs) throw new NotFoundError("Vorgänger-Meilenstein");

    // Zirkuläre Abhängigkeit prüfen (direkte Umkehrung)
    const reverse = await prisma.milestoneDependency.findFirst({
      where: {
        milestoneId: predecessorMilestoneId,
        predecessorMilestoneId: params.milestoneId,
      },
    });
    if (reverse) throw new ConflictError("Diese Abhängigkeit würde einen Zyklus erzeugen.");
  }

  // Doppelt prüfen
  const existing = await prisma.milestoneDependency.findFirst({
    where: {
      milestoneId: params.milestoneId,
      ...(taskId ? { taskId } : { predecessorMilestoneId }),
    },
  });
  if (existing) throw new ConflictError("Diese Abhängigkeit existiert bereits.");

  const dep = await prisma.milestoneDependency.create({
    data: {
      milestoneId: params.milestoneId,
      taskId: taskId ?? null,
      predecessorMilestoneId: predecessorMilestoneId ?? null,
      type,
    },
    include: {
      task: {
        select: { id: true, key: true, title: true, status: true, startAt: true, endAt: true },
      },
      predecessorMilestone: {
        select: { id: true, title: true, dateTime: true, status: true },
      },
    },
  });

  return NextResponse.json({ data: dep }, { status: 201 });
});

// DELETE /api/releases/[id]/milestones/[milestoneId]/dependencies?depId=xxx
export const DELETE = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const { role } = await getRoleAndMilestone(params.id, params.milestoneId, session.user.id);
  if (!can(role, "milestone:edit")) throw new ForbiddenError();

  const { searchParams } = new URL(req.url);
  const depId = searchParams.get("depId");
  if (!depId) throw new ValidationError("depId ist erforderlich.");

  const dep = await prisma.milestoneDependency.findFirst({
    where: { id: depId, milestoneId: params.milestoneId },
  });
  if (!dep) throw new NotFoundError("Abhängigkeit");

  await prisma.milestoneDependency.delete({ where: { id: depId } });

  return new NextResponse(null, { status: 204 });
});
