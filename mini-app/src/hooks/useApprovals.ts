import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Approval {
  id: string;
  project_id: string;
  type: "daily_log" | "material_request" | "task_completion" | "budget" | "other";
  entity_id: string | null;
  title: string;
  description: string | null;
  requested_by: string | null;
  assigned_to: string | null;
  level: number;
  status: "pending" | "approved" | "rejected";
  decision_comment: string | null;
  decided_at: string | null;
  created_at: string;
}

export function useApprovals(projectId: string, filters?: { status?: string }) {
  return useQuery({
    queryKey: ["approvals", projectId, filters],
    queryFn: async (): Promise<Approval[]> => {
      let query = (supabase.from("approvals" as any) as any)
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (filters?.status) query = query.eq("status", filters.status);

      const { data, error } = await query;
      if (error) throw error;
      return (data as Approval[]) || [];
    },
    enabled: !!projectId,
  });
}

export function useMyApprovals(status?: string) {
  return useQuery({
    queryKey: ["my-approvals", status],
    queryFn: async (): Promise<Approval[]> => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) return [];

      let query = (supabase.from("approvals" as any) as any)
        .select("*")
        .eq("assigned_to", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (status) query = query.eq("status", status);

      const { data, error } = await query;
      if (error) throw error;
      return (data as Approval[]) || [];
    },
  });
}

export function useCreateApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      approval: Partial<Approval> & { project_id: string; title: string; type: Approval["type"] }
    ) => {
      const { data: session } = await supabase.auth.getSession();
      const { data, error } = await (supabase.from("approvals" as any) as any)
        .insert({
          ...approval,
          requested_by: session?.session?.user?.id || null,
          status: "pending",
          idempotency_key: crypto.randomUUID(),
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["approvals", vars.project_id] });
      qc.invalidateQueries({ queryKey: ["my-approvals"] });
    },
  });
}

export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      decision,
      comment,
    }: {
      id: string;
      decision: "approved" | "rejected";
      comment?: string;
    }) => {
      const { error } = await (supabase.from("approvals" as any) as any)
        .update({
          status: decision,
          decision_comment: comment || null,
          decided_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["my-approvals"] });
    },
  });
}
