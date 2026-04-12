import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { assertTaskAccess } from "@/lib/api/assertTaskAccess";
import { UnauthorizedError } from "@/lib/errors";

// GET /api/releases/[id]/tasks/[taskId]/history
export const GET = withErrorHandling(async (_req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  await assertTaskAccess(params.id, params.taskId, session.user.id);

  const logs = await prisma.auditLog.findMany({
    where: { entity: "Task", entityId: params.taskId },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: logs });
});
