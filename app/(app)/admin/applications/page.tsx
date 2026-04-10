"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface GlobalApplication {
  id: string;
  name: string;
  prefix: string;
  description?: string | null;
  _count: { applicationSnapshots: number };
}

// ─── Formular-Dialog ──────────────────────────────────────────────────────────

interface AppDialogProps {
  open: boolean;
  onClose: () => void;
  app?: GlobalApplication | null;
}

function AppDialog({ open, onClose, app }: AppDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(app);

  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Felder beim Öffnen initialisieren
  useEffect(() => {
    if (open) {
      setName(app?.name ?? "");
      setPrefix(app?.prefix ?? "");
      setDescription(app?.description ?? "");
      setError("");
    }
  }, [open, app]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = isEdit
        ? `/api/admin/applications/${app!.id}`
        : "/api/admin/applications";
      const method = isEdit ? "PATCH" : "POST";

      const body: Record<string, unknown> = { name, description: description || undefined };
      if (!isEdit) body.prefix = prefix;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "Ein Fehler ist aufgetreten.");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Applikation bearbeiten" : "Neue Applikation"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="prefix">Prefix *</Label>
              <Input
                id="prefix"
                required
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toUpperCase())}
                placeholder="z.B. SYR"
                maxLength={10}
                pattern="[A-Z0-9]+"
                title="Nur Grossbuchstaben und Ziffern erlaubt"
              />
              <p className="text-xs text-muted-foreground">
                Wird für Task-Nummern verwendet (z.B. SYR-0001). Nicht änderbar nach Erstellung.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Applikationsname"
              maxLength={100}
            />
          </div>

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

export default function AdminApplicationsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editApp, setEditApp] = useState<GlobalApplication | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const { data, isLoading, isError } = useQuery<{ data: GlobalApplication[] }>({
    queryKey: ["admin-applications"],
    queryFn: async () => {
      const res = await fetch("/api/admin/applications");
      if (!res.ok) throw new Error("Fehler beim Laden der Applikationen.");
      return res.json();
    },
  });

  const applications = data?.data ?? [];

  function openCreate() {
    setEditApp(null);
    setDialogOpen(true);
  }

  function openEdit(app: GlobalApplication) {
    setEditApp(app);
    setDialogOpen(true);
  }

  async function handleDelete(app: GlobalApplication) {
    if (app._count.applicationSnapshots > 0) {
      setDeleteError(
        `"${app.name}" ist ${app._count.applicationSnapshots} Release(s) zugewiesen und kann nicht gelöscht werden.`
      );
      return;
    }
    if (!confirm(`Applikation "${app.name}" wirklich löschen?`)) return;

    setDeleteError("");
    const res = await fetch(`/api/admin/applications/${app.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      setDeleteError(d.error?.message ?? "Löschen fehlgeschlagen.");
    } else {
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
    }
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Applikationen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Globale Applikationsliste — wird bei Release-Erstellung zugewiesen
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Neue Applikation
        </Button>
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
          Fehler beim Laden der Applikationen.
        </div>
      )}

      {!isLoading && !isError && applications.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Noch keine Applikationen erfasst.</p>
          <Button variant="outline" className="mt-4" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Erste Applikation erstellen
          </Button>
        </div>
      )}

      {!isLoading && !isError && applications.length > 0 && (
        <div className="rounded-lg border divide-y">
          {applications.map((app) => (
            <div key={app.id} className="flex items-center gap-4 px-4 py-3">
              {/* Prefix-Badge */}
              <Badge variant="outline" className="font-mono shrink-0 text-xs px-2">
                {app.prefix}
              </Badge>

              {/* Name & Beschreibung */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{app.name}</p>
                {app.description && (
                  <p className="text-xs text-muted-foreground truncate">{app.description}</p>
                )}
              </div>

              {/* Release-Anzahl */}
              <span className="text-xs text-muted-foreground shrink-0">
                {app._count.applicationSnapshots === 0
                  ? "Kein Release"
                  : `${app._count.applicationSnapshots} Release${app._count.applicationSnapshots !== 1 ? "s" : ""}`}
              </span>

              {/* Aktionen */}
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEdit(app)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(app)}
                  disabled={app._count.applicationSnapshots > 0}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AppDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        app={editApp}
      />
    </main>
  );
}
