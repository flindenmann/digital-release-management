"use client";

import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { Pencil, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// ─── Typen ────────────────────────────────────────────────────────────────────

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  user: { id: string; firstName: string; lastName: string };
}

interface TaskCommentsProps {
  releaseId: string;
  taskId: string;
  currentUserId: string;
  canEdit: boolean;
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function TaskComments({ releaseId, taskId, currentUserId, canEdit }: TaskCommentsProps) {
  const queryClient = useQueryClient();
  const [comments, setComments]       = useState<Comment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [newText, setNewText]         = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editText, setEditText]       = useState("");
  const [error, setError]             = useState("");
  const bottomRef                     = useRef<HTMLDivElement>(null);

  // ─── Laden ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    fetch(`/api/releases/${releaseId}/tasks/${taskId}/comments`)
      .then((r) => r.json())
      .then((d) => setComments(d.data ?? []))
      .finally(() => setLoading(false));
  }, [releaseId, taskId]);

  // ─── Neuer Kommentar ─────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!newText.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/releases/${releaseId}/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newText.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error?.message ?? "Fehler beim Speichern.");
        return;
      }
      const d = await res.json();
      setComments((prev) => [...prev, d.data]);
      setNewText("");
      queryClient.invalidateQueries({ queryKey: ["tasks", releaseId] });
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Bearbeiten ──────────────────────────────────────────────────────────────

  function startEdit(comment: Comment) {
    setEditingId(comment.id);
    setEditText(comment.content);
  }

  async function handleSaveEdit(id: string) {
    if (!editText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/releases/${releaseId}/tasks/${taskId}/comments/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editText.trim() }),
        }
      );
      if (!res.ok) return;
      const d = await res.json();
      setComments((prev) => prev.map((c) => (c.id === id ? d.data : c)));
      setEditingId(null);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Löschen ─────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm("Kommentar wirklich löschen?")) return;
    const res = await fetch(
      `/api/releases/${releaseId}/tasks/${taskId}/comments/${id}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id));
      queryClient.invalidateQueries({ queryKey: ["tasks", releaseId] });
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">
        Kommentare {comments.length > 0 && <span className="text-muted-foreground font-normal">({comments.length})</span>}
      </p>

      {/* Kommentarliste */}
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {loading && (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {!loading && comments.length === 0 && (
          <p className="text-xs text-muted-foreground">Noch keine Kommentare.</p>
        )}

        {!loading && comments.map((comment) => {
          const isOwn = comment.userId === currentUserId;
          const isEditing = editingId === comment.id;
          const edited = comment.createdAt !== comment.updatedAt;

          return (
            <div key={comment.id} className="rounded-md border bg-muted/30 px-3 py-2 text-sm group">
              {/* Header */}
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-xs">
                  {comment.user.firstName} {comment.user.lastName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(comment.createdAt), "dd.MM.yy HH:mm", { locale: de })}
                  {edited && <span className="italic"> (bearbeitet)</span>}
                </span>
                {/* Aktionen */}
                {(isOwn || canEdit) && !isEditing && (
                  <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isOwn && (
                      <button
                        type="button"
                        onClick={() => startEdit(comment)}
                        className="p-1 text-muted-foreground hover:text-foreground rounded"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      className="p-1 text-muted-foreground hover:text-destructive rounded"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Inhalt */}
              {isEditing ? (
                <div className="space-y-2 mt-1">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    className="text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingId(null)}
                    >
                      Abbrechen
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={submitting || !editText.trim()}
                      onClick={() => handleSaveEdit(comment.id)}
                    >
                      Speichern
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Neuer Kommentar */}
      <div className="flex gap-2 items-end">
        <Textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Kommentar schreiben…"
          rows={2}
          className="text-sm flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={submitting || !newText.trim()}
          className="h-10 shrink-0"
          onClick={handleSubmit}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
