"use client";

import Link from "next/link";
import { useReleases } from "@/hooks/useReleases";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TaskStatus, ProjectRole } from "@prisma/client";

const ROLE_LABEL: Record<ProjectRole, string> = {
  RELEASE_MANAGER: "Release Manager",
  SACHBEARBEITER:  "Sachbearbeiter",
  MANAGER:         "Manager",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  OPEN:     "bg-gray-200 text-gray-700",
  PLANNED:  "bg-yellow-100 text-yellow-800",
  DONE:     "bg-green-100 text-green-800",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

export default function DashboardPage() {
  const { data, isLoading, isError } = useReleases();
  const releases = data?.data ?? [];

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 rounded-lg border bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Fehler beim Laden der Releases.
        </div>
      )}

      {!isLoading && !isError && releases.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Noch keine Releases vorhanden.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Ein Release Manager kann über die API ein neues Release anlegen.
          </p>
        </div>
      )}

      {!isLoading && !isError && releases.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {releases.map((release: any) => {
            const role: ProjectRole = release.projectUsers?.[0]?.role;
            const taskCount = release._count?.tasks ?? 0;
            const milestoneCount = release._count?.milestones ?? 0;

            return (
              <div
                key={release.id}
                className="rounded-lg border bg-card p-5 flex flex-col gap-4 hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h2 className="font-semibold text-base leading-tight">{release.name}</h2>
                    {role && (
                      <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                        {ROLE_LABEL[role]}
                      </span>
                    )}
                  </div>
                  {release.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {release.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{taskCount} Task{taskCount !== 1 ? "s" : ""}</span>
                  <span>{milestoneCount} Meilenstein{milestoneCount !== 1 ? "e" : ""}</span>
                </div>

                <div className="flex gap-2 mt-auto">
                  <Button asChild size="sm" className="flex-1">
                    <Link href={`/releases/${release.id}/tasks`}>Tasks</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link href={`/releases/${release.id}/milestones`}>Meilensteine</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
