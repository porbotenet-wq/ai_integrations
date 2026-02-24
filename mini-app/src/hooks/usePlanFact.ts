import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function usePlanFact(projectId: string | number, params?: { date_from?: string; date_to?: string; work_code?: string; crew_code?: string; floor?: number }) {
  const id = Number(projectId);
  return useQuery({
    queryKey: ["plan-fact", id, params],
    queryFn: () => api.getPlanFact(id, params),
    enabled: !!projectId,
  });
}

export function useWorkTypes() {
  return useQuery({
    queryKey: ["work-types"],
    queryFn: () => api.getWorkTypes(),
  });
}
