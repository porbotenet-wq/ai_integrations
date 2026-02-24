import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useProductionDashboard(objectId: number) {
  return useQuery({
    queryKey: ["production-dashboard", objectId],
    queryFn: () => api.getDashboard(objectId),
    enabled: !!objectId,
  });
}

export function useCrews(objectId?: number) {
  return useQuery({
    queryKey: ["crews", objectId],
    queryFn: () => api.getCrews(objectId),
  });
}

export function useWorkTypes() {
  return useQuery({
    queryKey: ["work-types"],
    queryFn: () => api.getWorkTypes(),
  });
}

export function useFloorVolumes(objectId: number, params?: { floor?: number; facade?: string; work_code?: string }) {
  return useQuery({
    queryKey: ["floor-volumes", objectId, params],
    queryFn: () => api.getFloorVolumes(objectId, params),
    enabled: !!objectId,
  });
}

export function usePlanFact(objectId: number, params?: { date_from?: string; date_to?: string; work_code?: string; crew_code?: string; floor?: number }) {
  return useQuery({
    queryKey: ["plan-fact", objectId, params],
    queryFn: () => api.getPlanFact(objectId, params),
    enabled: !!objectId,
  });
}

export function useDailyProgress(objectId: number, week?: string) {
  return useQuery({
    queryKey: ["daily-progress", objectId, week],
    queryFn: () => api.getDailyProgress(objectId, week),
    enabled: !!objectId,
  });
}

export function useGPRWeekly(objectId: number) {
  return useQuery({
    queryKey: ["gpr-weekly", objectId],
    queryFn: () => api.getGPRWeekly(objectId),
    enabled: !!objectId,
  });
}

export function useProjectSummary(objectId: number) {
  return useQuery({
    queryKey: ["project-summary", objectId],
    queryFn: () => api.getSummary(objectId),
    enabled: !!objectId,
  });
}
