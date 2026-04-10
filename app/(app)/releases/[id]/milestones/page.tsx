"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Plus, List, GitCommitHorizontal } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { useRelease } from "@/hooks/useRelease";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { StatusBadge } from "@/components/tasks/StatusBadge";
import { MilestoneTimeline } from "@/components/milestones/MilestoneTimeline";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";

interface MilestonesPageProps {
  params: { id: string };
}

type ViewMode = "table" | "timeline";

export default function MilestonesPage({ params }: MilestonesPageProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const { data: releaseData } = useRelease(params.id);
  const currentUserRole = releaseData?.data?.currentUserRole;

  const { data, isLoading, isError } = useTasks({ releaseId: params.id });
  const allTasks: any[] = data?.data ?? [];

  const milestones = allTasks.filter((t: any) => t.isMilestone === true);

  const filteredMilestones = showArchived
    ? milestones
    : milestones.filter((m: any) => m.status !== "ARCHIVED");

  const canCreate = Boolean(currentUserRole && can(currentUserRole, "task:create"));

  function handleNew() {
    setEditingTask(null);
    setDialogOpen(true);
  }

  function handleEdit(task: any) {
    setEditingTask(task);
    setDialogOpen(true);
  }

  function handleDialogClose() {
    setDialogOpen(false);
    setEditingTask(null);
  }

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Meilensteine</h1>
          {releaseData?.data && (
            <p className="text-sm text-muted-foreground mt-1">
              {releaseData.data.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {filteredMilestones.length} Meilenstein{filteredMilestones.length !== 1 ? "e" : ""}
          </span>
          {canCreate && (
            <Button size="sm" onClick={handleNew}>
              <Plus className="h-4 w-4 mr-1" />
              Neuer Meilenstein
            </Button>
          )}
        </div>
      </div>

      {/* Filter + Ansichts-Toggle */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowArchived((v) => !v)}
          className={`text-sm px-3 py-1 rounded-full border transition-colors ${
            showArchived
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-input text-muted-foreground hover:bg-muted"
          }`}
        >
          Archivierte {showArchived ? "ausblenden" : "anzeigen"}
        </button>

        {/* Ansichts-Toggle */}
        <div className="ml-auto flex items-center gap-1 rounded-lg border p-1 bg-muted/30">
          <button
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm transition-colors ${
              viewMode === "table"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Tabellenansicht"
          >
            <List className="h-3.5 w-3.5" />
            Tabelle
          </button>
          <button
            onClick={() => setViewMode("timeline")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm transition-colors ${
              viewMode === "timeline"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Zeitlinie"
          >
            <GitCommitHorizontal className="h-3.5 w-3.5" />
            Zeitlinie
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-9 rounded border bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Fehler beim Laden der Meilensteine. Bitte Seite neu laden.
        </div>
      )}

      {!isLoading && !isError && filteredMilestones.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Keine Meilensteine vorhanden.</p>
        </div>
      )}

      {/* ── Tabellenansicht ──────────────────────────────────────────────── */}
      {!isLoading && !isError && filteredMilestones.length > 0 && viewMode === "table" && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-muted-foreground">
                <th className="py-2 px-3 text-left font-medium whitespace-nowrap">Nr.</th>
                <th className="py-2 px-3 text-left font-medium whitespace-nowrap">Datum</th>
                <th className="py-2 px-3 text-left font-medium whitespace-nowrap">Uhrzeit</th>
                <th className="py-2 px-3 text-left font-medium whitespace-nowrap">Applikation</th>
                <th className="py-2 px-3 text-left font-medium">Titel</th>
                <th className="py-2 px-3 text-left font-medium whitespace-nowrap">Verantwortliche</th>
                <th className="py-2 px-3 text-left font-medium whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredMilestones.map((milestone: any) => {
                const dt = milestone.startAt ? new Date(milestone.startAt) : null;
                const dateStr = dt ? format(dt, "dd.MM.yyyy") : "–";
                const timeStr = dt ? format(dt, "HH:mm") : "–";
                const assignees =
                  milestone.assignees?.length > 0
                    ? milestone.assignees
                        .map((a: any) => `${a.resourceSnapshot.firstName} ${a.resourceSnapshot.lastName}`)
                        .join(", ")
                    : "–";
                return (
                  <tr
                    key={milestone.id}
                    className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleEdit(milestone)}
                  >
                    <td className="py-2 px-3 text-sm font-mono whitespace-nowrap text-muted-foreground">
                      {milestone.key}
                    </td>
                    <td className="py-2 px-3 text-sm font-bold whitespace-nowrap">{dateStr}</td>
                    <td className="py-2 px-3 text-sm font-bold whitespace-nowrap">{timeStr}</td>
                    <td className="py-2 px-3 text-sm whitespace-nowrap max-w-[160px] truncate">
                      {milestone.applicationSnapshot?.name ?? "–"}
                    </td>
                    <td className="py-2 px-3 text-sm">{milestone.title}</td>
                    <td className="py-2 px-3 text-sm whitespace-nowrap max-w-[180px] truncate">
                      {assignees}
                    </td>
                    <td className="py-2 px-3 text-sm whitespace-nowrap">
                      <StatusBadge status={milestone.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Zeitlinie ─────────────────────────────────────────────────────── */}
      {!isLoading && !isError && filteredMilestones.length > 0 && viewMode === "timeline" && (
        <MilestoneTimeline
          milestones={filteredMilestones}
          onMilestoneClick={handleEdit}
        />
      )}

      <TaskFormDialog
        releaseId={params.id}
        open={dialogOpen}
        onClose={handleDialogClose}
        task={editingTask}
        defaultIsMilestone={editingTask === null}
      />
    </main>
  );
}
