"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { TaskStatus } from "@prisma/client";
import { AlertTriangle, Plus, RefreshCw, ArrowRightToLine, ArrowLeftToLine, MessageSquare } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { useRelease } from "@/hooks/useRelease";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskFilters } from "@/components/tasks/TaskFilters";
import { TaskFormDialog } from "@/components/tasks/TaskFormDialog";
import { Button } from "@/components/ui/button";
import { can, canViewAllTasks } from "@/lib/permissions";

interface TasksPageProps {
  params: { id: string };
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

/** Gibt true zurück, wenn der Task-Start/Ende nicht mehr mit dem Vorgänger übereinstimmt. */
function isTaskInvalid(task: any): boolean {
  if (!task.predecessors?.length) return false;
  for (const dep of task.predecessors) {
    const pred = dep.predecessor;
    if (dep.type === "FS" && pred.endAt && task.startAt) {
      if (Math.abs(new Date(task.startAt).getTime() - new Date(pred.endAt).getTime()) > 60_000) return true;
    } else if (dep.type === "SS" && pred.startAt && task.startAt) {
      if (Math.abs(new Date(task.startAt).getTime() - new Date(pred.startAt).getTime()) > 60_000) return true;
    } else if (dep.type === "FF" && pred.endAt && task.endAt) {
      if (Math.abs(new Date(task.endAt).getTime() - new Date(pred.endAt).getTime()) > 60_000) return true;
    }
  }
  return false;
}

/**
 * Berechnet kaskadierend neue Start-/Endzeiten für alle Tasks, die durch
 * geänderte Vorgänger veraltet sind. Wiederholt bis keine Änderungen mehr nötig.
 */
function buildCascadeUpdates(
  tasks: any[]
): Map<string, { startAt: string | null; endAt: string | null; version: number }> {
  const timesMap = new Map<string, { startAt: string | null; endAt: string | null }>(
    tasks.map((t) => [t.id, { startAt: t.startAt, endAt: t.endAt }])
  );
  const updates = new Map<string, { startAt: string | null; endAt: string | null; version: number }>();

  let changed = true;
  while (changed) {
    changed = false;
    for (const task of tasks) {
      if (!task.predecessors?.length) continue;
      const firstDep = task.predecessors[0];
      const predTimes = timesMap.get(firstDep.predecessorId);
      if (!predTimes) continue;

      const cur = timesMap.get(task.id)!;
      let newStart = cur.startAt;
      let newEnd = cur.endAt;
      let needsUpdate = false;

      if (firstDep.type === "FS" && predTimes.endAt && cur.startAt) {
        if (Math.abs(new Date(cur.startAt).getTime() - new Date(predTimes.endAt).getTime()) > 60_000) {
          newStart = predTimes.endAt;
          needsUpdate = true;
        }
      } else if (firstDep.type === "SS" && predTimes.startAt && cur.startAt) {
        if (Math.abs(new Date(cur.startAt).getTime() - new Date(predTimes.startAt).getTime()) > 60_000) {
          newStart = predTimes.startAt;
          needsUpdate = true;
        }
      } else if (firstDep.type === "FF" && predTimes.endAt && cur.endAt) {
        if (Math.abs(new Date(cur.endAt).getTime() - new Date(predTimes.endAt).getTime()) > 60_000) {
          newEnd = predTimes.endAt;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        if (task.durationMinutes) {
          if ((firstDep.type === "FS" || firstDep.type === "SS") && newStart) {
            newEnd = new Date(new Date(newStart).getTime() + task.durationMinutes * 60_000).toISOString();
          } else if (firstDep.type === "FF" && newEnd) {
            newStart = new Date(new Date(newEnd).getTime() - task.durationMinutes * 60_000).toISOString();
          }
        }
        timesMap.set(task.id, { startAt: newStart, endAt: newEnd });
        updates.set(task.id, { startAt: newStart, endAt: newEnd, version: task.version });
        changed = true;
      }
    }
  }

  return updates;
}

// Reihenfolge: OPEN ist "am tiefsten" (am wenigsten fortgeschritten)
const STATUS_PRIORITY: Record<string, number> = { OPEN: 0, PLANNED: 1, DONE: 2, ARCHIVED: 3 };

/**
 * Berechnet frühesten Start, spätestes Ende, Dauer und tiefsten Status
 * eines Sammeltasks aus seinen Kindern.
 */
function computeSummaryValues(children: any[]): {
  computedStartAt: string | null;
  computedEndAt: string | null;
  computedStatus: string | null;
  computedDurationMinutes: number | null;
} {
  const starts = children.map((c) => c.startAt).filter(Boolean) as string[];
  const ends   = children.map((c) => c.endAt).filter(Boolean) as string[];
  const statuses = children.map((c) => c.status).filter(Boolean) as string[];
  const lowestStatus = statuses.length > 0
    ? statuses.reduce((a, b) => (STATUS_PRIORITY[a] <= STATUS_PRIORITY[b] ? a : b))
    : null;
  const computedStartAt = starts.length > 0 ? starts.reduce((a, b) => (a < b ? a : b)) : null;
  const computedEndAt   = ends.length   > 0 ? ends.reduce((a, b)   => (a > b ? a : b)) : null;
  const computedDurationMinutes =
    computedStartAt && computedEndAt
      ? Math.round((new Date(computedEndAt).getTime() - new Date(computedStartAt).getTime()) / 60_000)
      : null;
  return {
    computedStartAt,
    computedEndAt,
    computedStatus:  lowestStatus,
    computedDurationMinutes,
  };
}

/**
 * Topologische Sortierung einer Task-Gruppe (Kahn's Algorithmus).
 * Berücksichtigt nur Abhängigkeiten zwischen Tasks innerhalb der Gruppe.
 * Bei Zyklen werden verbleibende Tasks am Ende angehängt.
 */
function topoSort(tasks: any[]): any[] {
  if (tasks.length <= 1) return tasks;

  const taskIds = new Set(tasks.map((t) => t.id));
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const inDegree = new Map<string, number>(tasks.map((t) => [t.id, 0]));
  const adjacency = new Map<string, string[]>(tasks.map((t) => [t.id, []]));

  for (const task of tasks) {
    for (const dep of task.predecessors ?? []) {
      if (taskIds.has(dep.predecessorId)) {
        adjacency.get(dep.predecessorId)!.push(task.id);
        inDegree.set(task.id, inDegree.get(task.id)! + 1);
      }
    }
  }

  const queue = tasks.filter((t) => inDegree.get(t.id) === 0);
  const result: any[] = [];

  while (queue.length > 0) {
    const task = queue.shift()!;
    result.push(task);
    for (const successorId of adjacency.get(task.id)!) {
      const deg = inDegree.get(successorId)! - 1;
      inDegree.set(successorId, deg);
      if (deg === 0) queue.push(taskById.get(successorId)!);
    }
  }

  // Zyklen: verbleibende Tasks anhängen
  if (result.length < tasks.length) {
    const done = new Set(result.map((t) => t.id));
    result.push(...tasks.filter((t) => !done.has(t.id)));
  }

  return result;
}

/**
 * Sortiert Tasks aufsteigend nach Startzeit (null ans Ende).
 * Bei gleichem Startpunkt werden Vorgänger vor Nachfolger gereiht (topoSort).
 */
function sortByStartThenDependency(tasks: any[], getStart: (t: any) => string | null): any[] {
  const groups = new Map<string, any[]>();
  const nullGroup: any[] = [];

  for (const task of tasks) {
    const start = getStart(task);
    if (!start) {
      nullGroup.push(task);
    } else {
      const arr = groups.get(start) ?? [];
      arr.push(task);
      groups.set(start, arr);
    }
  }

  const result: any[] = [];
  for (const key of [...groups.keys()].sort()) {
    result.push(...topoSort(groups.get(key)!));
  }
  result.push(...nullGroup);
  return result;
}

/**
 * Baut die angezeigte Zeilenliste auf:
 * - Sammeltasks erscheinen in ihrer sortierten Position (nach berechneter Startzeit)
 * - Wenn expandiert, werden die Kinder direkt darunter eingerückt angezeigt
 * - Reguläre Tasks (ohne Elternteil) werden normal sortiert
 */
function buildDisplayRows(
  filteredTasks: any[],
  allTasks: any[],
  expandedIds: Set<string>
): Array<{
  task: any;
  isChild: boolean;
  isSummaryTask: boolean;
  isExpanded?: boolean;
  computedStartAt?: string | null;
  computedEndAt?: string | null;
  computedStatus?: string | null;
  computedDurationMinutes?: number | null;
}> {
  // Child-Tasks aus den gefilterten Tasks heraushalten (werden nach dem Parent eingefügt)
  const childTaskIds = new Set(filteredTasks.filter((t) => t.parentTaskId).map((t) => t.id));

  // Alle Child-Tasks aller Sammeltasks aus dem Gesamt-Set holen (auch ungefilterte)
  const childrenByParent = new Map<string, any[]>();
  for (const t of allTasks) {
    if (t.parentTaskId) {
      const arr = childrenByParent.get(t.parentTaskId) ?? [];
      arr.push(t);
      childrenByParent.set(t.parentTaskId, arr);
    }
  }

  // Top-Level-Tasks (keine Kinder-Tasks)
  const topLevelTasksUnsorted = filteredTasks.filter((t) => !t.parentTaskId);

  // Für Sammeltasks: berechnete Zeiten vorab ermitteln (für Sortierung benötigt)
  const summaryComputedValues = new Map<string, ReturnType<typeof computeSummaryValues>>();
  for (const task of topLevelTasksUnsorted) {
    if (task.isSummaryTask) {
      const allChildren = childrenByParent.get(task.id) ?? [];
      summaryComputedValues.set(task.id, computeSummaryValues(allChildren));
    }
  }

  // Effektives Startdatum ermitteln (für Sammeltasks: berechneter Wert, sonst task.startAt)
  function getEffectiveStart(task: any): string | null {
    if (task.isSummaryTask) return summaryComputedValues.get(task.id)?.computedStartAt ?? null;
    return task.startAt ?? null;
  }

  // Top-Level-Tasks aufsteigend nach Start sortieren, bei gleichem Start: Vorgänger vor Nachfolger
  const topLevelTasks = sortByStartThenDependency(topLevelTasksUnsorted, getEffectiveStart);

  const rows: ReturnType<typeof buildDisplayRows> = [];

  for (const task of topLevelTasks) {
    if (task.isSummaryTask) {
      const allChildren = childrenByParent.get(task.id) ?? [];
      const { computedStartAt, computedEndAt, computedStatus, computedDurationMinutes } = summaryComputedValues.get(task.id)!;
      const isExpanded = expandedIds.has(task.id);
      rows.push({ task, isChild: false, isSummaryTask: true, isExpanded, computedStartAt, computedEndAt, computedStatus, computedDurationMinutes });

      if (isExpanded) {
        // Kinder aufsteigend nach Start-Zeit sortieren, bei gleichem Start: Vorgänger vor Nachfolger
        const sortedChildren = sortByStartThenDependency(allChildren, (t) => t.startAt ?? null);
        for (const child of sortedChildren) {
          // Nur anzeigen wenn der Child-Task im gefilterten Set ist
          if (filteredTasks.find((t) => t.id === child.id)) {
            rows.push({ task: child, isChild: true, isSummaryTask: false });
          }
        }
      }
    } else {
      rows.push({ task, isChild: false, isSummaryTask: false });
    }
  }

  return rows;
}

// ─── Komponente ──────────────────────────────────────────────────────────────

export default function TasksPage({ params }: TasksPageProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [activeStatus, setActiveStatus] = useState<TaskStatus | "ALL">("ALL");
  const [onlyOwn, setOnlyOwn] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [expandedSummaryTasks, setExpandedSummaryTasks] = useState<Set<string>>(new Set());

  const { data: releaseData } = useRelease(params.id);
  const currentUserRole = releaseData?.data?.currentUserRole;

  const { data, isLoading, isError } = useTasks({
    releaseId: params.id,
    onlyOwn: currentUserRole ? (!canViewAllTasks(currentUserRole) || onlyOwn) : false,
  });

  const tasks: any[] = data?.data ?? [];

  const filteredTasks = activeStatus === "ALL"
    ? tasks.filter((t) => t.status !== "ARCHIVED")
    : tasks.filter((t) => t.status === activeStatus);

  // Alle Tasks (über Filter hinaus) auf Ungültigkeit prüfen
  const invalidTaskIds = new Set(
    tasks.filter(isTaskInvalid).map((t) => t.id)
  );

  // ─── Handler ───────────────────────────────────────────────────────────────

  function handleNewTask() {
    setEditingTask(null);
    setDialogOpen(true);
  }

  function handleEditTask(task: any) {
    setEditingTask(task);
    setDialogOpen(true);
  }

  function handleDialogClose() {
    setDialogOpen(false);
    setEditingTask(null);
  }

  function handleToggleExpand(taskId: string) {
    setExpandedSummaryTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  async function handleRecalculate() {
    setRecalculating(true);
    try {
      const updates = buildCascadeUpdates(tasks);
      // Sequenziell patchen (Version-Konflikte vermeiden)
      for (const [taskId, { startAt, endAt, version }] of updates) {
        const task = tasks.find((t) => t.id === taskId)!;
        await fetch(`/api/releases/${params.id}/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: task.title, startAt, endAt, version }),
        });
      }
      queryClient.invalidateQueries({ queryKey: ["tasks", params.id] });
    } finally {
      setRecalculating(false);
    }
  }

  const canCreate = currentUserRole && can(currentUserRole, "task:create");

  // Angezeigte Zeilen aufbauen
  const displayRows = buildDisplayRows(filteredTasks, tasks, expandedSummaryTasks);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          {releaseData?.data && (
            <p className="text-sm text-muted-foreground mt-1">
              {releaseData.data.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {filteredTasks.length} Task{filteredTasks.length !== 1 ? "s" : ""}
          </span>
          {canCreate && (
            <Button size="sm" onClick={handleNewTask}>
              <Plus className="h-4 w-4 mr-1" />
              Neuer Task
            </Button>
          )}
        </div>
      </div>

      {currentUserRole && (
        <div className="mb-4">
          <TaskFilters
            activeStatus={activeStatus}
            onStatusChange={setActiveStatus}
            onlyOwn={onlyOwn}
            onOnlyOwnChange={setOnlyOwn}
            canViewAll={canViewAllTasks(currentUserRole)}
          />
        </div>
      )}

      {/* Banner: veraltete Tasks */}
      {!isLoading && invalidTaskIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            <strong>{invalidTaskIds.size} Task{invalidTaskIds.size !== 1 ? "s haben" : " hat"}</strong> veraltete Zeiten — ein Vorgänger wurde verschoben.
            Sollen alle Nachfolger neu berechnet werden?
          </span>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-600 dark:hover:bg-amber-900/40"
            onClick={handleRecalculate}
            disabled={recalculating}
          >
            {recalculating ? (
              <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Wird berechnet…</>
            ) : (
              <><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Ja, neu berechnen</>
            )}
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-9 rounded border bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Fehler beim Laden der Tasks. Bitte Seite neu laden.
        </div>
      )}

      {!isLoading && !isError && filteredTasks.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Keine Tasks vorhanden.</p>
        </div>
      )}

      {!isLoading && !isError && filteredTasks.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse text-sm table-fixed">
            <colgroup>
              <col className="w-[130px]" />
              <col className="w-[95px]" />
              <col className="w-[55px]" />
              <col className="w-[55px]" />
              <col className="w-[70px]" />
              <col /> {/* Titel: flexibel */}
              <col className="w-[40px]" />
              <col className="w-[40px]" />
              <col className="w-[40px]" />
              <col className="w-[150px]" />
              <col className="w-[160px]" />
              <col className="w-[95px]" />
            </colgroup>
            <thead>
              <tr className="border-b bg-muted/50 text-muted-foreground">
                <th className="py-2 px-3 text-left font-medium whitespace-nowrap">Nr.</th>
                <th className="py-2 px-3 text-left font-medium whitespace-nowrap">Datum</th>
                <th className="py-2 px-3 text-left font-medium whitespace-nowrap">Start</th>
                <th className="py-2 px-3 text-left font-medium whitespace-nowrap">Ende</th>
                <th className="py-2 px-3 text-left font-medium whitespace-nowrap">Dauer</th>
                <th className="py-2 px-3 text-left font-medium">Titel</th>
                <th className="py-2 px-3 text-center font-medium" title="Vorgänger"><ArrowRightToLine className="h-3.5 w-3.5 mx-auto" /></th>
                <th className="py-2 px-3 text-center font-medium" title="Nachfolger"><ArrowLeftToLine className="h-3.5 w-3.5 mx-auto" /></th>
                <th className="py-2 px-3 text-center font-medium" title="Kommentare"><MessageSquare className="h-3.5 w-3.5 mx-auto" /></th>
                <th className="py-2 px-3 text-left font-medium whitespace-nowrap">Applikation</th>
                <th className="py-2 px-3 text-left font-medium whitespace-nowrap">Verantwortliche</th>
                <th className="py-2 px-3 text-left font-medium whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map(({ task, isChild, isSummaryTask, isExpanded, computedStartAt, computedEndAt, computedStatus, computedDurationMinutes }) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isInvalid={invalidTaskIds.has(task.id)}
                  onClick={() => handleEditTask(task)}
                  isChild={isChild}
                  isExpanded={isExpanded}
                  onToggleExpand={isSummaryTask ? () => handleToggleExpand(task.id) : undefined}
                  computedStartAt={computedStartAt}
                  computedEndAt={computedEndAt}
                  computedStatus={computedStatus}
                  computedDurationMinutes={computedDurationMinutes}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TaskFormDialog
        releaseId={params.id}
        open={dialogOpen}
        onClose={handleDialogClose}
        task={editingTask}
        currentUserId={session?.user?.id}
        canEdit={currentUserRole ? can(currentUserRole, "task:edit") : false}
      />
    </main>
  );
}
