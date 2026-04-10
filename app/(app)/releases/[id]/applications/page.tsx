"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRelease } from "@/hooks/useRelease";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";

interface ApplicationSnapshot {
  id: string;
  globalApplicationId: string;
  name: string;
  prefix: string;
  description?: string | null;
}

interface GlobalApplication {
  id: string;
  name: string;
  prefix: string;
  description?: string | null;
}

interface ApplicationsPageProps {
  params: { id: string };
}

// ─── Zuweisung-Dialog ────────────────────────────────────────────────────────

function AssignApplicationDialog({
  releaseId,
  open,
  onClose,
  assignedIds,
}: {
  releaseId: string;
  open: boolean;
  onClose: () => void;
  assignedIds: Set<string>;
}) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { data } = useQuery<{ data: GlobalApplication[] }>({
    queryKey: ["admin-applications"],
    queryFn: async () => {
      const res = await fetch("/api/admin/applications");
      if (!res.ok) throw new Error("Fehler beim Laden.");
      return res.json();
    },
    enabled: open,
  });

  const available = (data?.data ?? []).filter((a) => !assignedIds.has(a.id));

  async function handleAssign(app: GlobalApplication) {
    setError("");
    setLoading(app.id);
    try {
      const res = await fetch(`/api/releases/${releaseId}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ globalApplicationId: app.id }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error?.message ?? "Zuweisung fehlgeschlagen.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["release-applications", releaseId] });
      onClose();
    } finally {
      setLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Applikation zuweisen</DialogTitle>
        </DialogHeader>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {available.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Alle globalen Applikationen sind bereits diesem Release zugewiesen.
          </p>
        ) : (
          <div className="divide-y rounded-lg border max-h-80 overflow-y-auto">
            {available.map((app) => (
              <div key={app.id} className="flex items-center gap-3 px-4 py-3">
                <Badge variant="outline" className="font-mono shrink-0 text-xs px-2">
                  {app.prefix}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{app.name}</p>
                  {app.description && (
                    <p className="text-xs text-muted-foreground truncate">{app.description}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  disabled={loading === app.id}
                  onClick={() => handleAssign(app)}
                >
                  {loading === app.id ? "Wird zugewiesen…" : "Zuweisen"}
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Schliessen</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────

export default function ReleaseApplicationsPage({ params }: ApplicationsPageProps) {
  const queryClient = useQueryClient();
  const { data: releaseData } = useRelease(params.id);
  const currentUserRole = releaseData?.data?.currentUserRole;
  const canManage = currentUserRole === "RELEASE_MANAGER";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const { data, isLoading, isError } = useQuery<{ data: ApplicationSnapshot[] }>({
    queryKey: ["release-applications", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/releases/${params.id}/applications`);
      if (!res.ok) throw new Error("Fehler beim Laden der Applikationen.");
      return res.json();
    },
    enabled: Boolean(params.id),
  });

  const applications: ApplicationSnapshot[] = data?.data ?? [];
  const assignedIds = new Set(applications.map((a) => a.globalApplicationId as string));

  async function handleRemove(snapshot: ApplicationSnapshot) {
    if (!confirm(`Applikation "${snapshot.name}" aus diesem Release entfernen?`)) return;
    setRemoveError("");
    const res = await fetch(`/api/releases/${params.id}/applications/${snapshot.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const d = await res.json();
      setRemoveError(d.error?.message ?? "Entfernen fehlgeschlagen.");
    } else {
      queryClient.invalidateQueries({ queryKey: ["release-applications", params.id] });
    }
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Applikationen</h1>
          {releaseData?.data && (
            <p className="text-sm text-muted-foreground mt-1">
              {releaseData.data.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {applications.length} Applikation{applications.length !== 1 ? "en" : ""}
          </span>
          {canManage && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Applikation zuweisen
            </Button>
          )}
        </div>
      </div>

      {removeError && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {removeError}
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
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
          <p className="text-muted-foreground">Keine Applikationen diesem Release zugewiesen.</p>
          {canManage && (
            <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Erste Applikation zuweisen
            </Button>
          )}
        </div>
      )}

      {!isLoading && !isError && applications.length > 0 && (
        <div className="rounded-lg border divide-y">
          {applications.map((app) => (
            <div key={app.id} className="flex items-center gap-4 px-4 py-3">
              <Badge variant="outline" className="font-mono shrink-0 text-xs px-2">
                {app.prefix}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{app.name}</p>
                {app.description && (
                  <p className="text-xs text-muted-foreground truncate">{app.description}</p>
                )}
              </div>
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                  onClick={() => handleRemove(app)}
                  title="Zuweisung aufheben"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <AssignApplicationDialog
        releaseId={params.id}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        assignedIds={assignedIds}
      />
    </main>
  );
}
