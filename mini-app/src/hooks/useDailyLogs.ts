import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface DailyLog {
  id: string;
  project_id: number;
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

export function useDailyLogs(projectId: string | number, filters?: { status?: string; date?: string }) {
  const id = Number(projectId);
  return useQuery({
    queryKey: ["daily-logs", id, filters],
    queryFn: async (): Promise<DailyLog[]> => {
      // TODO: implement /api/daily-logs endpoint
      // For now, map daily_progress data
      const progress = await api.getDailyProgress(id);
      return progress.map((p: any, i: number) => ({
        id: String(i),
        project_id: id,
        zone_name: null,
        date: p.date,
        works_description: `Модули: ${p.modules_fact}, Кронштейны: ${p.brackets_fact}`,
        volume: String(p.modules_fact),
        workers_count: null,
        issues_description: null,
        weather: null,
        status: "approved" as const,
        submitted_by: null,
        reviewed_by: null,
        review_comment: null,
        photo_urls: [],
        created_at: p.date,
      }));
    },
    enabled: !!projectId,
  });
}

export function useCreateDailyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_log: Partial<DailyLog>) => {
      // TODO: implement POST /api/daily-logs
      throw new Error("Not implemented yet");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-logs"] });
    },
  });
}

export function useSubmitDailyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_params: { id: string; projectId: string }) => {
      throw new Error("Not implemented yet");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-logs"] });
    },
  });
}

export function useReviewDailyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_params: { id: string; projectId: string; decision: "approved" | "rejected"; comment?: string }) => {
      throw new Error("Not implemented yet");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-logs"] });
    },
  });
}
