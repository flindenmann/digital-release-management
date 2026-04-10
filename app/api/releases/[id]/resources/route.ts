import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError, NotFoundError } from "@/lib/errors";

// GET /api/releases/[id]/resources — ResourceSnapshots eines Releases
export const GET = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const projectUser = await prisma.projectUser.findUnique({
    where: { releaseId_userId: { releaseId: params.id, userId: session.user.id } },
  });
  if (!projectUser) throw new NotFoundError("Release");

  const resources = await prisma.resourceSnapshot.findMany({
    where: { releaseId: params.id },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json({ data: resources });
});
