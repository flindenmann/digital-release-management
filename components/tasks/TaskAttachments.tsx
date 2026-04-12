"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link2, Trash2, Plus, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Typen ────────────────────────────────────────────────────────────────────

interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  createdAt: string;
}

interface TaskAttachmentsProps {
  releaseId: string;
  taskId: string;
  canEdit: boolean;
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function TaskAttachments({ releaseId, taskId, canEdit }: TaskAttachmentsProps) {
  const queryClient = useQueryClient();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [name, setName]               = useState("");
  const [url, setUrl]                 = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState("");
  const [showForm, setShowForm]       = useState(false);

  // ─── Laden ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    fetch(`/api/releases/${releaseId}/tasks/${taskId}/attachments`)
      .then((r) => r.json())
      .then((d) => setAttachments(d.data ?? []))
      .finally(() => setLoading(false));
  }, [releaseId, taskId]);

  // ─── Hinzufügen ──────────────────────────────────────────────────────────────

  async function handleAdd() {
    if (!name.trim() || !url.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/releases/${releaseId}/tasks/${taskId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), url: url.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error?.message ?? "Fehler beim Speichern.");
        return;
      }
      const d = await res.json();
      setAttachments((prev) => [...prev, d.data]);
      setName("");
      setUrl("");
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["tasks", releaseId] });
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Löschen ─────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm("Anhang wirklich entfernen?")) return;
    const res = await fetch(
      `/api/releases/${releaseId}/tasks/${taskId}/attachments/${id}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      queryClient.invalidateQueries({ queryKey: ["tasks", releaseId] });
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          Anhänge {attachments.length > 0 && <span className="text-muted-foreground font-normal">({attachments.length})</span>}
        </p>
        {canEdit && !showForm && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Link hinzufügen
          </Button>
        )}
      </div>

      {/* Liste */}
      {loading && (
        <div className="h-8 rounded bg-muted animate-pulse" />
      )}

      {!loading && attachments.length === 0 && !showForm && (
        <p className="text-xs text-muted-foreground">Keine Anhänge.</p>
      )}

      {!loading && attachments.map((att) => (
        <div
          key={att.id}
          className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm group"
        >
          <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <a
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 truncate text-blue-600 hover:underline flex items-center gap-1 min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="truncate">{att.name}</span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
          </a>
          {canEdit && (
            <button
              type="button"
              onClick={() => handleDelete(att.id)}
              className="shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}

      {/* Formular */}
      {showForm && (
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <Input
            placeholder="Bezeichnung *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-sm h-8"
            autoFocus
          />
          <Input
            placeholder="URL *"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="text-sm h-8"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { setShowForm(false); setError(""); }}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submitting || !name.trim() || !url.trim()}
              onClick={handleAdd}
            >
              Hinzufügen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
