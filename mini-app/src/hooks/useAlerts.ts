import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Alert } from "@/types/database";

export function useAlerts(projectId: string) {
  return useQuery({
    queryKey: ["alerts", projectId],
    queryFn: async (): Promise<Alert[]> => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Alert[]) || [];
    },
    enabled: !!projectId,
  });
}

export function useUnresolvedAlerts(projectId: string) {
  return useQuery({
    queryKey: ["alerts-unresolved", projectId],
    queryFn: async (): Promise<Alert[]> => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_resolved", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Alert[]) || [];
    },
    enabled: !!projectId,
  });
}

export function useResolveAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resolvedBy }: { id: string; resolvedBy: string }) => {
      const { error } = await supabase
        .from("alerts")
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy,
        } as any)
        .eq("id", id);
      if (error) throw error;
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
    mutationFn: async (alert: Partial<Alert> & { project_id: string; title: string }) => {
      const { data, error } = await supabase
        .from("alerts")
        .insert({ ...alert, is_resolved: false } as any)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}
