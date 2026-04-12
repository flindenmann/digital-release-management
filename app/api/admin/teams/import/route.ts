import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { z } from "zod";

const ImportRowSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich.").max(100),
  description: z.string().max(500).optional(),
});

const ImportBodySchema = z.object({
  rows: z.array(z.record(z.string())).min(1).max(500),
});

// POST /api/admin/teams/import
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const body = await req.json();
  const parsed = ImportBodySchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Ungültige Eingabe.");

  const results: { index: number; success: boolean; error?: string }[] = [];

  for (let i = 0; i < parsed.data.rows.length; i++) {
    const raw = parsed.data.rows[i];

    const normalized = {
      name: (raw.name ?? "").trim(),
      description: (raw.description ?? "").trim() || undefined,
    };

    const rowResult = ImportRowSchema.safeParse(normalized);
    if (!rowResult.success) {
      results.push({
        index: i,
        success: false,
        error: rowResult.error.issues.map((e) => e.message).join(", "),
      });
      continue;
    }

    try {
      const existing = await prisma.team.findUnique({ where: { name: rowResult.data.name } });
      if (existing) {
        results.push({ index: i, success: false, error: `Team "${rowResult.data.name}" existiert bereits.` });
        continue;
      }

      await prisma.team.create({ data: rowResult.data });
      results.push({ index: i, success: true });
    } catch {
      results.push({ index: i, success: false, error: "Datenbankfehler beim Erstellen." });
    }
  }

  return NextResponse.json({ results });
});
