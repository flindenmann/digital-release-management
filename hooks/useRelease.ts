import { useQuery } from "@tanstack/react-query";

export function useRelease(id: string) {
  return useQuery({
    queryKey: ["release", id],
    queryFn: async () => {
      const res = await fetch(`/api/releases/${id}`);
      if (!res.ok) throw new Error("Fehler beim Laden des Releases.");
      return res.json();
    },
    enabled: Boolean(id),
  });
}
