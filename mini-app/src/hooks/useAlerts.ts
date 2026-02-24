import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Alert {
  id: string;
  project_id: number;
  title: string;
  description: string | null;
  severity: "info" | "warning" | "critical";
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export function useAlerts(projectId: string | number) {
  return useQuery({
    queryKey: ["alerts", projectId],
    queryFn: async (): Promise<Alert[]> => {
      // TODO: implement /api/alerts endpoint
      return [];
    },
    enabled: !!projectId,
  });
}

export function useUnresolvedAlerts(projectId: string | number) {
  return useQuery({
    queryKey: ["alerts-unresolved", projectId],
    queryFn: async (): Promise<Alert[]> => {
      return [];
    },
    enabled: !!projectId,
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_params: { id: string; resolvedBy: string }) => {
      throw new Error("Not implemented yet");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["alerts-unresolved"] });
    },
  });
}

export function useCreateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_alert: Partial<Alert>) => {
      throw new Error("Not implemented yet");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}
