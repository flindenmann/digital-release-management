import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError, NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { CreateMilestoneSchema } from "@/lib/validations/milestone";
import { generateMilestoneKey } from "@/lib/milestone-key";

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

// GET /api/releases/[id]/milestones
export const GET = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const role = await getRole(params.id, session.user.id);
  if (!can(role, "milestone:view")) throw new ForbiddenError();

  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get("archived") === "true";

  const milestones = await prisma.milestone.findMany({
    where: {
      releaseId: params.id,
      ...(!includeArchived ? { status: { not: "ARCHIVED" } } : {}),
    },
    include: MILESTONE_INCLUDE,
    orderBy: { dateTime: "asc" },
  });

  return NextResponse.json({ data: milestones });
});

// POST /api/releases/[id]/milestones
export const POST = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const role = await getRole(params.id, session.user.id);
  if (!can(role, "milestone:edit")) throw new ForbiddenError();

  const body = await req.json();
  const result = CreateMilestoneSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  // ApplicationSnapshot muss zu diesem Release gehören
  const appSnapshot = await prisma.applicationSnapshot.findFirst({
    where: { id: result.data.applicationSnapshotId, releaseId: params.id },
  });
  if (!appSnapshot) throw new NotFoundError("Applikation");

  // Wenn responsibleId gesetzt: sicherstellen, dass der Snapshot zu diesem Release gehört
  if (result.data.responsibleId) {
    const snapshot = await prisma.resourceSnapshot.findFirst({
      where: { id: result.data.responsibleId, releaseId: params.id },
    });
    if (!snapshot) throw new NotFoundError("Ressource");
  }

  const { key } = await generateMilestoneKey(params.id);

  const milestone = await prisma.milestone.create({
    data: {
      ...result.data,
      key,
      releaseId: params.id,
    },
    include: MILESTONE_INCLUDE,
  });

  await logAudit({
    entity: "Milestone",
    entityId: milestone.id,
    action: "CREATE",
    userId: session.user.id,
    newValues: { key, title: milestone.title, dateTime: milestone.dateTime, isFixed: milestone.isFixed },
  });

  return NextResponse.json({ data: milestone }, { status: 201 });
});
