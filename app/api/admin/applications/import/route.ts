import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { z } from "zod";

const ImportRowSchema = z.object({
  prefix: z
    .string()
    .min(1, "Prefix ist erforderlich.")
    .max(10)
    .regex(/^[A-Z0-9]+$/, "Prefix darf nur Grossbuchstaben und Ziffern enthalten."),
  name: z.string().min(1, "Name ist erforderlich.").max(100),
  description: z.string().max(1000).optional(),
});

const ImportBodySchema = z.object({
  rows: z.array(z.record(z.string())).min(1).max(500),
});

// POST /api/admin/applications/import
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const body = await req.json();
  const parsed = ImportBodySchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Ungültige Eingabe.");

  const results: { index: number; success: boolean; error?: string }[] = [];

  for (let i = 0; i < parsed.data.rows.length; i++) {
    const raw = parsed.data.rows[i];

    // Normalize: trim whitespace, uppercase prefix
    const normalized = {
      prefix: (raw.prefix ?? "").trim().toUpperCase(),
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
      const existing = await prisma.globalApplication.findUnique({
        where: { prefix: rowResult.data.prefix },
      });
      if (existing) {
        results.push({ index: i, success: false, error: `Prefix "${rowResult.data.prefix}" existiert bereits.` });
        continue;
      }

      await prisma.globalApplication.create({ data: rowResult.data });
      results.push({ index: i, success: true });
    } catch {
      results.push({ index: i, success: false, error: "Datenbankfehler beim Erstellen." });
    }
  }

  return NextResponse.json({ results });
});
