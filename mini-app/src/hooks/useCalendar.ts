import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CalendarEvent } from "@/types/database";

export function useCalendarEvents(projectId: string) {
  return useQuery({
    queryKey: ["calendar", projectId],
    queryFn: async (): Promise<CalendarEvent[]> => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("project_id", projectId)
        .order("date");
      if (error) throw error;
      return (data as CalendarEvent[]) || [];
    },
    enabled: !!projectId,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (event: Partial<CalendarEvent> & { project_id: string }) => {
      const { data, error } = await supabase
        .from("calendar_events")
        .insert({ ...event, is_done: false, created_at: new Date().toISOString() } as any)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useToggleEventDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isDone }: { id: string; isDone: boolean }) => {
      const { error } = await supabase
        .from("calendar_events")
        .update({ is_done: !isDone } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}
