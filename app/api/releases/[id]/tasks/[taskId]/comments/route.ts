import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { assertTaskAccess } from "@/lib/api/assertTaskAccess";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { z } from "zod";

const CreateCommentSchema = z.object({
  content: z.string().min(1, "Kommentar darf nicht leer sein.").max(4000),
});

// GET /api/releases/[id]/tasks/[taskId]/comments
export const GET = withErrorHandling(async (_req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  await assertTaskAccess(params.id, params.taskId, session.user.id);

  const comments = await prisma.taskComment.findMany({
    where: { taskId: params.taskId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ data: comments });
});

// POST /api/releases/[id]/tasks/[taskId]/comments
export const POST = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  await assertTaskAccess(params.id, params.taskId, session.user.id);

  const body = await req.json();
  const result = CreateCommentSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  const comment = await prisma.taskComment.create({
    data: {
      taskId: params.taskId,
      userId: session.user.id,
      content: result.data.content,
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json({ data: comment }, { status: 201 });
});
