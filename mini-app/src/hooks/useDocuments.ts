import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface DocumentFolder {
  id: string;
  project_id: number;
  name: string;
  sort_order: number;
}

export interface Document {
  id: string;
  folder_id: string;
  name: string;
  file_url: string;
  file_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
}

export function useDocumentFolders(projectId: string | number) {
  return useQuery({
    queryKey: ["doc-folders", projectId],
    queryFn: async (): Promise<DocumentFolder[]> => {
      // TODO: implement /api/documents/folders endpoint
      return [];
    },
    enabled: !!projectId,
  });
}

export function useDocuments(folderId: string | null) {
  return useQuery({
    queryKey: ["documents", folderId],
    queryFn: async (): Promise<Document[]> => {
      // TODO: implement /api/documents endpoint
      return [];
    },
    enabled: !!folderId,
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_folder: Partial<DocumentFolder>) => {
      throw new Error("Not implemented yet");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doc-folders"] });
    },
  });
}
