import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PlanFactRecord, WorkTypeRecord } from "@/types/database";

export function usePlanFact(projectId: string) {
  return useQuery({
    queryKey: ["plan-fact", projectId],
    queryFn: async (): Promise<PlanFactRecord[]> => {
      const { data, error } = await supabase
        .from("plan_fact")
        .select("*")
        .eq("project_id", projectId)
        .order("date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as PlanFactRecord[]) || [];
    },
    enabled: !!projectId,
  });
}

export function useWorkTypes(projectId: string) {
  return useQuery({
    queryKey: ["work-types", projectId],
    queryFn: async (): Promise<WorkTypeRecord[]> => {
      const { data, error } = await supabase
        .from("work_types")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_number");
      if (error) throw error;
      return (data as WorkTypeRecord[]) || [];
    },
    enabled: !!projectId,
  });
}
