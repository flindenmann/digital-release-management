import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { assertTaskAccess } from "@/lib/api/assertTaskAccess";
import { UnauthorizedError, ForbiddenError, ValidationError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { z } from "zod";

const CreateAttachmentSchema = z.object({
  name: z.string().min(1, "Name darf nicht leer sein.").max(200),
  url: z.string().url("Ungültige URL."),
});

// GET /api/releases/[id]/tasks/[taskId]/attachments
export const GET = withErrorHandling(async (_req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  await assertTaskAccess(params.id, params.taskId, session.user.id);

  const attachments = await prisma.taskAttachment.findMany({
    where: { taskId: params.taskId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ data: attachments });
});

// POST /api/releases/[id]/tasks/[taskId]/attachments
export const POST = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const { role } = await assertTaskAccess(params.id, params.taskId, session.user.id);
  if (!can(role, "task:edit")) throw new ForbiddenError();

  const body = await req.json();
  const result = CreateAttachmentSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  const attachment = await prisma.taskAttachment.create({
    data: {
      taskId: params.taskId,
      name: result.data.name,
      url: result.data.url,
      type: "LINK",
    },
  });

  return NextResponse.json({ data: attachment }, { status: 201 });
});
