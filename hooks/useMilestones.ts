import { useQuery } from "@tanstack/react-query";

export function useMilestones(releaseId: string) {
  return useQuery({
    queryKey: ["milestones", releaseId],
    queryFn: async () => {
      const res = await fetch(`/api/releases/${releaseId}/milestones`);
      if (!res.ok) throw new Error("Fehler beim Laden der Meilensteine.");
      return res.json();
    },
    enabled: Boolean(releaseId),
  });
}
