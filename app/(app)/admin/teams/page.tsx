"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Users, Download, Upload, CheckCircle2, XCircle } from "lucide-react";
import Papa from "papaparse";

interface Team {
  id: string;
  name: string;
  description?: string | null;
  _count: { globalResources: number };
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCsv(teams: Team[]) {
  const csv = Papa.unparse(
    teams.map((t) => ({
      name: t.name,
      description: t.description ?? "",
    })),
    { header: true }
  );
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "teams.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function downloadTemplate() {
  const csv = Papa.unparse(
    [{ name: "Team A", description: "Optionale Beschreibung" }],
    { header: true }
  );
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "teams_vorlage.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Import Dialog ────────────────────────────────────────────────────────────

interface ImportResult {
  index: number;
  success: boolean;
  error?: string;
}

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
}

function ImportDialog({ open, onClose }: ImportDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [parseError, setParseError] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);

  useEffect(() => {
    if (open) {
      setRows([]);
      setParseError("");
      setResults(null);
    }
  }, [open]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");
    setResults(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          setParseError("CSV-Datei konnte nicht gelesen werden: " + result.errors[0].message);
          return;
        }
        if (result.data.length === 0) {
          setParseError("Die Datei enthält keine Datenzeilen.");
          return;
        }
        setRows(result.data);
      },
    });
    e.target.value = "";
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/teams/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = await res.json();
      setResults(data.results ?? []);
      queryClient.invalidateQueries({ queryKey: ["admin-teams-full"] });
      queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
    } finally {
      setLoading(false);
    }
  }

  const successCount = results?.filter((r) => r.success).length ?? 0;
  const errorCount = results?.filter((r) => !r.success).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Teams importieren</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
            <div>
              <p className="text-sm font-medium">CSV-Vorlage</p>
              <p className="text-xs text-muted-foreground">Spalten: name, description</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Vorlage
            </Button>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              <Upload className="mr-2 h-4 w-4" />
              CSV-Datei auswählen
            </Button>
          </div>

          {parseError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{parseError}</p>
          )}

          {rows.length > 0 && !results && (
            <div className="rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{rows.length} Zeile{rows.length !== 1 ? "n" : ""}</span> erkannt — bereit zum Importieren
              </p>
              <div className="mt-1 max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-0.5">
                {rows.slice(0, 5).map((r, i) => (
                  <p key={i} className="truncate">{r.name}</p>
                ))}
                {rows.length > 5 && <p>…und {rows.length - 5} weitere</p>}
              </div>
            </div>
          )}

          {results && (
            <div className="space-y-2">
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {successCount} erfolgreich
                </span>
                {errorCount > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <XCircle className="h-4 w-4" />
                    {errorCount} Fehler
                  </span>
                )}
              </div>
              {results.filter((r) => !r.success).length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/30 p-2 space-y-1">
                  {results.filter((r) => !r.success).map((r) => (
                    <p key={r.index} className="text-xs text-destructive">
                      Zeile {r.index + 2}: {r.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              {results ? "Schliessen" : "Abbrechen"}
            </Button>
            {!results && (
              <Button onClick={handleImport} disabled={rows.length === 0 || loading}>
                {loading ? "Wird importiert…" : `${rows.length} Zeile${rows.length !== 1 ? "n" : ""} importieren`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Team Dialog ──────────────────────────────────────────────────────────────

interface TeamDialogProps {
  open: boolean;
  onClose: () => void;
  team?: Team | null;
}

function TeamDialog({ open, onClose, team }: TeamDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(team);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName(team?.name ?? "");
      setDescription(team?.description ?? "");
      setError("");
    }
  }, [open, team]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = isEdit ? `/api/admin/teams/${team!.id}` : "/api/admin/teams";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "Ein Fehler ist aufgetreten.");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["admin-teams-full"] });
      queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Team bearbeiten" : "Neues Team"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="team-name">Name *</Label>
            <Input
              id="team-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Teamname"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-description">Beschreibung</Label>
            <Textarea
              id="team-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionale Beschreibung…"
              rows={3}
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
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

// ─── Hauptseite ───────────────────────────────────────────────────────────────

export default function AdminTeamsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const { data, isLoading, isError } = useQuery<{ data: Team[] }>({
    queryKey: ["admin-teams-full"],
    queryFn: async () => {
      const res = await fetch("/api/admin/teams");
      if (!res.ok) throw new Error("Fehler beim Laden der Teams.");
      return res.json();
    },
  });

  const teams = data?.data ?? [];

  function openCreate() {
    setEditTeam(null);
    setDialogOpen(true);
  }

  function openEdit(team: Team) {
    setEditTeam(team);
    setDialogOpen(true);
  }

  async function handleDelete(team: Team) {
    if (team._count.globalResources > 0) {
      setDeleteError(
        `"${team.name}" ist ${team._count.globalResources} Ressource(n) zugewiesen und kann nicht gelöscht werden.`
      );
      return;
    }
    if (!confirm(`Team "${team.name}" wirklich löschen?`)) return;

    setDeleteError("");
    const res = await fetch(`/api/admin/teams/${team.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      setDeleteError(d.error?.message ?? "Löschen fehlgeschlagen.");
    } else {
      queryClient.invalidateQueries({ queryKey: ["admin-teams-full"] });
      queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
    }
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Globale Teamliste — wird Ressourcen zugewiesen
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportCsv(teams)} disabled={teams.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Neues Team
          </Button>
        </div>
      </div>

      {deleteError && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {deleteError}
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg border bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Fehler beim Laden der Teams.
        </div>
      )}

      {!isLoading && !isError && teams.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Noch keine Teams erfasst.</p>
          <Button variant="outline" className="mt-4" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Erstes Team erstellen
          </Button>
        </div>
      )}

      {!isLoading && !isError && teams.length > 0 && (
        <div className="rounded-lg border divide-y">
          {teams.map((team) => (
            <div key={team.id} className="flex items-center gap-4 px-4 py-3">
              <div className="shrink-0 h-9 w-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <Users className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{team.name}</p>
                {team.description && (
                  <p className="text-xs text-muted-foreground truncate">{team.description}</p>
                )}
              </div>

              <span className="text-xs text-muted-foreground shrink-0">
                {team._count.globalResources === 0
                  ? "Keine Ressourcen"
                  : `${team._count.globalResources} Ressource${team._count.globalResources !== 1 ? "n" : ""}`}
              </span>

              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(team)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(team)}
                  disabled={team._count.globalResources > 0}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TeamDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        team={editTeam}
      />
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </main>
  );
}
