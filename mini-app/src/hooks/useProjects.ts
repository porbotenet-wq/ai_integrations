import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => api.getObjects(),
  });
}

export function useProject(projectId: string | number) {
  const id = Number(projectId);
  return useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const objects = await api.getObjects();
      return objects.find((o: any) => o.id === id) || null;
    },
    enabled: !!projectId,
  });
}
