import { ProjectRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { canViewAllTasks } from "@/lib/permissions";

/**
 * Prüft, ob der User Zugriff auf einen bestimmten Task hat.
 *
 * - Release-Mitgliedschaft wird immer geprüft.
 * - SACHBEARBEITER (keine task:view:all-Berechtigung) dürfen nur Tasks lesen/bearbeiten,
 *   bei denen sie als Assignee über ihre stabile userId (GlobalResource.userId) eingetragen sind.
 *
 * @returns role — Rolle des Users im Release
 */
export async function assertTaskAccess(
  releaseId: string,
  taskId: string,
  userId: string
): Promise<{ role: ProjectRole }> {
  const projectUser = await prisma.projectUser.findUnique({
    where: { releaseId_userId: { releaseId, userId } },
  });
  if (!projectUser) throw new NotFoundError("Release");

  const task = await prisma.task.findFirst({ where: { id: taskId, releaseId } });
  if (!task) throw new NotFoundError("Task");

  if (!canViewAllTasks(projectUser.role)) {
    const isAssigned = await prisma.taskAssignee.findFirst({
      where: {
        taskId,
        resourceSnapshot: { globalResource: { userId } },
      },
    });
    if (!isAssigned) throw new ForbiddenError();
  }

  return { role: projectUser.role };
}
