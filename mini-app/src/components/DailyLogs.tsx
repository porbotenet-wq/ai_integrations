import { useState } from "react";
import { Loader2, Send, CheckCircle, XCircle, Clock } from "lucide-react";
import { useDailyLogs, useCreateDailyLog, useSubmitDailyLog, useReviewDailyLog } from "@/hooks/useDailyLogs";
import { useAuth } from "@/hooks/useAuth";
import PhotoUpload from "@/components/PhotoUpload";
import { toast } from "sonner";

interface DailyLogsProps {
  projectId: string;
  userRole?: string;
}

const STATUS_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  draft: { icon: "📝", label: "Черновик", color: "text-muted-foreground" },
  submitted: { icon: "📤", label: "Отправлен", color: "text-warning" },
  reviewed: { icon: "👀", label: "На проверке", color: "text-info" },
  approved: { icon: "✅", label: "Утверждён", color: "text-primary" },
  rejected: { icon: "❌", label: "Отклонён", color: "text-destructive" },
};

const DailyLogs = ({ projectId, userRole }: DailyLogsProps) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<"list" | "create">("list");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data: logs, isLoading } = useDailyLogs(projectId, statusFilter ? { status: statusFilter } : undefined);
  const createLog = useCreateDailyLog();
  const submitLog = useSubmitDailyLog();
  const reviewLog = useReviewDailyLog();

  // Form state
  const [form, setForm] = useState({
    zone_name: "",
    works_description: "",
    volume: "",
    workers_count: "",
    issues_description: "",
    weather: "",
    photo_urls: [] as string[],
  });

  const canReview = userRole === "pm" || userRole === "director" || userRole === "pto";

  const handleCreate = async () => {
    if (!form.works_description.trim()) {
      toast.error("Опишите выполненные работы");
      return;
    }
    try {
      const result = await createLog.mutateAsync({
        project_id: projectId,
        zone_name: form.zone_name || null,
        works_description: form.works_description,
        volume: form.volume || null,
        workers_count: form.workers_count ? parseInt(form.workers_count) : null,
        issues_description: form.issues_description || null,
        weather: form.weather || null,
        photo_urls: form.photo_urls,
        submitted_by: user?.id || null,
      });
      toast.success("Отчёт создан");
      setForm({ zone_name: "", works_description: "", volume: "", workers_count: "", issues_description: "", weather: "", photo_urls: [] });
      setTab("list");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка создания");
    }
  };

  const handleSubmit = async (logId: string) => {
    try {
      await submitLog.mutateAsync({ id: logId, projectId });
      toast.success("Отчёт отправлен на проверку");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };

  const handleReview = async (logId: string, decision: "approved" | "rejected", comment?: string) => {
    try {
      await reviewLog.mutateAsync({ id: logId, projectId, decision, comment });
      toast.success(decision === "approved" ? "Отчёт утверждён" : "Отчёт отклонён");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="animate-fade-in p-2.5">
      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        <button onClick={() => setTab("list")} className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${tab === "list" ? "bg-primary text-primary-foreground" : "bg-bg1 text-t2 border border-border"}`}>
          📋 Отчёты
        </button>
        <button onClick={() => setTab("create")} className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all ${tab === "create" ? "bg-primary text-primary-foreground" : "bg-bg1 text-t2 border border-border"}`}>
          ➕ Новый отчёт
        </button>
      </div>

      {tab === "create" && (
        <div className="space-y-2.5 animate-fade-in">
          <div className="text-[10px] font-bold uppercase tracking-wider text-t3 flex items-center gap-2">
            Новый дневной отчёт <span className="flex-1 h-px bg-border" />
          </div>

          <input placeholder="Зона / участок" value={form.zone_name} onChange={e => setForm(f => ({ ...f, zone_name: e.target.value }))}
            className="w-full bg-bg1 border border-border rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary" />

          <textarea placeholder="Выполненные работы *" value={form.works_description} onChange={e => setForm(f => ({ ...f, works_description: e.target.value }))}
            className="w-full bg-bg1 border border-border rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary resize-none" rows={3} />

          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Объём (напр: 45 м²)" value={form.volume} onChange={e => setForm(f => ({ ...f, volume: e.target.value }))}
              className="bg-bg1 border border-border rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary" />
            <input placeholder="Рабочих (число)" value={form.workers_count} onChange={e => setForm(f => ({ ...f, workers_count: e.target.value }))} type="number"
              className="bg-bg1 border border-border rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary" />
          </div>

          <textarea placeholder="Проблемы / замечания" value={form.issues_description} onChange={e => setForm(f => ({ ...f, issues_description: e.target.value }))}
            className="w-full bg-bg1 border border-border rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary resize-none" rows={2} />

          <input placeholder="Погода" value={form.weather} onChange={e => setForm(f => ({ ...f, weather: e.target.value }))}
            className="w-full bg-bg1 border border-border rounded-lg px-3 py-2 text-[11px] outline-none focus:border-primary" />

          <PhotoUpload photos={form.photo_urls} onPhotosChange={urls => setForm(f => ({ ...f, photo_urls: urls }))} folder={`daily-logs/new`} maxPhotos={10} />

          <button onClick={handleCreate} disabled={createLog.isPending}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold disabled:opacity-50">
            {createLog.isPending ? "Сохранение..." : "💾 Сохранить отчёт"}
          </button>
        </div>
      )}

      {tab === "list" && (
        <>
          {/* Filters */}
          <div className="flex gap-1 mb-2.5 flex-wrap">
            {[{ id: "", label: "Все" }, { id: "draft", label: "📝 Черновики" }, { id: "submitted", label: "📤 Отправлены" }, { id: "approved", label: "✅ Утверждены" }].map(f => (
              <button key={f.id} onClick={() => setStatusFilter(f.id)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${statusFilter === f.id ? "bg-primary text-primary-foreground" : "bg-bg1 text-t2 border border-border"}`}>
                {f.label}
              </button>
            ))}
          </div>

          {(!logs || logs.length === 0) ? (
            <div className="text-center py-8">
              <div className="text-2xl mb-2">📋</div>
              <div className="text-[12px] text-t2 font-semibold">Нет отчётов</div>
              <button onClick={() => setTab("create")} className="text-primary text-[11px] font-semibold mt-2">+ Создать первый</button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {logs.map(log => {
                const cfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.draft;
                return (
                  <div key={log.id} className="bg-bg1 border border-border rounded-lg p-3">
                    <div className="flex items-start justify-between mb-1.5">
                      <div>
                        <div className="text-[11px] font-bold">{log.zone_name || "Без зоны"}</div>
                        <div className="text-[9px] text-t3 font-mono">{new Date(log.date).toLocaleDateString("ru-RU")} {log.weather && `· ${log.weather}`}</div>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${cfg.color} bg-current/10`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>

                    <div className="text-[10px] text-t1 mb-1">{log.works_description}</div>

                    <div className="flex gap-3 text-[9px] text-t3 mb-2">
                      {log.volume && <span>📏 {log.volume}</span>}
                      {log.workers_count && <span>👷 {log.workers_count} чел.</span>}
                      {log.issues_description && <span>⚠️ Есть замечания</span>}
                    </div>

                    {log.review_comment && (
                      <div className="text-[9px] text-warning bg-warning/10 rounded px-2 py-1 mb-2">
                        💬 {log.review_comment}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-1.5">
                      {log.status === "draft" && (
                        <button onClick={() => handleSubmit(log.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/15 text-primary text-[9px] font-bold hover:bg-primary/25">
                          <Send size={10} /> Отправить
                        </button>
                      )}
                      {log.status === "submitted" && canReview && (
                        <>
                          <button onClick={() => handleReview(log.id, "approved")}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/15 text-primary text-[9px] font-bold">
                            <CheckCircle size={10} /> Утвердить
                          </button>
                          <button onClick={() => handleReview(log.id, "rejected", "Требуется доработка")}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-destructive/15 text-destructive text-[9px] font-bold">
                            <XCircle size={10} /> Отклонить
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DailyLogs;
