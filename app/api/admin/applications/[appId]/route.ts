import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError, NotFoundError, ConflictError, ValidationError } from "@/lib/errors";
import { UpdateApplicationSchema } from "@/lib/validations/application";

// PATCH /api/admin/applications/[appId] — GlobalApplication aktualisieren
export const PATCH = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const existing = await prisma.globalApplication.findUnique({ where: { id: params.appId } });
  if (!existing) throw new NotFoundError("Applikation");

  const body = await req.json();
  const result = UpdateApplicationSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  const updated = await prisma.globalApplication.update({
    where: { id: params.appId },
    data: result.data,
  });

  return NextResponse.json({ data: updated });
});

// DELETE /api/admin/applications/[appId] — GlobalApplication löschen
export const DELETE = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const existing = await prisma.globalApplication.findUnique({
    where: { id: params.appId },
    include: { _count: { select: { applicationSnapshots: true } } },
  });
  if (!existing) throw new NotFoundError("Applikation");

  if (existing._count.applicationSnapshots > 0) {
    throw new ConflictError(
      "Diese Applikation ist einem oder mehreren Releases zugewiesen und kann nicht gelöscht werden."
    );
  }

  await prisma.globalApplication.delete({ where: { id: params.appId } });

  return new NextResponse(null, { status: 204 });
});
