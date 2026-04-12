"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRelease } from "@/hooks/useRelease";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Plus, UserPlus } from "lucide-react";
import { ResourceEditDialog, type ResourceSnapshot } from "@/components/resources/ResourceEditDialog";

interface ResourcesPageProps {
  params: { id: string };
}

// ─── Ressource hinzufügen Dialog ──────────────────────────────────────────────

interface GlobalResourceOption {
  id: string;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    function: string | null;
  } | null;
  team: { name: string } | null;
}

interface AddResourceDialogProps {
  releaseId: string;
  open: boolean;
  onClose: () => void;
  alreadyAssigned: string[];
}

function AddResourceDialog({ releaseId, open, onClose, alreadyAssigned }: AddResourceDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { data } = useQuery<{ data: GlobalResourceOption[] }>({
    queryKey: ["admin-resources"],
    queryFn: async () => {
      const res = await fetch("/api/admin/resources");
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: open,
  });

  const available = (data?.data ?? []).filter(
    (r) => r.user !== null && !alreadyAssigned.includes(r.id)
  );

  async function handleAdd(globalResourceId: string) {
    setError("");
    setLoading(globalResourceId);
    try {
      const res = await fetch(`/api/releases/${releaseId}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ globalResourceId }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error?.message ?? "Fehler beim Hinzufügen.");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["resources", releaseId] });
    } finally {
      setLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ressource hinzufügen</DialogTitle>
        </DialogHeader>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        {available.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Alle verfügbaren Ressourcen sind diesem Release bereits zugewiesen.
          </p>
        ) : (
          <div className="divide-y rounded-md border max-h-96 overflow-y-auto">
            {available.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {r.user!.firstName[0]}{r.user!.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {r.user!.firstName} {r.user!.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {r.user!.email}
                    {r.user!.function && <span> · {r.user!.function}</span>}
                  </p>
                </div>
                {r.team && (
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {r.team.name}
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={loading === r.id}
                  onClick={() => handleAdd(r.id)}
                >
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                  {loading === r.id ? "Wird hinzugefügt…" : "Hinzufügen"}
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button variant="outline" onClick={onClose}>Schließen</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────

export default function ResourcesPage({ params }: ResourcesPageProps) {
  const { data: releaseData } = useRelease(params.id);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["resources", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/releases/${params.id}/resources`);
      if (!res.ok) throw new Error("Fehler beim Laden der Ressourcen.");
      return res.json();
    },
    enabled: Boolean(params.id),
  });

  const resources: ResourceSnapshot[] = data?.data ?? [];
  const currentUserRole = releaseData?.data?.currentUserRole;
  const canEdit = currentUserRole === "RELEASE_MANAGER";

  const [addOpen, setAddOpen]                   = useState(false);
  const [dialogOpen, setDialogOpen]             = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceSnapshot | null>(null);

  function openEdit(resource: ResourceSnapshot) {
    setSelectedResource(resource);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setSelectedResource(null);
  }

  const alreadyAssigned = resources.map((r) => r.globalResourceId);

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ressourcen</h1>
          {releaseData?.data && (
            <p className="text-sm text-muted-foreground mt-1">
              {releaseData.data.name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {resources.length} Ressource{resources.length !== 1 ? "n" : ""}
          </span>
          {canEdit && (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Ressource hinzufügen
            </Button>
          )}
        </div>
      </div>

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
          <p className="text-muted-foreground">Keine Ressourcen diesem Release zugewiesen.</p>
          {canEdit && (
            <Button variant="outline" className="mt-4" onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Erste Ressource hinzufügen
            </Button>
          )}
        </div>
      )}

      {!isLoading && !isError && resources.length > 0 && (
        <div className="rounded-lg border divide-y">
          {resources.map((r) => (
            <div key={r.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                {r.firstName[0]}{r.lastName[0]}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">
                  {r.firstName} {r.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.email}
                  {r.function && <span> · {r.function}</span>}
                </p>
              </div>

              {r.teamName && (
                <Badge variant="secondary" className="shrink-0">
                  {r.teamName}
                </Badge>
              )}

              {r.phone && (
                <span className="text-xs text-muted-foreground shrink-0">{r.phone}</span>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => openEdit(r)}
                title={canEdit ? "Bearbeiten / Entfernen" : "Details"}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AddResourceDialog
        releaseId={params.id}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        alreadyAssigned={alreadyAssigned}
      />

      <ResourceEditDialog
        releaseId={params.id}
        open={dialogOpen}
        onClose={closeDialog}
        canEdit={canEdit}
        resource={selectedResource}
      />
    </main>
  );
}
