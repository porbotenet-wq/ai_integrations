import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useFacades(projectId: string | number) {
  const id = Number(projectId);
  return useQuery({
    queryKey: ["facades", id],
    queryFn: async () => {
      const volumes = await api.getFloorVolumes(id);
      // Extract unique facades
      const facadeSet = new Set(volumes.map((v: any) => v.facade));
      return Array.from(facadeSet).map((name) => ({
        id: name,
        name,
        project_id: id,
      }));
    },
    enabled: !!projectId,
  });
}

export function useFloors(projectId: string | number, params?: { floor?: number; facade?: string }) {
  const id = Number(projectId);
  return useQuery({
    queryKey: ["floors", id, params],
    queryFn: () => api.getFloorVolumes(id, params),
    enabled: !!projectId,
  });
}
