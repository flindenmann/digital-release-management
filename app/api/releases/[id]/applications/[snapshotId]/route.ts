import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError, NotFoundError, ForbiddenError, ConflictError } from "@/lib/errors";
import { can } from "@/lib/permissions";

async function getRole(releaseId: string, userId: string) {
  const projectUser = await prisma.projectUser.findUnique({
    where: { releaseId_userId: { releaseId, userId } },
  });
  if (!projectUser) throw new NotFoundError("Release");
  return projectUser.role;
}

// DELETE /api/releases/[id]/applications/[snapshotId] — Zuweisung aufheben
export const DELETE = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const role = await getRole(params.id, session.user.id);
  if (!can(role, "release:manage")) throw new ForbiddenError();

  const snapshot = await prisma.applicationSnapshot.findUnique({
    where: { id: params.snapshotId },
    include: { _count: { select: { tasks: true } } },
  });

  if (!snapshot || snapshot.releaseId !== params.id) throw new NotFoundError("Applikation");

  if (snapshot._count.tasks > 0) {
    throw new ConflictError(
      `Diese Applikation hat noch ${snapshot._count.tasks} Task(s) in diesem Release und kann nicht entfernt werden.`
    );
  }

  await prisma.applicationSnapshot.delete({ where: { id: params.snapshotId } });

  return new NextResponse(null, { status: 204 });
});
