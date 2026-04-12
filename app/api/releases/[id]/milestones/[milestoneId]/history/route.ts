import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError, NotFoundError } from "@/lib/errors";

// GET /api/releases/[id]/milestones/[milestoneId]/history
export const GET = withErrorHandling(async (_req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  // Zugriff prüfen: User muss Mitglied des Releases sein
  const projectUser = await prisma.projectUser.findUnique({
    where: { releaseId_userId: { releaseId: params.id, userId: session.user.id } },
  });
  if (!projectUser) throw new NotFoundError("Release");

  const logs = await prisma.auditLog.findMany({
    where: { entity: "Milestone", entityId: params.milestoneId },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: logs });
});
