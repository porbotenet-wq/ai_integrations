import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface CalendarEvent {
  id: string;
  project_id: number;
  title: string;
  date: string;
  type: string;
  is_done: boolean;
  created_at: string;
}

export function useCalendarEvents(projectId: string | number) {
  return useQuery({
    queryKey: ["calendar", projectId],
    queryFn: async (): Promise<CalendarEvent[]> => {
      // TODO: implement /api/calendar endpoint
      return [];
    },
    enabled: !!projectId,
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_event: Partial<CalendarEvent>) => {
      throw new Error("Not implemented yet");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}

export function useToggleEventDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_params: { id: string; isDone: boolean }) => {
      throw new Error("Not implemented yet");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
  });
}
