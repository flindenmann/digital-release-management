import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";

/**
 * Wirft ForbiddenError, wenn der User kein RELEASE_MANAGER in irgendeinem Release ist.
 * Wird von allen /api/admin/* Routen genutzt, die keine eigene Release-Kontext haben.
 */
export async function requireGlobalAdmin(userId: string): Promise<void> {
  const entry = await prisma.projectUser.findFirst({
    where: { userId, role: "RELEASE_MANAGER" },
  });
  if (!entry) throw new ForbiddenError();
}
