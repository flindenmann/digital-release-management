import { prisma } from "@/lib/prisma";

/**
 * Generiert den nächsten Task-Key für einen ApplicationSnapshot.
 * Format: "{PREFIX}-{4-stellige laufende Nummer}" — z.B. "SYR-0042"
 *
 * Der taskCounter auf ApplicationSnapshot wird atomar inkrementiert,
 * damit bei gleichzeitigen Requests keine doppelten Keys entstehen.
 */
export async function generateTaskKey(applicationSnapshotId: string): Promise<{
  key: string;
  updatedSnapshot: { prefix: string; taskCounter: number };
}> {
  const updated = await prisma.applicationSnapshot.update({
    where: { id: applicationSnapshotId },
    data: { taskCounter: { increment: 1 } },
    select: { prefix: true, taskCounter: true },
  });

  const key = `${updated.prefix}-${String(updated.taskCounter).padStart(4, "0")}`;
  return { key, updatedSnapshot: updated };
}
