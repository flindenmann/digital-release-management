"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRelease } from "@/hooks/useRelease";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { ResourceEditDialog, type ResourceSnapshot } from "@/components/resources/ResourceEditDialog";

interface ResourcesPageProps {
  params: { id: string };
}

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

  const [dialogOpen, setDialogOpen]         = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceSnapshot | null>(null);

  function openEdit(resource: ResourceSnapshot) {
    setSelectedResource(resource);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setSelectedResource(null);
  }

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
        <span className="text-sm text-muted-foreground">
          {resources.length} Ressource{resources.length !== 1 ? "n" : ""}
        </span>
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
        </div>
      )}

      {!isLoading && !isError && resources.length > 0 && (
        <div className="rounded-lg border divide-y">
          {resources.map((r) => (
            <div key={r.id} className="flex items-center gap-4 px-4 py-3">
              {/* Avatar-Initialen */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                {r.firstName[0]}{r.lastName[0]}
              </div>

              {/* Name & Details */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">
                  {r.firstName} {r.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.email}
                  {r.function && <span> · {r.function}</span>}
                </p>
              </div>

              {/* Team */}
              {r.teamName && (
                <Badge variant="secondary" className="shrink-0">
                  {r.teamName}
                </Badge>
              )}

              {/* Telefon */}
              {r.phone && (
                <span className="text-xs text-muted-foreground shrink-0">{r.phone}</span>
              )}

              {/* Bearbeiten-Button */}
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => openEdit(r)}
                title="Bearbeiten"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

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
