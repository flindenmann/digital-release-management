"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";

// ─── Typen ────────────────────────────────────────────────────────────────────

interface GlobalResource {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    function: string | null;
    phone: string | null;
    username: string;
  } | null;
  team: { id: string; name: string } | null;
  _count: { resourceSnapshots: number };
}

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  function: string | null;
}

// ─── Ressource hinzufügen ─────────────────────────────────────────────────────

interface AddResourceDialogProps {
  open: boolean;
  onClose: () => void;
  existingUserIds: string[];
}

function AddResourceDialog({ open, onClose, existingUserIds }: AddResourceDialogProps) {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: usersData } = useQuery<{ data: AdminUser[] }>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Fehler beim Laden der Benutzer.");
      return res.json();
    },
    enabled: open,
  });

  const availableUsers = (usersData?.data ?? []).filter(
    (u) => !existingUserIds.includes(u.id)
  );

  useEffect(() => {
    if (open) {
      setSelectedUserId("");
      setTeamName("");
      setError("");
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          teamName: teamName || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "Ein Fehler ist aufgetreten.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ressource hinzufügen</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="userId">Person *</Label>
            <select
              id="userId"
              required
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Bitte auswählen…</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.email})
                </option>
              ))}
            </select>
            {usersData && availableUsers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Alle Benutzer sind bereits als Ressourcen erfasst.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="teamName">Team</Label>
            <Input
              id="teamName"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="z.B. Operations (optional)"
              maxLength={100}
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
            <Button type="submit" disabled={loading || !selectedUserId}>
              {loading ? "Wird gespeichert…" : "Hinzufügen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Team bearbeiten ──────────────────────────────────────────────────────────

interface EditResourceDialogProps {
  open: boolean;
  onClose: () => void;
  resource: GlobalResource | null;
}

function EditResourceDialog({ open, onClose, resource }: EditResourceDialogProps) {
  const queryClient = useQueryClient();
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && resource) {
      setTeamName(resource.team?.name ?? "");
      setError("");
    }
  }, [open, resource]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resource) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/resources/${resource.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName: teamName || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "Ein Fehler ist aufgetreten.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ressource bearbeiten</DialogTitle>
        </DialogHeader>

        {resource?.user && (
          <p className="text-sm text-muted-foreground">
            Team-Zuweisung für{" "}
            <span className="font-medium text-foreground">
              {resource.user.firstName} {resource.user.lastName}
            </span>{" "}
            anpassen.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div className="space-y-2">
            <Label htmlFor="editTeamName">Team</Label>
            <Input
              id="editTeamName"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Leer lassen für kein Team"
              maxLength={100}
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Wird gespeichert…" : "Speichern"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────

export default function AdminResourcesPage() {
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editResource, setEditResource] = useState<GlobalResource | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const { data, isLoading, isError } = useQuery<{ data: GlobalResource[] }>({
    queryKey: ["admin-resources"],
    queryFn: async () => {
      const res = await fetch("/api/admin/resources");
      if (!res.ok) throw new Error("Fehler beim Laden der Ressourcen.");
      return res.json();
    },
  });

  const resources = data?.data ?? [];
  const existingUserIds = resources
    .map((r) => r.user?.id)
    .filter(Boolean) as string[];

  async function handleDelete(resource: GlobalResource) {
    if (resource._count.resourceSnapshots > 0) {
      const name = resource.user
        ? `${resource.user.firstName} ${resource.user.lastName}`
        : "Diese Ressource";
      setDeleteError(
        `"${name}" ist ${resource._count.resourceSnapshots} Release(s) zugewiesen und kann nicht gelöscht werden.`
      );
      return;
    }
    const name = resource.user
      ? `${resource.user.firstName} ${resource.user.lastName}`
      : "diese Ressource";
    if (!confirm(`Ressource "${name}" wirklich aus der globalen Liste entfernen?`)) return;

    setDeleteError("");
    const res = await fetch(`/api/admin/resources/${resource.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const d = await res.json();
      setDeleteError(d.error?.message ?? "Löschen fehlgeschlagen.");
    } else {
      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
    }
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ressourcenverwaltung</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Globale Ressourcenliste — Personen für Release-Zuweisung verwalten
          </p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Ressource hinzufügen
        </Button>
      </div>

      {deleteError && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {deleteError}
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg border bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Fehler beim Laden der Ressourcen.
        </div>
      )}

      {!isLoading && !isError && resources.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">Noch keine Ressourcen erfasst.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Erste Ressource hinzufügen
          </Button>
        </div>
      )}

      {!isLoading && !isError && resources.length > 0 && (
        <div className="rounded-lg border divide-y">
          {resources.map((resource) => (
            <div key={resource.id} className="flex items-center gap-4 px-4 py-3">
              {/* Avatar-Initialen */}
              <div className="shrink-0 h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground select-none">
                {resource.user
                  ? `${resource.user.firstName[0]}${resource.user.lastName[0]}`
                  : "?"}
              </div>

              {/* Name, E-Mail, Funktion */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">
                    {resource.user
                      ? `${resource.user.firstName} ${resource.user.lastName}`
                      : "(Kein Benutzer)"}
                  </p>
                  {resource.team && (
                    <Badge variant="secondary" className="text-xs">
                      {resource.team.name}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {resource.user?.email}
                  {resource.user?.function && (
                    <span className="ml-2 text-muted-foreground/70">
                      · {resource.user.function}
                    </span>
                  )}
                </p>
              </div>

              {/* Telefon + Release-Anzahl */}
              <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
                {resource.user?.phone && (
                  <span className="text-xs text-muted-foreground">
                    {resource.user.phone}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {resource._count.resourceSnapshots === 0
                    ? "Kein Release"
                    : `${resource._count.resourceSnapshots} Release${resource._count.resourceSnapshots !== 1 ? "s" : ""}`}
                </span>
              </div>

              {/* Aktionen */}
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Bearbeiten"
                  onClick={() => setEditResource(resource)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  title="Entfernen"
                  onClick={() => handleDelete(resource)}
                  disabled={resource._count.resourceSnapshots > 0}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddResourceDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        existingUserIds={existingUserIds}
      />
      <EditResourceDialog
        open={editResource !== null}
        onClose={() => setEditResource(null)}
        resource={editResource}
      />
    </main>
  );
}
