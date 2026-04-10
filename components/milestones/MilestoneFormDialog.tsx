"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MilestoneStatus, DependencyType } from "@prisma/client";
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
  status: string;
  endAt?: string | null;
  startAt?: string | null;
}

interface MilestoneSummary {
  id: string;
  title: string;
  dateTime: string;
  status: string;
}

interface SavedDep {
  id: string;
  type: DependencyType;
  taskId?: string | null;
  predecessorMilestoneId?: string | null;
  task?: TaskSummary | null;
  predecessorMilestone?: MilestoneSummary | null;
}

interface MilestoneFormDialogProps {
  releaseId: string;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  milestone?: {
    id: string;
    title: string;
    description?: string | null;
    dateTime: string;
    isFixed: boolean;
    status: MilestoneStatus;
    responsible?: { id: string; firstName: string; lastName: string } | null;
    version: number;
  } | null;
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: MilestoneStatus; label: string }[] = [
  { value: "OPEN",     label: "Offen" },
  { value: "PLANNED",  label: "Geplant" },
  { value: "DONE",     label: "Erledigt" },
  { value: "ARCHIVED", label: "Archiviert" },
];

const DEP_TYPES: DependencyType[] = ["FS", "SS", "FF"];

/** ISO-String → "dd.MM.yy HH:mm" */
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

/** "dd.MM.yy HH:mm" → ISO-String (lokale Zeit), oder null */
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

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function MilestoneFormDialog({
  releaseId,
  open,
  onClose,
  canEdit,
  milestone,
}: MilestoneFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(milestone);

  const [applications, setApplications] = useState<ApplicationSnapshot[]>([]);
  const [resources, setResources]       = useState<ResourceSnapshot[]>([]);
  const [allTasks, setAllTasks]         = useState<TaskSummary[]>([]);
  const [allMilestones, setAllMilestones] = useState<MilestoneSummary[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");

  // Felder
  const [applicationSnapshotId, setApplicationSnapshotId] = useState("");
  const [title, setTitle]               = useState("");
  const [description, setDescription]   = useState("");
  const [dateTimeInput, setDateTimeInput] = useState("");
  const [isFixed, setIsFixed]           = useState(false);
  const [status, setStatus]             = useState<MilestoneStatus>("OPEN");
  const [responsibleId, setResponsibleId] = useState<string[]>([]);

  // Abhängigkeiten
  const [savedDeps, setSavedDeps]       = useState<SavedDep[]>([]);
  const [newDepType, setNewDepType]     = useState<DependencyType>("FS");
  // "task" oder "milestone" — was gerade im Picker gewählt wird
  const [newDepKind, setNewDepKind]     = useState<"task" | "milestone">("task");
  const [newDepId, setNewDepId]         = useState<string[]>([]);
  const [depLoading, setDepLoading]     = useState(false);
  const [depError, setDepError]         = useState("");

  // ─── Daten laden ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch(`/api/releases/${releaseId}/applications`).then((r) => r.json()),
      fetch(`/api/releases/${releaseId}/resources`).then((r) => r.json()),
      fetch(`/api/releases/${releaseId}/tasks`).then((r) => r.json()),
      fetch(`/api/releases/${releaseId}/milestones`).then((r) => r.json()),
    ]).then(([appData, resData, taskData, msData]) => {
      const apps = appData.data ?? [];
      setApplications(apps);
      setResources(resData.data ?? []);
      setAllTasks(taskData.data ?? []);
      setAllMilestones(msData.data ?? []);
      // Standard-Applikation bei Neu-Erstellung vorauswählen
      if (!isEdit && apps.length > 0) setApplicationSnapshotId(apps[0].id);
    });
  }, [open, releaseId, isEdit]);

  useEffect(() => {
    if (!open || !isEdit || !milestone) return;
    setDepError("");
    fetch(`/api/releases/${releaseId}/milestones/${milestone.id}/dependencies`)
      .then((r) => r.json())
      .then((d) => setSavedDeps(d.data?.predecessors ?? []));
  }, [open, isEdit, milestone, releaseId]);

  // ─── Felder beim Öffnen befüllen ─────────────────────────────────────────────

  useEffect(() => {
    if (milestone) {
      setTitle(milestone.title);
      setDescription(milestone.description ?? "");
      setDateTimeInput(isoToDisplay(milestone.dateTime));
      setIsFixed(milestone.isFixed);
      setStatus(milestone.status);
      setResponsibleId(milestone.responsible ? [milestone.responsible.id] : []);
    } else {
      setTitle("");
      setDescription("");
      setDateTimeInput("");
      setIsFixed(false);
      setStatus("OPEN");
      setResponsibleId([]);
      setSavedDeps([]);
      // applicationSnapshotId wird durch den applications-useEffect gesetzt
    }
    setNewDepId([]);
    setNewDepType("FS");
    setNewDepKind("task");
    setError("");
    setDepError("");
  }, [milestone, open]);

  // ─── Abhängigkeiten verwalten ────────────────────────────────────────────────

  const usedTaskIds = new Set(savedDeps.filter((d) => d.taskId).map((d) => d.taskId!));
  const usedMsIds   = new Set(savedDeps.filter((d) => d.predecessorMilestoneId).map((d) => d.predecessorMilestoneId!));

  const availableTasks = allTasks.filter((t) => !usedTaskIds.has(t.id));
  const availableMilestones = allMilestones.filter(
    (m) => m.id !== milestone?.id && !usedMsIds.has(m.id)
  );

  async function handleAddDep() {
    if (!milestone || newDepId.length === 0) return;
    setDepError("");
    setDepLoading(true);
    try {
      const body =
        newDepKind === "task"
          ? { taskId: newDepId[0], type: newDepType }
          : { predecessorMilestoneId: newDepId[0], type: newDepType };

      const res = await fetch(
        `/api/releases/${releaseId}/milestones/${milestone.id}/dependencies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const d = await res.json();
        setDepError(d.error?.message ?? "Fehler beim Hinzufügen.");
        return;
      }

      const d = await res.json();
      setSavedDeps((prev) => [...prev, d.data]);
      setNewDepId([]);
      // Meilensteinliste neu laden (Konflikt-Erkennung)
      queryClient.invalidateQueries({ queryKey: ["milestones", releaseId] });
    } finally {
      setDepLoading(false);
    }
  }

  async function handleRemoveDep(dep: SavedDep) {
    if (!milestone) return;
    setDepError("");
    const res = await fetch(
      `/api/releases/${releaseId}/milestones/${milestone.id}/dependencies?depId=${dep.id}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const d = await res.json();
      setDepError(d.error?.message ?? "Fehler beim Entfernen.");
      return;
    }
    setSavedDeps((prev) => prev.filter((p) => p.id !== dep.id));
    queryClient.invalidateQueries({ queryKey: ["milestones", releaseId] });
  }

  // ─── Speichern ──────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const dateTimeISO = displayToISO(dateTimeInput);
    if (!dateTimeISO) {
      setError("Bitte ein gültiges Datum/Zeit eingeben (Format: dd.MM.yy HH:mm).");
      return;
    }

    setLoading(true);
    try {
      let res: Response;

      if (isEdit && milestone) {
        res = await fetch(`/api/releases/${releaseId}/milestones/${milestone.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description: description || null,
            dateTime: dateTimeISO,
            isFixed,
            status,
            responsibleId: responsibleId[0] ?? null,
            version: milestone.version,
          }),
        });
      } else {
        res = await fetch(`/api/releases/${releaseId}/milestones`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicationSnapshotId,
            title,
            description: description || undefined,
            dateTime: dateTimeISO,
            isFixed,
            responsibleId: responsibleId[0] ?? undefined,
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        setError(
          res.status === 409
            ? "Dieser Meilenstein wurde zwischenzeitlich geändert. Bitte schliessen und neu öffnen."
            : (data.error?.message ?? "Ein Fehler ist aufgetreten.")
        );
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["milestones", releaseId] });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  // ─── Löschen ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!milestone) return;
    if (!confirm(`Meilenstein "${milestone.title}" wirklich löschen?`)) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/releases/${releaseId}/milestones/${milestone.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "Fehler beim Löschen.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["milestones", releaseId] });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const depPickerOptions =
    newDepKind === "task"
      ? availableTasks.map((t) => ({ value: t.id, label: t.title, sublabel: t.key }))
      : availableMilestones.map((m) => ({
          value: m.id,
          label: m.title,
          sublabel: isoToDisplay(m.dateTime),
        }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Meilenstein bearbeiten" : "Neuer Meilenstein"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">

          {/* Applikation (nur Erstellung) */}
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="ms-app">Applikation *</Label>
              <select
                id="ms-app"
                value={applicationSnapshotId}
                onChange={(e) => setApplicationSnapshotId(e.target.value)}
                required
                disabled={!canEdit}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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

          {/* Titel */}
          <div className="space-y-2">
            <Label htmlFor="ms-title">Titel *</Label>
            <Input
              id="ms-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Meilenstein-Titel"
              disabled={!canEdit}
            />
          </div>

          {/* Beschreibung */}
          <div className="space-y-2">
            <Label htmlFor="ms-description">Beschreibung</Label>
            <Textarea
              id="ms-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionale Beschreibung…"
              rows={3}
              disabled={!canEdit}
            />
          </div>

          {/* Datum / Zeit */}
          <div className="space-y-2">
            <Label htmlFor="ms-datetime">Datum / Zeit *</Label>
            <Input
              id="ms-datetime"
              type="text"
              value={dateTimeInput}
              onChange={(e) => setDateTimeInput(e.target.value)}
              placeholder="dd.MM.yy HH:mm"
              disabled={!canEdit}
            />
          </div>

          {/* Fix-Meilenstein */}
          <div className="flex items-center gap-3">
            <input
              id="ms-fixed"
              type="checkbox"
              checked={isFixed}
              onChange={(e) => setIsFixed(e.target.checked)}
              disabled={!canEdit}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <Label htmlFor="ms-fixed" className="cursor-pointer">
              Fixer Meilenstein (nicht automatisch verschieben)
            </Label>
          </div>

          {/* Status (nur Edit) */}
          {isEdit && (
            <div className="space-y-2">
              <Label htmlFor="ms-status">Status</Label>
              <select
                id="ms-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
                disabled={!canEdit}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Verantwortliche Person */}
          <div className="space-y-2">
            <Label>Verantwortliche Person</Label>
            <Combobox
              options={resources.map((r) => ({
                value: r.id,
                label: `${r.lastName} ${r.firstName}`,
                sublabel: r.function ?? r.teamName ?? undefined,
              }))}
              selected={responsibleId}
              onChange={setResponsibleId}
              placeholder={
                resources.length === 0 ? "Keine Ressourcen vorhanden" : "Person auswählen…"
              }
              searchPlaceholder="Name oder Funktion suchen…"
              disabled={!canEdit || resources.length === 0}
            />
          </div>

          {/* ── Vorgänger (nur Edit) ──────────────────────────────────────── */}
          {isEdit && (
            <div className="space-y-2">
              <Label>Vorgänger (Abhängigkeiten)</Label>

              {savedDeps.map((dep) => {
                const isTask = Boolean(dep.task);
                const label = isTask
                  ? dep.task!.title
                  : dep.predecessorMilestone!.title;
                const sublabel = isTask
                  ? dep.task!.key
                  : isoToDisplay(dep.predecessorMilestone!.dateTime);
                const kindBadge = isTask ? "Task" : "Meilenstein";
                return (
                  <div
                    key={dep.id}
                    className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm"
                  >
                    <Badge variant="outline" className="text-xs shrink-0 font-normal">
                      {kindBadge}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground shrink-0">
                      {sublabel}
                    </span>
                    <span className="flex-1 truncate">{label}</span>
                    <Badge variant="secondary" className="text-xs shrink-0">{dep.type}</Badge>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDep(dep)}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              {canEdit && (
                <div className="space-y-2">
                  {/* Art des Vorgängers: Task oder Meilenstein */}
                  <div className="flex gap-1">
                    {(["task", "milestone"] as const).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => { setNewDepKind(kind); setNewDepId([]); }}
                        className={`px-3 py-1 rounded-md text-sm border transition-colors ${
                          newDepKind === kind
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-input text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {kind === "task" ? "Task" : "Meilenstein"}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Combobox
                        options={depPickerOptions}
                        selected={newDepId}
                        onChange={setNewDepId}
                        placeholder={
                          newDepKind === "task"
                            ? (availableTasks.length === 0 ? "Keine Tasks verfügbar" : "Task wählen…")
                            : (availableMilestones.length === 0 ? "Keine Meilensteine verfügbar" : "Meilenstein wählen…")
                        }
                        searchPlaceholder={
                          newDepKind === "task" ? "Task-Nr. oder Titel…" : "Meilenstein suchen…"
                        }
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
                      onClick={handleAddDep}
                      disabled={newDepId.length === 0 || depLoading}
                    >
                      Hinzufügen
                    </Button>
                  </div>
                </div>
              )}

              {depError && <p className="text-xs text-destructive">{depError}</p>}
            </div>
          )}

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-between gap-2 pt-2">
            <div>
              {isEdit && canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive border-destructive/50 hover:bg-destructive/10"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  Löschen
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {canEdit ? "Abbrechen" : "Schliessen"}
              </Button>
              {canEdit && (
                <Button type="submit" disabled={loading}>
                  {loading ? "Wird gespeichert…" : isEdit ? "Speichern" : "Erstellen"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
