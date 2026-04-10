import { useQuery } from "@tanstack/react-query";

interface UseTasksOptions {
  releaseId: string;
  /** Wenn true, werden nur Tasks des aktuellen Users geladen (Sachbearbeiter-Ansicht) */
  onlyOwn?: boolean;
}

export function useTasks({ releaseId, onlyOwn = false }: UseTasksOptions) {
  return useQuery({
    queryKey: ["tasks", releaseId, { onlyOwn }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (onlyOwn) params.set("onlyOwn", "true");
      const res = await fetch(
        `/api/releases/${releaseId}/tasks?${params.toString()}`
      );
      if (!res.ok) throw new Error("Fehler beim Laden der Tasks.");
      return res.json();
    },
    enabled: Boolean(releaseId),
  });
}
