import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Document, DocumentFolder } from "@/types/database";

export function useDocumentFolders(projectId: string) {
  return useQuery({
    queryKey: ["doc-folders", projectId],
    queryFn: async (): Promise<DocumentFolder[]> => {
      const { data, error } = await supabase
        .from("document_folders")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order");
      if (error) throw error;
      return (data as DocumentFolder[]) || [];
    },
    enabled: !!projectId,
  });
}

export function useDocuments(folderId: string | null) {
  return useQuery({
    queryKey: ["documents", folderId],
    queryFn: async (): Promise<Document[]> => {
      if (!folderId) return [];
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("folder_id", folderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Document[]) || [];
    },
    enabled: !!folderId,
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (folder: Partial<DocumentFolder>) => {
      const { error } = await supabase.from("document_folders").insert(folder as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doc-folders"] });
    },
  });
}
