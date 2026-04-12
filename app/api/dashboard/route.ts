import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { UnauthorizedError } from "@/lib/errors";
import { TaskStatus } from "@prisma/client";

// GET /api/dashboard — aggregierte Release-Statistiken für den eingeloggten User
export const GET = withErrorHandling(async (_req: NextRequest) => {
  const session = await getServerSession(authOptions);
  if (!session) throw new UnauthorizedError();

  // 1. Releases des Users laden
  const releases = await prisma.release.findMany({
    where: { projectUsers: { some: { userId: session.user.id } } },
    include: {
      projectUsers: {
        where: { userId: session.user.id },
        select: { role: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (releases.length === 0) {
    return NextResponse.json({ data: { releases: [], summary: { totalReleases: 0, totalOpen: 0, totalPlanned: 0, totalDone: 0, upcomingMilestonesCount: 0 } } });
  }

  const releaseIds = releases.map((r) => r.id);

  // 2. Task-Counts nach Status (gruppiert pro Release)
  const taskGroups = await prisma.task.groupBy({
    by: ["releaseId", "status"],
    where: {
      releaseId: { in: releaseIds },
      isMilestone: false,
    },
    _count: { _all: true },
  });

  // 3. Nächster Meilenstein pro Release (frühestes Datum >= heute, nicht archiviert)
  const now = new Date();
  const upcomingMilestones = await prisma.milestone.findMany({
    where: {
      releaseId: { in: releaseIds },
      status: { not: "ARCHIVED" },
      dateTime: { gte: now },
    },
    select: { id: true, releaseId: true, title: true, dateTime: true, status: true },
    orderBy: { dateTime: "asc" },
  });

  // Frühester Meilenstein pro Release
  const nextMilestoneByRelease = new Map<string, typeof upcomingMilestones[0]>();
  for (const m of upcomingMilestones) {
    if (!nextMilestoneByRelease.has(m.releaseId)) {
      nextMilestoneByRelease.set(m.releaseId, m);
    }
  }

  // Meilensteine in den nächsten 7 Tagen (über alle Releases)
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const upcomingMilestonesCount = upcomingMilestones.filter(
    (m) => m.dateTime <= in7days
  ).length;

  // 4. Pro Release zusammenführen
  const statusCountsByRelease = new Map<string, Record<TaskStatus, number>>();
  for (const group of taskGroups) {
    if (!statusCountsByRelease.has(group.releaseId)) {
      statusCountsByRelease.set(group.releaseId, { OPEN: 0, PLANNED: 0, DONE: 0, ARCHIVED: 0 });
    }
    statusCountsByRelease.get(group.releaseId)![group.status] = group._count._all;
  }

  const enrichedReleases = releases.map((release) => {
    const counts = statusCountsByRelease.get(release.id) ?? { OPEN: 0, PLANNED: 0, DONE: 0, ARCHIVED: 0 };
    const total = counts.OPEN + counts.PLANNED + counts.DONE + counts.ARCHIVED;
    const totalActive = counts.OPEN + counts.PLANNED + counts.DONE;
    const progress = totalActive > 0 ? Math.round((counts.DONE / totalActive) * 100) : 0;

    return {
      id: release.id,
      name: release.name,
      description: release.description,
      createdAt: release.createdAt,
      role: release.projectUsers[0]?.role ?? null,
      taskCounts: counts,
      totalTasks: total,
      progress,
      nextMilestone: nextMilestoneByRelease.get(release.id) ?? null,
    };
  });

  // 5. Summary über alle Releases
  let totalOpen = 0, totalPlanned = 0, totalDone = 0;
  for (const r of enrichedReleases) {
    totalOpen    += r.taskCounts.OPEN;
    totalPlanned += r.taskCounts.PLANNED;
    totalDone    += r.taskCounts.DONE;
  }

  return NextResponse.json({
    data: {
      releases: enrichedReleases,
      summary: {
        totalReleases: releases.length,
        totalOpen,
        totalPlanned,
        totalDone,
        upcomingMilestonesCount,
      },
    },
  });
});
