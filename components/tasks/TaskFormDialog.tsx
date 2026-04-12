"use client";

import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { TaskStatus, DependencyType } from "@prisma/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { X } from "lucide-react";
import { HistoryPanel } from "@/components/shared/HistoryPanel";
import { TaskComments } from "@/components/tasks/TaskComments";
import { TaskAttachments } from "@/components/tasks/TaskAttachments";

const TASK_FIELD_LABELS: Record<string, string> = {
  title: "Titel",
  status: "Status",
  startAt: "Start",
  endAt: "Ende",
  durationMinutes: "Dauer (Min.)",
  description: "Beschreibung",
  isMilestone: "Meilenstein",
  isSummaryTask: "Sammeltask",
  parentTaskId: "Übergeordneter Task",
};

// ─── Typen ────────────────────────────────────────────────────────────────────

interface ApplicationSnapshot {
  id: string;
  name: string;
  prefix: string;
}

interface ResourceSnapshot {
  id: string;
  firstName: string;
  lastName: string;
  function?: string | null;
  teamName?: string | null;
}

interface TaskSummary {
  id: string;
  key: string;
  title: string;
  status: TaskStatus;
  startAt?: string | null;
  endAt?: string | null;
  isMilestone?: boolean;
  isSummaryTask?: boolean;
}

// Gespeicherte Abhängigkeit: Task als Vorgänger
interface SavedTaskDep {
  id: string;
  predecessorId: string;
  type: DependencyType;
  predecessor: TaskSummary;
}

// Gespeicherte Abhängigkeit: Meilenstein als Vorgänger (Legacy – alte Milestone-Einträge)
interface SavedMilestoneDep {
  id: string;
  milestoneId: string;
  type: DependencyType;
  milestone: { key: string; title: string; dateTime: string };
}

// Nachfolger: Tasks die diesen Task als Vorgänger haben
interface SavedSuccessor {
  id: string;
  successorId: string;
  type: DependencyType;
  successor: { id: string; key: string; title: string; status: TaskStatus };
}

// Gepufferte Abhängigkeit für neue Tasks (vor dem ersten Speichern)
interface PendingDep {
  predecessorId: string;
  type: DependencyType;
  task: TaskSummary;
}

interface TaskFormDialogProps {
  releaseId: string;
  open: boolean;
  onClose: () => void;
  /** Wenn true und kein task angegeben: Meilenstein-Checkbox ist vorausgewählt */
  defaultIsMilestone?: boolean;
  /** ID des eingeloggten Users — für Kommentar-Aktionen */
  currentUserId?: string;
  /** Ob der eingeloggte User task:edit-Berechtigung hat */
  canEdit?: boolean;
  task?: {
    id: string;
    title: string;
    description?: string | null;
    status: TaskStatus;
    isMilestone?: boolean;
    isSummaryTask?: boolean;
    parentTaskId?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    durationMinutes?: number | null;
    applicationSnapshotId: string;
    version: number;
    assignees?: { resourceSnapshot: ResourceSnapshot }[];
  } | null;
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "OPEN",     label: "Offen" },
  { value: "PLANNED",  label: "Geplant" },
  { value: "DONE",     label: "Erledigt" },
  { value: "ARCHIVED", label: "Archiviert" },
];

const DEP_TYPES: DependencyType[] = ["FS", "SS", "FF"];

/** ISO-String (UTC oder datetime-local) → "dd.MM.yy HH:mm" für Anzeige */
function isoToDisplay(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year  = String(d.getFullYear()).slice(-2);
  const hours = String(d.getHours()).padStart(2, "0");
  const mins  = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${mins}`;
}

/**
 * "dd.MM.yy HH:mm" → UTC-ISO-String (via lokale Zeit), oder null bei ungültigem Format.
 */
function displayToISO(value: string): string | null {
  const m = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const year  = parseInt(m[3], 10);
  const month = parseInt(m[2], 10);
  const day   = parseInt(m[1], 10);
  const hours = parseInt(m[4], 10);
  const mins  = parseInt(m[5], 10);
  const fullYear = year < 100 ? 2000 + year : year;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hours > 23 || mins > 59) return null;
  const d = new Date(fullYear, month - 1, day, hours, mins);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** "HH:MM" → Minuten, oder null bei ungültigem Format */
function parseHHMM(value: string): number | null {
  const match = value.match(/^(\d{1,4}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (m > 59) return null;
  return h * 60 + m;
}

/** Minuten → "HH:MM" */
function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Differenz zweier ISO-Strings → "HH:MM", oder "" wenn ungültig/negativ */
function diffToHHMM(startIso: string, endIso: string): string {
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (diffMs <= 0) return "";
  return minutesToHHMM(Math.round(diffMs / 60_000));
}

/** ISO-String + Minuten → neuer ISO-String */
function addMinsToISO(iso: string, mins: number): string {
  return new Date(new Date(iso).getTime() + mins * 60_000).toISOString();
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function TaskFormDialog({
  releaseId,
  open,
  onClose,
  defaultIsMilestone = false,
  currentUserId,
  canEdit = true,
  task,
}: TaskFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(task);

  const [applications, setApplications] = useState<ApplicationSnapshot[]>([]);
  const [resources, setResources]       = useState<ResourceSnapshot[]>([]);
  const [allTasks, setAllTasks]         = useState<TaskSummary[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");

  // Felder
  const [title, setTitle]                                   = useState("");
  const [description, setDescription]                       = useState("");
  const [applicationSnapshotId, setApplicationSnapshotId]   = useState("");
  const [status, setStatus]                                 = useState<TaskStatus>("OPEN");
  const [isMilestone, setIsMilestone]                       = useState(false);
  const [isSummaryTask, setIsSummaryTask]                   = useState(false);
  const [parentTaskId, setParentTaskId]                     = useState<string | null>(null);
  const [selectedAssigneeIds, setSelectedAssigneeIds]       = useState<string[]>([]);
  const [startAt, setStartAt]                               = useState("");
  const [endAt, setEndAt]                                   = useState("");
  const [durationInput, setDurationInput]                   = useState("");

  // Abhängigkeiten (Edit: sofort gespeichert; Create: gepuffert)
  const [savedTaskDeps, setSavedTaskDeps]           = useState<SavedTaskDep[]>([]);
  const [savedMilestoneDeps, setSavedMilestoneDeps] = useState<SavedMilestoneDep[]>([]);
  const [savedSuccessors, setSavedSuccessors]       = useState<SavedSuccessor[]>([]);
  const [pendingDeps, setPendingDeps]               = useState<PendingDep[]>([]);
  const [newDepId, setNewDepId]                     = useState<string[]>([]);
  const [newDepType, setNewDepType]                 = useState<DependencyType>("FS");
  const [depLoading, setDepLoading]                 = useState(false);
  const [depError, setDepError]                     = useState("");

  // Aktuelle Version des Tasks (wird nach auto-PATCH aktualisiert)
  const [liveVersion, setLiveVersion]               = useState<number>(task?.version ?? 1);

  // ─── Daten laden ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch(`/api/releases/${releaseId}/applications`).then((r) => r.json()),
      fetch(`/api/releases/${releaseId}/resources`).then((r) => r.json()),
      fetch(`/api/releases/${releaseId}/tasks`).then((r) => r.json()),
    ]).then(([appData, resData, taskData]) => {
      const apps = appData.data ?? [];
      setApplications(apps);
      setResources(resData.data ?? []);
      setAllTasks(taskData.data ?? []);
      if (!isEdit && apps.length > 0) setApplicationSnapshotId(apps[0].id);
    });
  }, [open, releaseId, isEdit]);

  useEffect(() => {
    if (!open || !isEdit || !task) return;
    fetch(`/api/releases/${releaseId}/tasks/${task.id}/dependencies`)
      .then((r) => r.json())
      .then((d) => {
        setSavedTaskDeps(d.data?.taskPredecessors ?? []);
        setSavedMilestoneDeps(d.data?.milestonePredecessors ?? []);
        setSavedSuccessors(d.data?.successors ?? []);
      });
  }, [open, isEdit, task, releaseId]);

  // ─── Reset beim Öffnen ──────────────────────────────────────────────────────

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setApplicationSnapshotId(task.applicationSnapshotId);
      setStatus(task.status);
      setIsMilestone(task.isMilestone ?? false);
      setIsSummaryTask(task.isSummaryTask ?? false);
      setParentTaskId(task.parentTaskId ?? null);
      setSelectedAssigneeIds(task.assignees?.map((a) => a.resourceSnapshot.id) ?? []);
      setStartAt(isoToDisplay(task.startAt));
      setEndAt(isoToDisplay(task.endAt));
      setDurationInput(task.durationMinutes ? minutesToHHMM(task.durationMinutes) : "");
      setLiveVersion(task.version);
    } else {
      setTitle("");
      setDescription("");
      setStatus("OPEN");
      setIsMilestone(defaultIsMilestone);
      setIsSummaryTask(false);
      setParentTaskId(null);
      setSelectedAssigneeIds([]);
      setStartAt("");
      setEndAt("");
      setDurationInput("");
      setSavedTaskDeps([]);
      setSavedMilestoneDeps([]);
      setSavedSuccessors([]);
      setPendingDeps([]);
    }
    setNewDepId([]);
    setNewDepType("FS");
    setError("");
    setDepError("");
  }, [task, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Meilenstein: Start = Ende synchronisieren ───────────────────────────────

  useEffect(() => {
    if (isMilestone) {
      setEndAt(startAt);
      setDurationInput("");
    }
  }, [startAt, isMilestone]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Zeitplanung: erster Vorgänger bestimmt Anker ───────────────────────────

  const firstDep = useMemo(() => {
    if (savedTaskDeps.length > 0) {
      const d = savedTaskDeps[0];
      return { startAt: d.predecessor.startAt, endAt: d.predecessor.endAt, type: d.type };
    }
    if (savedMilestoneDeps.length > 0) {
      const d = savedMilestoneDeps[0];
      return { startAt: d.milestone.dateTime, endAt: d.milestone.dateTime, type: d.type };
    }
    if (pendingDeps.length > 0) {
      const d = pendingDeps[0];
      return { startAt: d.task.startAt, endAt: d.task.endAt, type: d.type };
    }
    return null;
  }, [savedTaskDeps, savedMilestoneDeps, pendingDeps]);

  useEffect(() => {
    if (!firstDep) return;

    let anchorIso: string | null = null;
    let anchorIsEnd = false;

    if (firstDep.type === "FS") {
      anchorIso = firstDep.endAt ?? null;
    } else if (firstDep.type === "SS") {
      anchorIso = firstDep.startAt ?? null;
    } else if (firstDep.type === "FF") {
      anchorIso = firstDep.endAt ?? null;
      anchorIsEnd = true;
    }

    if (!anchorIso) return;

    const mins = parseHHMM(durationInput);
    if (anchorIsEnd) {
      setEndAt(isoToDisplay(anchorIso));
      if (mins) setStartAt(isoToDisplay(addMinsToISO(anchorIso, -mins)));
    } else {
      setStartAt(isoToDisplay(anchorIso));
      if (mins) setEndAt(isoToDisplay(addMinsToISO(anchorIso, mins)));
    }
  }, [firstDep]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Smart-Eingabe-Handler ───────────────────────────────────────────────────

  function handleStartChange(val: string) {
    setStartAt(val);
    if (isMilestone) {
      setEndAt(val);
      return;
    }
    const startISO = displayToISO(val);
    if (!startISO) return;
    const endISO = displayToISO(endAt);
    if (endISO) {
      setDurationInput(diffToHHMM(startISO, endISO));
    } else {
      const mins = parseHHMM(durationInput);
      if (mins) setEndAt(isoToDisplay(addMinsToISO(startISO, mins)));
    }
  }

  function handleEndChange(val: string) {
    setEndAt(val);
    const endISO = displayToISO(val);
    if (!endISO) return;
    const startISO = displayToISO(startAt);
    if (startISO) {
      setDurationInput(diffToHHMM(startISO, endISO));
    } else {
      const mins = parseHHMM(durationInput);
      if (mins) setStartAt(isoToDisplay(addMinsToISO(endISO, -mins)));
    }
  }

  function handleDurationChange(val: string) {
    setDurationInput(val);
    const mins = parseHHMM(val);
    if (!mins) return;
    const startISO = displayToISO(startAt);
    const endISO   = displayToISO(endAt);
    if (startISO) {
      setEndAt(isoToDisplay(addMinsToISO(startISO, mins)));
    } else if (endISO) {
      setStartAt(isoToDisplay(addMinsToISO(endISO, -mins)));
    }
  }

  function handleIsMilestoneChange(checked: boolean) {
    setIsMilestone(checked);
    if (checked) {
      setIsSummaryTask(false);
      setEndAt(startAt);
      setDurationInput("");
    }
  }

  function handleIsSummaryTaskChange(checked: boolean) {
    setIsSummaryTask(checked);
    if (checked) {
      setIsMilestone(false);
      setStartAt("");
      setEndAt("");
      setDurationInput("");
    }
  }

  // ─── Abhängigkeiten: gepuffert (neue Tasks) ──────────────────────────────────

  function handleAddPending() {
    if (newDepId.length === 0) return;
    const t = allTasks.find((t) => t.id === newDepId[0]);
    if (!t) return;
    setPendingDeps((prev) => [...prev, { predecessorId: t.id, type: newDepType, task: t }]);
    setNewDepId([]);
  }

  // ─── Abhängigkeiten: sofort (Edit) ──────────────────────────────────────────

  async function handleAddSaved() {
    if (!task || newDepId.length === 0) return;
    setDepError("");
    setDepLoading(true);
    try {
      const res = await fetch(`/api/releases/${releaseId}/tasks/${task.id}/dependencies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predecessorId: newDepId[0], type: newDepType }),
      });

      if (!res.ok) {
        const d = await res.json();
        setDepError(d.error?.message ?? "Fehler beim Hinzufügen.");
        return;
      }

      const d = await res.json();
      const newDep: SavedTaskDep = d.data;
      setSavedTaskDeps((prev) => [...prev, newDep]);
      setNewDepId([]);

      // Erster Vorgänger: Zeiten neu berechnen und direkt speichern
      if (savedTaskDeps.length === 0) {
        const pred = newDep.predecessor;
        let anchorIso: string | null = null;
        let anchorIsEnd = false;

        if (newDep.type === "FS") {
          anchorIso = pred.endAt ?? null;
        } else if (newDep.type === "SS") {
          anchorIso = pred.startAt ?? null;
        } else if (newDep.type === "FF") {
          anchorIso = pred.endAt ?? null;
          anchorIsEnd = true;
        }

        if (anchorIso) {
          const mins = parseHHMM(durationInput) ?? task.durationMinutes ?? null;
          let newStart: string;
          let newEnd: string;

          if (anchorIsEnd) {
            newEnd = anchorIso;
            newStart = mins ? addMinsToISO(anchorIso, -mins) : anchorIso;
          } else {
            newStart = anchorIso;
            newEnd = isMilestone ? anchorIso : (mins ? addMinsToISO(anchorIso, mins) : anchorIso);
          }

          // Formularzustand aktualisieren
          setStartAt(isoToDisplay(newStart));
          setEndAt(isoToDisplay(isMilestone ? newStart : newEnd));

          // Automatisch in DB speichern
          const patchRes = await fetch(`/api/releases/${releaseId}/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: task.title,
              startAt: newStart,
              endAt: isMilestone ? newStart : newEnd,
              version: liveVersion,
            }),
          });

          if (patchRes.ok) {
            const patchData = await patchRes.json();
            setLiveVersion(patchData.data.version);
            queryClient.invalidateQueries({ queryKey: ["tasks", releaseId] });
          }
        }
      }
    } finally {
      setDepLoading(false);
    }
  }

  async function handleRemoveSavedTask(dep: SavedTaskDep) {
    if (!task) return;
    setDepError("");
    const res = await fetch(
      `/api/releases/${releaseId}/tasks/${task.id}/dependencies?predecessorId=${dep.predecessorId}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const d = await res.json();
      setDepError(d.error?.message ?? "Fehler beim Entfernen.");
      return;
    }
    setSavedTaskDeps((prev) => prev.filter((p) => p.predecessorId !== dep.predecessorId));
  }

  async function handleRemoveSavedMilestone(dep: SavedMilestoneDep) {
    if (!task) return;
    setDepError("");
    const res = await fetch(
      `/api/releases/${releaseId}/tasks/${task.id}/dependencies?predecessorMilestoneId=${dep.milestoneId}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const d = await res.json();
      setDepError(d.error?.message ?? "Fehler beim Entfernen.");
      return;
    }
    setSavedMilestoneDeps((prev) => prev.filter((p) => p.milestoneId !== dep.milestoneId));
  }

  // ─── Speichern ──────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const submitStartAt  = displayToISO(startAt) ?? (isEdit ? null : undefined);
    // Für Meilensteine: Ende = Start
    const submitEndAt    = isMilestone
      ? submitStartAt
      : (displayToISO(endAt) ?? (isEdit ? null : undefined));
    const submitDuration = isMilestone
      ? (isEdit ? null : undefined)
      : (parseHHMM(durationInput) ?? (isEdit ? null : undefined));

    if (!isMilestone && !isSummaryTask && submitStartAt && submitEndAt &&
        new Date(submitEndAt as string) < new Date(submitStartAt as string)) {
      setError("Die Endzeit muss nach der Startzeit liegen.");
      return;
    }

    setLoading(true);
    try {
      let res: Response;

      if (isEdit && task) {
        res = await fetch(`/api/releases/${releaseId}/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description: description || undefined,
            status,
            isMilestone,
            isSummaryTask,
            parentTaskId: parentTaskId ?? null,
            startAt: isSummaryTask ? null : submitStartAt,
            endAt: isSummaryTask ? null : submitEndAt,
            durationMinutes: isSummaryTask ? null : submitDuration,
            assigneeIds: selectedAssigneeIds,
            version: liveVersion,
          }),
        });
      } else {
        res = await fetch(`/api/releases/${releaseId}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description: description || undefined,
            applicationSnapshotId,
            isMilestone,
            isSummaryTask,
            parentTaskId: parentTaskId ?? null,
            startAt: isSummaryTask ? undefined : submitStartAt,
            endAt: isSummaryTask ? undefined : submitEndAt,
            durationMinutes: isSummaryTask ? undefined : submitDuration,
            assigneeIds: selectedAssigneeIds,
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        setError(
          res.status === 409
            ? "Dieser Task wurde zwischenzeitlich geändert. Bitte schliessen und neu öffnen."
            : (data.error?.message ?? "Ein Fehler ist aufgetreten.")
        );
        return;
      }

      // Gepufferte Abhängigkeiten nach Task-Erstellung speichern
      if (!isEdit && pendingDeps.length > 0) {
        const created = await res.json();
        const depResults = await Promise.all(
          pendingDeps.map((dep) =>
            fetch(`/api/releases/${releaseId}/tasks/${created.data.id}/dependencies`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ predecessorId: dep.predecessorId, type: dep.type }),
            })
          )
        );
        const failedDep = depResults.find((r) => !r.ok);
        if (failedDep) {
          const errData = await failedDep.json().catch(() => ({}));
          setError(errData.error?.message ?? "Abhängigkeit konnte nicht gespeichert werden.");
          return;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["tasks", releaseId] });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  // ─── Picker-Optionen ────────────────────────────────────────────────────────

  const usedTaskIds = new Set([
    ...savedTaskDeps.map((d) => d.predecessorId),
    ...pendingDeps.map((d) => d.predecessorId),
  ]);

  const availableTasks = allTasks.filter((t) => t.id !== task?.id && !usedTaskIds.has(t.id));

  const depPickerOptions = availableTasks.map((t) => ({
    value: t.id,
    label: t.title,
    sublabel: t.isMilestone ? `${t.key} · Meilenstein` : t.isSummaryTask ? `${t.key} · Sammeltask` : t.key,
  }));

  // Sammeltasks als mögliche Eltern (nur für reguläre Tasks; nicht für Sammeltasks selbst)
  const availableParentTasks = allTasks.filter(
    (t) => t.isSummaryTask && t.id !== task?.id
  );

  const dialogTitle = isEdit
    ? (isMilestone ? "Meilenstein bearbeiten" : isSummaryTask ? "Sammeltask bearbeiten" : "Task bearbeiten")
    : (isMilestone ? "Neuer Meilenstein" : isSummaryTask ? "Neuer Sammeltask" : "Neuer Task");

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[38rem] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">

          {/* Applikation (nur Erstellung) */}
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="app">Applikation *</Label>
              <select
                id="app"
                value={applicationSnapshotId}
                onChange={(e) => setApplicationSnapshotId(e.target.value)}
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {applications.length === 0 && (
                  <option value="">Keine Applikationen vorhanden</option>
                )}
                {applications.map((a) => (
                  <option key={a.id} value={a.id}>
                    [{a.prefix}] {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Meilenstein-Checkbox */}
          <div className="flex items-center gap-3">
            <input
              id="is-milestone"
              type="checkbox"
              checked={isMilestone}
              onChange={(e) => handleIsMilestoneChange(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <Label htmlFor="is-milestone" className="cursor-pointer">
              Meilenstein (Dauer 0, Start = Ende)
            </Label>
          </div>

          {/* Sammeltask-Checkbox */}
          <div className="flex items-center gap-3">
            <input
              id="is-summary-task"
              type="checkbox"
              checked={isSummaryTask}
              onChange={(e) => handleIsSummaryTaskChange(e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <Label htmlFor="is-summary-task" className="cursor-pointer">
              Sammeltask (Start/Ende aus enthaltenen Tasks)
            </Label>
          </div>

          {/* Titel */}
          <div className="space-y-2">
            <Label htmlFor="title">Titel *</Label>
            <Input
              id="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isMilestone ? "Meilenstein-Titel" : "Task-Titel"}
            />
          </div>

          {/* Beschreibung */}
          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionale Beschreibung…"
              rows={3}
            />
          </div>

          {/* Status (nur Edit) */}
          {isEdit && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Zugeordnet zu Sammeltask (nur für reguläre Tasks, nicht für Sammeltasks selbst) */}
          {!isSummaryTask && !isMilestone && (
            <div className="space-y-2">
              <Label htmlFor="parent-task">Sammeltask (optional)</Label>
              <select
                id="parent-task"
                value={parentTaskId ?? ""}
                onChange={(e) => setParentTaskId(e.target.value || null)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">– kein Sammeltask –</option>
                {availableParentTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.key}] {t.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ── Zeitplanung ───────────────────────────────────────────────── */}
          {isSummaryTask ? (
            <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
              Start und Ende werden automatisch aus den enthaltenen Tasks berechnet.
            </div>
          ) : isMilestone ? (
            <div className="space-y-2">
              <Label htmlFor="startAt">Datum / Zeit</Label>
              <Input
                id="startAt"
                type="text"
                value={startAt}
                onChange={(e) => handleStartChange(e.target.value)}
                placeholder="dd.MM.yy HH:mm"
              />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="startAt">Start</Label>
                <Input
                  id="startAt"
                  type="text"
                  value={startAt}
                  onChange={(e) => handleStartChange(e.target.value)}
                  placeholder="dd.MM.yy HH:mm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endAt">Ende</Label>
                <Input
                  id="endAt"
                  type="text"
                  value={endAt}
                  onChange={(e) => handleEndChange(e.target.value)}
                  placeholder="dd.MM.yy HH:mm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Dauer (HH:MM)</Label>
                <Input
                  id="duration"
                  value={durationInput}
                  onChange={(e) => handleDurationChange(e.target.value)}
                  placeholder="02:30"
                />
              </div>
            </div>
          )}

          {/* Verantwortliche */}
          <div className="space-y-2">
            <Label>Verantwortliche</Label>
            <Combobox
              multiple
              options={resources.map((r) => ({
                value: r.id,
                label: `${r.lastName} ${r.firstName}`,
                sublabel: r.function ?? r.teamName ?? undefined,
              }))}
              selected={selectedAssigneeIds}
              onChange={setSelectedAssigneeIds}
              placeholder={
                resources.length === 0 ? "Keine Ressourcen vorhanden" : "Personen auswählen…"
              }
              searchPlaceholder="Name oder Funktion suchen…"
              disabled={resources.length === 0}
            />
          </div>

          {/* ── Vorgänger (Abhängigkeiten) ─────────────────────────────── */}
          <div className="space-y-2">
            <Label>Vorgänger (Abhängigkeiten)</Label>

            {/* Gespeicherte Task-Vorgänger */}
            {savedTaskDeps.map((dep) => (
              <div
                key={dep.id}
                className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
              >
                <Badge variant="outline" className="text-xs shrink-0 font-normal">
                  {dep.predecessor.isMilestone ? "Meilenstein" : "Task"}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground shrink-0">{dep.predecessor.key}</span>
                <span className="flex-1 truncate">{dep.predecessor.title}</span>
                <Badge variant="secondary" className="text-xs shrink-0">{dep.type}</Badge>
                <button
                  type="button"
                  onClick={() => handleRemoveSavedTask(dep)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Legacy: gespeicherte Meilenstein-Vorgänger (altes Milestone-Modell) */}
            {savedMilestoneDeps.map((dep) => (
              <div
                key={dep.id}
                className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
              >
                <Badge variant="outline" className="text-xs shrink-0 font-normal">Meilenstein</Badge>
                <span className="font-mono text-xs text-muted-foreground shrink-0">{dep.milestone.key}</span>
                <span className="flex-1 truncate">{dep.milestone.title}</span>
                <Badge variant="secondary" className="text-xs shrink-0">{dep.type}</Badge>
                <button
                  type="button"
                  onClick={() => handleRemoveSavedMilestone(dep)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Gepufferte Vorgänger (neue Tasks vor dem Speichern) */}
            {pendingDeps.map((dep) => (
              <div
                key={dep.predecessorId}
                className="flex items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-sm"
              >
                <Badge variant="outline" className="text-xs shrink-0 font-normal">
                  {dep.task.isMilestone ? "Meilenstein" : "Task"}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground shrink-0">{dep.task.key}</span>
                <span className="flex-1 truncate">{dep.task.title}</span>
                <Badge variant="secondary" className="text-xs shrink-0">{dep.type}</Badge>
                <button
                  type="button"
                  onClick={() =>
                    setPendingDeps((prev) => prev.filter((p) => p.predecessorId !== dep.predecessorId))
                  }
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Picker */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Combobox
                  options={depPickerOptions}
                  selected={newDepId}
                  onChange={setNewDepId}
                  placeholder={
                    availableTasks.length === 0 ? "Keine Tasks verfügbar" : "Task oder Meilenstein wählen…"
                  }
                  searchPlaceholder="Nr. oder Titel suchen…"
                  disabled={depPickerOptions.length === 0}
                />
              </div>
              <select
                value={newDepType}
                onChange={(e) => setNewDepType(e.target.value as DependencyType)}
                className="h-10 rounded-md border border-input bg-background px-2 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {DEP_TYPES.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10"
                onClick={isEdit ? handleAddSaved : handleAddPending}
                disabled={newDepId.length === 0 || depLoading}
              >
                Hinzufügen
              </Button>
            </div>

            {depError && <p className="text-xs text-destructive">{depError}</p>}
          </div>

          {/* ── Nachfolger (nur Lesezugriff, nur Edit) ──────────────────── */}
          {isEdit && savedSuccessors.length > 0 && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Nachfolger</Label>
              {savedSuccessors.map((dep) => (
                <div
                  key={dep.id}
                  className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-1.5 text-sm"
                >
                  <span className="font-mono text-xs text-muted-foreground shrink-0">{dep.successor.key}</span>
                  <span className="flex-1 truncate">{dep.successor.title}</span>
                  <Badge variant="secondary" className="text-xs shrink-0">{dep.type}</Badge>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {isEdit && task && (
            <>
              {/* Anhänge */}
              <div className="rounded-md border p-3">
                <TaskAttachments
                  releaseId={releaseId}
                  taskId={task.id}
                  canEdit={canEdit}
                />
              </div>

              {/* Kommentare */}
              <div className="rounded-md border p-3">
                <TaskComments
                  releaseId={releaseId}
                  taskId={task.id}
                  currentUserId={currentUserId ?? ""}
                  canEdit={canEdit}
                />
              </div>

              {/* Verlauf */}
              <HistoryPanel
                historyUrl={`/api/releases/${releaseId}/tasks/${task.id}/history`}
                fieldLabels={TASK_FIELD_LABELS}
              />
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Wird gespeichert…" : isEdit ? "Speichern" : "Erstellen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
