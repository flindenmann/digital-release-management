import { useQuery } from "@tanstack/react-query";

export function useReleases() {
  return useQuery({
    queryKey: ["releases"],
    queryFn: async () => {
      const res = await fetch("/api/releases");
      if (!res.ok) throw new Error("Fehler beim Laden der Releases.");
      return res.json();
    },
  });
}
