import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Facade, Floor } from "@/types/database";

export function useFacades(projectId: string) {
  return useQuery({
    queryKey: ["facades", projectId],
    queryFn: async (): Promise<Facade[]> => {
      const { data, error } = await supabase
        .from("facades")
        .select("*")
        .eq("project_id", projectId)
        .order("name");
      if (error) throw error;
      return (data as unknown as Facade[]) || [];
    },
    enabled: !!projectId,
  });
}

export function useFloors(facadeIds: string[]) {
  return useQuery({
    queryKey: ["floors", facadeIds],
    queryFn: async (): Promise<Floor[]> => {
      if (facadeIds.length === 0) return [];
      const { data, error } = await supabase
        .from("floors")
        .select("*")
        .in("facade_id", facadeIds)
        .order("floor_number", { ascending: false });
      if (error) throw error;
      return (data as unknown as Floor[]) || [];
    },
    enabled: facadeIds.length > 0,
  });
}

export function useUpdateFloor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Floor> & { id: string }) => {
      const { error } = await supabase
        .from("floors")
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["floors"] });
    },
  });
}

export function useCreateFacade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (facade: Partial<Facade> & { project_id: string; name: string }) => {
      const { data, error } = await supabase
        .from("facades")
        .insert(facade as any)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["facades", variables.project_id] });
    },
  });
}
