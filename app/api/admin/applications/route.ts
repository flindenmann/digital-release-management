import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { requireGlobalAdmin } from "@/lib/api/requireGlobalAdmin";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { CreateApplicationSchema } from "@/lib/validations/application";

// GET /api/admin/applications — alle GlobalApplications
export const GET = withErrorHandling(async (_req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();
  await requireGlobalAdmin(session.user.id);

  const applications = await prisma.globalApplication.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { applicationSnapshots: true } },
    },
  });

  return NextResponse.json({ data: applications });
});

// POST /api/admin/applications — neue GlobalApplication erstellen
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();
  await requireGlobalAdmin(session.user.id);

  const body = await req.json();
  const result = CreateApplicationSchema.safeParse(body);
  if (!result.success) {
    throw new ValidationError("Ungültige Eingabe.", { issues: result.error.issues });
  }

  const application = await prisma.globalApplication.create({
    data: result.data,
  });

  return NextResponse.json({ data: application }, { status: 201 });
});
