import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import DocumentGenerator from "@/components/DocumentGenerator";
import {
  FileUp, FileText, Loader2, Sparkles, Trash2, Eye,
  Folder, FolderOpen, ChevronRight, Plus, ArrowLeft, Wand2,
} from "lucide-react";

interface FolderEntry {
  id: string;
  name: string;
  department: string;
  parent_id: string | null;
  sort_order: number;
  children?: FolderEntry[];
}

interface DocEntry {
  id: string;
  name: string;
  file_url: string;
  folder_id: string | null;
  analysis: string | null;
  loading: boolean;
}

interface Props {
  projectId: string;
  projectName?: string;
}

const Documents = ({ projectId, projectName }: Props) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"files" | "generator">("files");
  const fileRef = useRef<HTMLInputElement>(null);
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<FolderEntry[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  // Load folders for project
  const loadFolders = useCallback(async () => {
    setLoadingFolders(true);
    const { data } = await supabase
      .from("document_folders")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order");
    setFolders((data as FolderEntry[]) || []);
    setLoadingFolders(false);
  }, [projectId]);

  // Seed folders if none exist
  const seedFolders = useCallback(async () => {
    const { error } = await supabase.rpc("seed_project_folders", {
      p_project_id: projectId,
    });
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      await loadFolders();
    }
  }, [projectId, loadFolders, toast]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  // Auto-seed if no folders
  useEffect(() => {
    if (!loadingFolders && folders.length === 0) {
      seedFolders();
    }
  }, [loadingFolders, folders.length, seedFolders]);

  // Load docs for current folder
  useEffect(() => {
    if (!currentFolderId) {
      setDocs([]);
      return;
    }
    const fetchDocs = async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, name, file_url, folder_id, ai_summary")
        .eq("folder_id", currentFolderId)
        .order("created_at", { ascending: false });
      setDocs(
        (data || []).map((d) => ({
          ...d,
          analysis: d.ai_summary,
          loading: false,
        }))
      );
    };
    fetchDocs();
  }, [currentFolderId]);

  // Build breadcrumb
  useEffect(() => {
    if (!currentFolderId) {
      setBreadcrumb([]);
      return;
    }
    const trail: FolderEntry[] = [];
    let id: string | null = currentFolderId;
    while (id) {
      const f = folders.find((fo) => fo.id === id);
      if (f) {
        trail.unshift(f);
        id = f.parent_id;
      } else break;
    }
    setBreadcrumb(trail);
  }, [currentFolderId, folders]);

  const currentChildren = folders.filter((f) => f.parent_id === currentFolderId);

  const navigateTo = (folderId: string | null) => {
    setCurrentFolderId(folderId);
    setExpandedId(null);
    setCreatingFolder(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentFolderId) return;
    const allowed = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Ошибка", description: "Поддерживаются PDF, PNG, JPEG", variant: "destructive" });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: "Ошибка", description: "Максимум 20 МБ", variant: "destructive" });
      return;
    }
    setUploading(true);
    const storagePath = `${projectId}/${currentFolderId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from("project-documents")
        .upload(storagePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("project-documents")
        .getPublicUrl(storagePath);

      const { data: session } = await supabase.auth.getSession();

      const { data: inserted, error: insertError } = await supabase
        .from("documents")
        .insert({
          name: file.name,
          file_url: storagePath,
          file_type: file.type === "application/pdf" ? "pdf" : "image",
          file_size: file.size,
          project_id: projectId,
          folder_id: currentFolderId,
          uploaded_by: session?.session?.user?.id || null,
        })
        .select("id, name, file_url, folder_id, ai_summary")
        .single();

      if (insertError) throw insertError;

      setDocs((prev) => [
        { ...inserted!, analysis: inserted!.ai_summary, loading: false },
        ...prev,
      ]);
      toast({ title: "Загружено", description: file.name });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ошибка загрузки";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const analyzeDoc = async (doc: DocEntry) => {
    setDocs((prev) =>
      prev.map((d) => (d.id === doc.id ? { ...d, loading: true, analysis: null } : d))
    );
    try {
      const { data, error } = await supabase.functions.invoke("analyze-document", {
        body: { file_path: doc.file_url, prompt: customPrompt || undefined },
      });
      if (error) throw error;
      if (data?.success) {
        setDocs((prev) =>
          prev.map((d) =>
            d.id === doc.id ? { ...d, loading: false, analysis: data.analysis } : d
          )
        );
        // Save summary to DB
        await supabase.from("documents").update({ ai_summary: data.analysis }).eq("id", doc.id);
        setExpandedId(doc.id);
        toast({ title: "Анализ завершён", description: doc.name });
      } else {
        throw new Error(data?.error || "Ошибка анализа");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ошибка анализа";
      setDocs((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, loading: false } : d))
      );
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    }
  };

  const createSubfolder = async () => {
    if (!newFolderName.trim()) return;
    const parentDept = currentFolderId
      ? folders.find((f) => f.id === currentFolderId)?.department || "general"
      : "general";
    const { error } = await supabase.from("document_folders").insert({
      project_id: projectId,
      parent_id: currentFolderId,
      name: newFolderName.trim(),
      department: parentDept,
      sort_order: currentChildren.length + 1,
    });
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      setNewFolderName("");
      setCreatingFolder(false);
      await loadFolders();
    }
  };

  if (loadingFolders) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in p-2.5 space-y-3">
      {/* Header */}
      <div className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))] flex items-center gap-2">
        <FileText className="h-3 w-3" /> Документы
        <span className="flex-1 h-px bg-border" />
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-[hsl(var(--muted))] rounded-xl p-1">
        <button
          onClick={() => setActiveTab("files")}
          className={`flex-1 h-8 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "files"
              ? "bg-background text-foreground shadow-sm"
              : "text-[hsl(var(--muted-foreground))]"
          }`}
        >
          <Folder className="h-3 w-3" /> Файлы
        </button>
        <button
          onClick={() => setActiveTab("generator")}
          className={`flex-1 h-8 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "generator"
              ? "bg-background text-foreground shadow-sm"
              : "text-[hsl(var(--muted-foreground))]"
          }`}
        >
          <Wand2 className="h-3 w-3" /> Генератор
        </button>
      </div>

      {activeTab === "generator" ? (
        <DocumentGenerator projectId={projectId} projectName={projectName || "Объект"} />
      ) : (
      <>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-[11px] flex-wrap">
        <button
          onClick={() => navigateTo(null)}
          className="text-primary hover:underline font-semibold"
        >
          Корень
        </button>
        {breadcrumb.map((b) => (
          <span key={b.id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-t3" />
            <button
              onClick={() => navigateTo(b.id)}
              className="text-primary hover:underline font-semibold"
            >
              {b.name}
            </button>
          </span>
        ))}
      </div>

      {/* Back button when inside a folder */}
      {currentFolderId && (
        <Button
          size="sm"
          variant="ghost"
          className="text-[11px] h-7 gap-1 text-t2"
          onClick={() => {
            const parent = folders.find((f) => f.id === currentFolderId)?.parent_id || null;
            navigateTo(parent);
          }}
        >
          <ArrowLeft className="h-3 w-3" /> Назад
        </Button>
      )}

      {/* Subfolders */}
      {currentChildren.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {currentChildren.map((f) => {
            const hasChildren = folders.some((c) => c.parent_id === f.id);
            return (
              <button
                key={f.id}
                onClick={() => navigateTo(f.id)}
                className="bg-bg2 border border-border rounded-lg p-3 text-left hover:border-primary/30 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  {hasChildren ? (
                    <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                  ) : (
                    <Folder className="h-4 w-4 text-primary shrink-0" />
                  )}
                  <span className="text-[11px] font-semibold truncate group-hover:text-primary transition-colors">
                    {f.name}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Create subfolder */}
      {creatingFolder ? (
        <div className="flex gap-2 items-center">
          <input
            autoFocus
            className="flex-1 bg-bg2 border border-border rounded-md px-2 py-1 text-[11px] text-foreground outline-none focus:border-primary"
            placeholder="Имя папки..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createSubfolder()}
          />
          <Button size="sm" className="h-7 text-[10px]" onClick={createSubfolder}>
            Создать
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setCreatingFolder(false)}>
            Отмена
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="text-[10px] h-7 gap-1 text-t3"
          onClick={() => setCreatingFolder(true)}
        >
          <Plus className="h-3 w-3" /> Создать папку
        </Button>
      )}

      {/* Documents section — only inside a leaf/any folder */}
      {currentFolderId && (
        <>
          {/* Upload area */}
          <div
            className="bg-bg2 border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={handleUpload}
            />
            {uploading ? (
              <Loader2 className="h-5 w-5 mx-auto text-primary animate-spin" />
            ) : (
              <FileUp className="h-5 w-5 mx-auto text-t3" />
            )}
            <p className="text-[10px] text-t2 mt-1 font-semibold">
              {uploading ? "Загрузка..." : "Нажмите для загрузки PDF, PNG или JPEG"}
            </p>
          </div>

          {/* AI prompt */}
          <div className="bg-bg2 border border-border rounded-lg p-2">
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Промпт для AI-анализа (опционально)..."
              className="bg-bg1 border-border text-[11px] h-14 resize-none"
            />
          </div>

          {/* Doc list */}
          {docs.length === 0 && (
            <div className="text-center py-6">
              <FileText className="h-6 w-6 mx-auto text-t3 mb-1 opacity-40" />
              <p className="text-[10px] text-t3">Нет документов в этой папке</p>
            </div>
          )}

          {docs.map((doc) => (
            <div key={doc.id} className="bg-bg2 border border-border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 p-3">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold truncate">{doc.name}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => analyzeDoc(doc)}
                    disabled={doc.loading}
                  >
                    {doc.loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                    )}
                  </Button>
                  {doc.analysis && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                    >
                      <Eye className="h-3.5 w-3.5 text-info" />
                    </Button>
                  )}
                </div>
              </div>
              {expandedId === doc.id && doc.analysis && (
                <div className="border-t border-border p-3 bg-bg1">
                  <div className="text-[10px] font-bold text-primary uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Результат анализа
                  </div>
                  <div className="text-[11px] text-t1 leading-relaxed whitespace-pre-wrap font-mono max-h-[400px] overflow-y-auto">
                    {doc.analysis}
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}
      </>
      )}
    </div>
  );
};

export default Documents;
