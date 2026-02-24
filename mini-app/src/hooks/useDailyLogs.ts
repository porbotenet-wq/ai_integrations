import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DailyLog {
  id: string;
  project_id: string;
  zone_name: string | null;
  date: string;
  works_description: string;
  volume: string | null;
  workers_count: number | null;
  issues_description: string | null;
  weather: string | null;
  status: "draft" | "submitted" | "reviewed" | "approved" | "rejected";
  submitted_by: string | null;
  reviewed_by: string | null;
  review_comment: string | null;
  photo_urls: string[];
  created_at: string;
}

export function useDailyLogs(projectId: string, filters?: { status?: string; date?: string }) {
  return useQuery({
    queryKey: ["daily-logs", projectId, filters],
    queryFn: async (): Promise<DailyLog[]> => {
      let query = (supabase.from("daily_logs" as any) as any)
        .select("*")
        .eq("project_id", projectId)
        .order("date", { ascending: false })
        .limit(50);

      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.date) query = query.eq("date", filters.date);

      const { data, error } = await query;
      if (error) throw error;
      return (data as DailyLog[]) || [];
    },
    enabled: !!projectId,
  });
}

export function useCreateDailyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (log: Partial<DailyLog> & { project_id: string; works_description: string }) => {
      const { data, error } = await (supabase.from("daily_logs" as any) as any)
        .insert({
          ...log,
          status: "draft",
          date: log.date || new Date().toISOString().split("T")[0],
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["daily-logs", vars.project_id] });
    },
  });
}

export function useSubmitDailyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await (supabase.from("daily_logs" as any) as any)
        .update({ status: "submitted", updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return { id, projectId };
    },
    onSuccess: (vars) => {
      qc.invalidateQueries({ queryKey: ["daily-logs", vars.projectId] });
    },
  });
}

export function useReviewDailyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      projectId,
      decision,
      comment,
    }: {
      id: string;
      projectId: string;
      decision: "approved" | "rejected";
      comment?: string;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      const { error } = await (supabase.from("daily_logs" as any) as any)
        .update({
          status: decision,
          reviewed_by: session?.session?.user?.id || null,
          review_comment: comment || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      return { id, projectId };
    },
    onSuccess: (vars) => {
      qc.invalidateQueries({ queryKey: ["daily-logs", vars.projectId] });
    },
  });
}
