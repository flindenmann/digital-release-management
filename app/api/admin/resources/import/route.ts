import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { z } from "zod";

const ImportRowSchema = z.object({
  firstName: z.string().min(1, "Vorname ist erforderlich.").max(100),
  lastName: z.string().min(1, "Nachname ist erforderlich.").max(100),
  email: z.string().email("Ungültige E-Mail-Adresse.").max(200),
  username: z
    .string()
    .min(2, "Benutzername muss mindestens 2 Zeichen lang sein.")
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, "Benutzername: nur Buchstaben, Ziffern, '.', '_', '-'."),
  initialPassword: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein."),
  function: z.string().max(100).optional(),
  phone: z.string().max(50).optional(),
  teamName: z.string().min(1).max(100).optional(),
});

const ImportBodySchema = z.object({
  rows: z.array(z.record(z.string())).min(1).max(500),
});

// POST /api/admin/resources/import
export const POST = withErrorHandling(async (req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  const body = await req.json();
  const parsed = ImportBodySchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Ungültige Eingabe.");

  const results: { index: number; success: boolean; error?: string }[] = [];

  // Cache teams to avoid repeated DB calls
  const teamCache = new Map<string, string>();

  for (let i = 0; i < parsed.data.rows.length; i++) {
    const raw = parsed.data.rows[i];

    const normalized = {
      firstName: (raw.firstName ?? "").trim(),
      lastName: (raw.lastName ?? "").trim(),
      email: (raw.email ?? "").trim().toLowerCase(),
      username: (raw.username ?? "").trim(),
      initialPassword: (raw.initialPassword ?? "").trim(),
      function: (raw.function ?? "").trim() || undefined,
      phone: (raw.phone ?? "").trim() || undefined,
      teamName: (raw.teamName ?? "").trim() || undefined,
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
      // Check uniqueness
      const existingUser = await prisma.user.findFirst({
        where: { OR: [{ email: rowResult.data.email }, { username: rowResult.data.username }] },
      });
      if (existingUser) {
        const field = existingUser.email === rowResult.data.email ? "E-Mail" : "Benutzername";
        results.push({ index: i, success: false, error: `${field} "${existingUser.email === rowResult.data.email ? rowResult.data.email : rowResult.data.username}" bereits vergeben.` });
        continue;
      }

      // Resolve team
      let teamId: string | null = null;
      if (rowResult.data.teamName) {
        if (teamCache.has(rowResult.data.teamName)) {
          teamId = teamCache.get(rowResult.data.teamName)!;
        } else {
          const team = await prisma.team.upsert({
            where: { name: rowResult.data.teamName },
            update: {},
            create: { name: rowResult.data.teamName },
          });
          teamId = team.id;
          teamCache.set(rowResult.data.teamName, team.id);
        }
      }

      const passwordHash = await bcrypt.hash(rowResult.data.initialPassword, 12);

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: rowResult.data.email,
            username: rowResult.data.username,
            firstName: rowResult.data.firstName,
            lastName: rowResult.data.lastName,
            function: rowResult.data.function ?? null,
            phone: rowResult.data.phone ?? null,
            passwordHash,
            mustChangePassword: true,
          },
        });
        await tx.globalResource.create({ data: { userId: user.id, teamId } });
      });

      results.push({ index: i, success: true });
    } catch {
      results.push({ index: i, success: false, error: "Datenbankfehler beim Erstellen." });
    }
  }

  return NextResponse.json({ results });
});
