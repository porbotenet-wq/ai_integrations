import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Approval {
  id: string;
  project_id: number;
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

export function useApprovals(projectId: string | number, filters?: { status?: string }) {
  return useQuery({
    queryKey: ["approvals", projectId, filters],
    queryFn: async (): Promise<Approval[]> => {
      // TODO: implement /api/approvals endpoint
      return [];
    },
    enabled: !!projectId,
  });
}

export function useMyApprovals(status?: string) {
  return useQuery({
    queryKey: ["my-approvals", status],
    queryFn: async (): Promise<Approval[]> => {
      // TODO: implement /api/approvals/my endpoint
      return [];
    },
  });
}

export function useCreateApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_approval: Partial<Approval>) => {
      throw new Error("Not implemented yet");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["my-approvals"] });
    },
  });
}

export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_params: { id: string; decision: "approved" | "rejected"; comment?: string }) => {
      throw new Error("Not implemented yet");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["my-approvals"] });
    },
  });
}
