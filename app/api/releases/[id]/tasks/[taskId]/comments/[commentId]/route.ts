import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError, NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { z } from "zod";

const UpdateCommentSchema = z.object({
  content: z.string().min(1).max(4000),
});

async function getCommentAndRole(releaseId: string, commentId: string, userId: string) {
  const pu = await prisma.projectUser.findUnique({
    where: { releaseId_userId: { releaseId, userId } },
  });
  if (!pu) throw new NotFoundError("Release");

  const comment = await prisma.taskComment.findUnique({ where: { id: commentId } });
  if (!comment) throw new NotFoundError("Kommentar");

  return { comment, role: pu.role };
}

// PATCH /api/releases/[id]/tasks/[taskId]/comments/[commentId]
export const PATCH = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const { comment } = await getCommentAndRole(params.id, params.commentId, session.user.id);

  if (comment.userId !== session.user.id) throw new ForbiddenError();

  const body = await req.json();
  const result = UpdateCommentSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  const updated = await prisma.taskComment.update({
    where: { id: params.commentId },
    data: { content: result.data.content },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json({ data: updated });
});

// DELETE /api/releases/[id]/tasks/[taskId]/comments/[commentId]
export const DELETE = withErrorHandling(async (_req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const { comment, role } = await getCommentAndRole(params.id, params.commentId, session.user.id);

  // Eigene Kommentare oder Release Manager darf löschen
  const canDelete = comment.userId === session.user.id || role === "RELEASE_MANAGER";
  if (!canDelete) throw new ForbiddenError();

  await prisma.taskComment.delete({ where: { id: params.commentId } });

  return new NextResponse(null, { status: 204 });
});
