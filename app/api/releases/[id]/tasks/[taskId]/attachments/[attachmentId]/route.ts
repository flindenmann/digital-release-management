import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError, NotFoundError, ForbiddenError } from "@/lib/errors";
import { can } from "@/lib/permissions";

// DELETE /api/releases/[id]/tasks/[taskId]/attachments/[attachmentId]
export const DELETE = withErrorHandling(async (_req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const pu = await prisma.projectUser.findUnique({
    where: { releaseId_userId: { releaseId: params.id, userId: session.user.id } },
  });
  if (!pu) throw new NotFoundError("Release");
  if (!can(pu.role, "task:edit")) throw new ForbiddenError();

  const attachment = await prisma.taskAttachment.findUnique({ where: { id: params.attachmentId } });
  if (!attachment) throw new NotFoundError("Anhang");

  await prisma.taskAttachment.delete({ where: { id: params.attachmentId } });

  return new NextResponse(null, { status: 204 });
});
