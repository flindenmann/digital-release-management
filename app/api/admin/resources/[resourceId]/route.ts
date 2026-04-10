import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError, NotFoundError, ConflictError, ValidationError } from "@/lib/errors";
import { UpdateGlobalResourceSchema } from "@/lib/validations/resource";

// PATCH /api/admin/resources/[resourceId] — Team-Zuweisung aktualisieren
export const PATCH = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const existing = await prisma.globalResource.findUnique({ where: { id: params.resourceId } });
  if (!existing) throw new NotFoundError("Ressource");

  const body = await req.json();
  const result = UpdateGlobalResourceSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  const { teamName } = result.data;

  let teamId: string | null = existing.teamId;
  if (teamName !== undefined) {
    if (!teamName) {
      teamId = null;
    } else {
      const team = await prisma.team.upsert({
        where: { name: teamName },
        update: {},
        create: { name: teamName },
      });
      teamId = team.id;
    }
  }

  const updated = await prisma.globalResource.update({
    where: { id: params.resourceId },
    data: { teamId },
    select: {
      id: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          function: true,
          phone: true,
          username: true,
        },
      },
      team: { select: { id: true, name: true } },
      _count: { select: { resourceSnapshots: true } },
    },
  });

  return NextResponse.json({ data: updated });
});

// DELETE /api/admin/resources/[resourceId] — GlobalResource löschen
export const DELETE = withErrorHandling(async (req: NextRequest, { params }) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const existing = await prisma.globalResource.findUnique({
    where: { id: params.resourceId },
    include: { _count: { select: { resourceSnapshots: true } } },
  });
  if (!existing) throw new NotFoundError("Ressource");

  if (existing._count.resourceSnapshots > 0) {
    throw new ConflictError(
      "Diese Ressource ist einem oder mehreren Releases zugewiesen und kann nicht gelöscht werden."
    );
  }

  await prisma.globalResource.delete({ where: { id: params.resourceId } });

  return new NextResponse(null, { status: 204 });
});
