"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface ResourceSnapshot {
  id:               string;
  globalResourceId: string;
  firstName:        string;
  lastName:         string;
  email:            string;
  phone?:           string | null;
  function?:        string | null;
  teamName?:        string | null;
}

interface ResourceEditDialogProps {
  releaseId: string;
  open:      boolean;
  onClose:   () => void;
  canEdit:   boolean;
  resource:  ResourceSnapshot | null;
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function ResourceEditDialog({
  releaseId,
  open,
  onClose,
  canEdit,
  resource,
}: ResourceEditDialogProps) {
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [phone,     setPhone]     = useState("");
  const [func,      setFunc]      = useState("");
  const [teamName,  setTeamName]  = useState("");

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // Felder beim Öffnen befüllen
  useEffect(() => {
    if (resource) {
      setFirstName(resource.firstName);
      setLastName(resource.lastName);
      setEmail(resource.email);
      setPhone(resource.phone ?? "");
      setFunc(resource.function ?? "");
      setTeamName(resource.teamName ?? "");
    }
    setError("");
  }, [resource, open]);

  // ─── Speichern ──────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resource) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/releases/${releaseId}/resources/${resource.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          firstName,
          lastName,
          email,
          phone:    phone    || null,
          function: func     || null,
          teamName: teamName || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "Ein Fehler ist aufgetreten.");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["resources", releaseId] });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  // ─── Löschen ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!resource) return;
    if (!confirm(`Ressource "${resource.firstName} ${resource.lastName}" aus diesem Release entfernen?`)) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/releases/${releaseId}/resources/${resource.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.message ?? "Fehler beim Entfernen.");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["resources", releaseId] });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ressource bearbeiten</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">

          {/* Vorname / Nachname */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="res-firstname">Vorname *</Label>
              <Input
                id="res-firstname"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="res-lastname">Nachname *</Label>
              <Input
                id="res-lastname"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>

          {/* E-Mail */}
          <div className="space-y-2">
            <Label htmlFor="res-email">E-Mail *</Label>
            <Input
              id="res-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!canEdit}
            />
          </div>

          {/* Telefon */}
          <div className="space-y-2">
            <Label htmlFor="res-phone">Telefon</Label>
            <Input
              id="res-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
              disabled={!canEdit}
            />
          </div>

          {/* Funktion */}
          <div className="space-y-2">
            <Label htmlFor="res-function">Funktion</Label>
            <Input
              id="res-function"
              value={func}
              onChange={(e) => setFunc(e.target.value)}
              placeholder="Optional"
              disabled={!canEdit}
            />
          </div>

          {/* Team */}
          <div className="space-y-2">
            <Label htmlFor="res-team">Team</Label>
            <Input
              id="res-team"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Optional"
              disabled={!canEdit}
            />
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-between gap-2 pt-2">
            <div>
              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive border-destructive/50 hover:bg-destructive/10"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  Entfernen
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {canEdit ? "Abbrechen" : "Schliessen"}
              </Button>
              {canEdit && (
                <Button type="submit" disabled={loading}>
                  {loading ? "Wird gespeichert…" : "Speichern"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
