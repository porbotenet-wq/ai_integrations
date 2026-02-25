import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  UserProfile, ObjectSummary, ObjectDetail, DashboardData,
  GPRData, Task, TaskComment, SupplyOrder, ConstructionStage,
  Document, Notification, NotificationSummary,
  ActivityLogEntry, ProfileTask, ProfileApproval, UserBrief,
} from "./types";

// ─── Profile ────────────────────────────────────────────
export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<UserProfile>("/api/profile"),
  });
}

export function useProfileTasks() {
  return useQuery({
    queryKey: ["profile-tasks"],
    queryFn: () => api.get<ProfileTask[]>("/api/profile/tasks"),
  });
}

export function useProfileApprovals() {
  return useQuery({
    queryKey: ["profile-approvals"],
    queryFn: () => api.get<ProfileApproval[]>("/api/profile/approvals"),
  });
}

export function useProfileActivity() {
  return useQuery({
    queryKey: ["profile-activity"],
    queryFn: () => api.get<ActivityLogEntry[]>("/api/profile/activity"),
  });
}

// ─── Dashboard ──────────────────────────────────────────
export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<DashboardData>("/api/dashboard"),
  });
}

// ─── Objects ────────────────────────────────────────────
export function useObjects() {
  return useQuery({
    queryKey: ["objects"],
    queryFn: () => api.get<ObjectSummary[]>("/api/objects"),
  });
}

export function useObject(id: number) {
  return useQuery({
    queryKey: ["object", id],
    queryFn: () => api.get<ObjectDetail>(`/api/objects/${id}`),
    enabled: !!id,
  });
}

// ─── GPR ────────────────────────────────────────────────
export function useGPR(objectId: number) {
  return useQuery({
    queryKey: ["gpr", objectId],
    queryFn: () => api.get<GPRData>(`/api/gpr/${objectId}`),
    enabled: !!objectId,
  });
}

export function useSignGPR() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ gprId, department }: { gprId: number; department: string }) =>
      api.post(`/api/gpr/${gprId}/sign`, { department }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["gpr"] }),
  });
}

// ─── Tasks ──────────────────────────────────────────────
export function useTasks(objectId: number, department?: string) {
  return useQuery({
    queryKey: ["tasks", objectId, department],
    queryFn: () => {
      const params = department ? `?department=${department}` : '';
      return api.get<Task[]>(`/api/objects/${objectId}/tasks${params}`);
    },
    enabled: !!objectId,
  });
}

// Alias used by TasksTab component
export const useObjectTasks = useTasks;

export function useTaskDetail(taskId: number) {
  return useQuery({
    queryKey: ["task", taskId],
    queryFn: () => api.get<Task & { comments: TaskComment[] }>(`/api/tasks/${taskId}`),
    enabled: !!taskId,
  });
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, status, comment }: { taskId: number; status: string; comment?: string }) =>
      api.patch(`/api/tasks/${taskId}/status`, { status, comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task"] });
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ objectId, ...body }: { objectId: number; title: string; department: string; deadline?: string }) =>
      api.post(`/api/objects/${objectId}/tasks`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, text }: { taskId: number; text: string }) =>
      api.post(`/api/tasks/${taskId}/comments`, { text }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["task", vars.taskId] }),
  });
}

// ─── Supply ─────────────────────────────────────────────
export function useSupply(objectId: number) {
  return useQuery({
    queryKey: ["supply", objectId],
    queryFn: () => api.get<SupplyOrder[]>(`/api/objects/${objectId}/supply`),
    enabled: !!objectId,
  });
}

// ─── Construction ───────────────────────────────────────
export function useConstruction(objectId: number) {
  return useQuery({
    queryKey: ["construction", objectId],
    queryFn: () => api.get<ConstructionStage[]>(`/api/objects/${objectId}/construction`),
    enabled: !!objectId,
  });
}

export function useToggleChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (checklistId: number) =>
      api.post(`/api/construction/checklist/${checklistId}/toggle`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["construction"] }),
  });
}

// ─── Documents ──────────────────────────────────────────
export function useDocuments(objectId: number) {
  return useQuery({
    queryKey: ["documents", objectId],
    queryFn: () => api.get<Document[]>(`/api/objects/${objectId}/documents`),
    enabled: !!objectId,
  });
}

// ─── Notifications ──────────────────────────────────────
export function useNotifications(params?: { unread_only?: boolean; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.unread_only) qs.set("unread_only", "true");
  if (params?.limit) qs.set("limit", String(params.limit));
  const q = qs.toString();
  return useQuery({
    queryKey: ["notifications", params],
    queryFn: () => api.get<Notification[]>(`/api/notifications${q ? `?${q}` : ""}`),
  });
}

export function useNotificationSummary() {
  return useQuery({
    queryKey: ["notification-summary"],
    queryFn: () => api.get<NotificationSummary>("/api/notifications/summary"),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post(`/api/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notification-summary"] });
    },
  });
}

// Aliases used by NotificationCenter
export const useMarkRead = useMarkNotificationRead;

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/notifications/read-all"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notification-summary"] });
    },
  });
}

export function useNotificationAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      api.post(`/api/notifications/${id}/action`, { action }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notification-summary"] });
    },
  });
}

// ─── Org Structure ──────────────────────────────────────
export function useOrgStructure() {
  return useQuery({
    queryKey: ["org-structure"],
    queryFn: () => api.get<UserBrief[]>("/api/org-structure"),
  });
}

// ─── Available Users (for team assignment) ──────────────
export function useAvailableUsers() {
  return useQuery({
    queryKey: ["available-users"],
    queryFn: () => api.get<UserBrief[]>("/api/org-structure"),
  });
}

// ─── GPR Templates ──────────────────────────────────────
export function useGPRTemplates() {
  return useQuery({
    queryKey: ["gpr-templates"],
    queryFn: async () => [] as any[],  // TODO: implement endpoint
  });
}

// ─── Notification Settings ──────────────────────────────
export function useUpdateNotificationSettings() {
  return useMutation({
    mutationFn: (settings: Record<string, any>) =>
      api.patch("/api/profile/notification-settings", settings),
  });
}
