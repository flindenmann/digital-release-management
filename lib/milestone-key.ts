import { prisma } from "@/lib/prisma";

/**
 * Generiert den nächsten Meilenstein-Key für ein Release.
 * Format: "MS-{4-stellige laufende Nummer}" — z.B. "MS-0001"
 *
 * Der milestoneCounter auf Release wird atomar inkrementiert,
 * damit bei gleichzeitigen Requests keine doppelten Keys entstehen.
 */
export async function generateMilestoneKey(
  releaseId: string
): Promise<{ key: string }> {
  const updated = await prisma.release.update({
    where: { id: releaseId },
    data: { milestoneCounter: { increment: 1 } },
    select: { milestoneCounter: true },
  });

  const key = `MS-${String(updated.milestoneCounter).padStart(4, "0")}`;
  return { key };
}
