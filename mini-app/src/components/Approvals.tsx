import { useState } from "react";
import { Loader2, CheckCircle, XCircle, Clock, MessageSquare } from "lucide-react";
import { useApprovals, useDecideApproval } from "@/hooks/useApprovals";
import { toast } from "sonner";

interface ApprovalsProps {
  projectId: string;
  userRole?: string;
}

const TYPE_CONFIG: Record<string, { icon: string; label: string }> = {
  daily_log: { icon: "📋", label: "Дневной отчёт" },
  material_request: { icon: "📦", label: "Заявка на материалы" },
  task_completion: { icon: "✔️", label: "Завершение задачи" },
  budget: { icon: "💰", label: "Бюджет" },
  other: { icon: "📌", label: "Прочее" },
};

const STATUS_CONFIG: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  pending: { icon: "⏳", label: "Ожидает", color: "text-warning", bg: "bg-warning/10" },
  approved: { icon: "✅", label: "Согласовано", color: "text-primary", bg: "bg-primary/10" },
  rejected: { icon: "❌", label: "Отклонено", color: "text-destructive", bg: "bg-destructive/10" },
};

const Approvals = ({ projectId, userRole }: ApprovalsProps) => {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const { data: approvals, isLoading } = useApprovals(projectId, statusFilter ? { status: statusFilter } : undefined);
  const decide = useDecideApproval();

  const canDecide = userRole === "pm" || userRole === "director" || userRole === "ceo";

  const handleDecide = async (id: string, decision: "approved" | "rejected") => {
    try {
      await decide.mutateAsync({ id, decision, comment: comment || undefined });
      toast.success(decision === "approved" ? "Согласовано" : "Отклонено");
      setCommentingId(null);
      setComment("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="animate-fade-in p-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-t3 my-3.5 flex items-center gap-2">
        Согласования <span className="flex-1 h-px bg-border" />
      </div>

      {/* Filters */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {[
          { id: "pending", label: "⏳ Ожидают" },
          { id: "approved", label: "✅ Согласованы" },
          { id: "rejected", label: "❌ Отклонены" },
          { id: "", label: "Все" },
        ].map(f => (
          <button key={f.id} onClick={() => setStatusFilter(f.id)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
              statusFilter === f.id ? "bg-primary text-primary-foreground" : "bg-bg1 text-t2 border border-border"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {(!approvals || approvals.length === 0) ? (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">✅</div>
          <div className="text-[12px] text-t2 font-semibold">
            {statusFilter === "pending" ? "Нет ожидающих согласований" : "Нет согласований"}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {approvals.map(a => {
            const typeCfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.other;
            const statusCfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.pending;

            return (
              <div key={a.id} className="bg-bg1 border border-border rounded-lg overflow-hidden">
                <div className="p-3">
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-sm">{typeCfg.icon}</span>
                        <span className="text-[11px] font-bold">{a.title}</span>
                      </div>
                      <div className="text-[9px] text-t3">
                        {typeCfg.label} · Уровень {a.level} · {new Date(a.created_at).toLocaleDateString("ru-RU")}
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusCfg.color} ${statusCfg.bg}`}>
                      {statusCfg.icon} {statusCfg.label}
                    </span>
                  </div>

                  {a.description && (
                    <div className="text-[10px] text-t2 mt-1.5 mb-2">{a.description}</div>
                  )}

                  {a.decision_comment && (
                    <div className={`text-[9px] rounded px-2 py-1 mb-2 ${statusCfg.bg} ${statusCfg.color}`}>
                      💬 {a.decision_comment}
                    </div>
                  )}

                  {/* Actions */}
                  {a.status === "pending" && canDecide && (
                    <div className="space-y-2 mt-2 pt-2 border-t border-border">
                      {commentingId === a.id ? (
                        <div className="space-y-1.5">
                          <textarea
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            placeholder="Комментарий (опционально)..."
                            className="w-full bg-bg2 border border-border rounded-lg px-2.5 py-1.5 text-[10px] outline-none focus:border-primary resize-none"
                            rows={2}
                          />
                          <div className="flex gap-1.5">
                            <button onClick={() => handleDecide(a.id, "approved")} disabled={decide.isPending}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-primary text-primary-foreground text-[10px] font-bold disabled:opacity-50">
                              <CheckCircle size={12} /> Согласовать
                            </button>
                            <button onClick={() => handleDecide(a.id, "rejected")} disabled={decide.isPending}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-destructive text-destructive-foreground text-[10px] font-bold disabled:opacity-50">
                              <XCircle size={12} /> Отклонить
                            </button>
                            <button onClick={() => { setCommentingId(null); setComment(""); }}
                              className="px-2 py-1.5 rounded-md bg-bg2 text-t2 text-[10px] font-bold border border-border">
                              ✕
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-1.5">
                          <button onClick={() => handleDecide(a.id, "approved")}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary/15 text-primary text-[10px] font-bold hover:bg-primary/25">
                            <CheckCircle size={11} /> Согласовать
                          </button>
                          <button onClick={() => handleDecide(a.id, "rejected")}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-destructive/15 text-destructive text-[10px] font-bold hover:bg-destructive/25">
                            <XCircle size={11} /> Отклонить
                          </button>
                          <button onClick={() => setCommentingId(a.id)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-bg2 text-t2 text-[10px] font-bold border border-border">
                            <MessageSquare size={11} /> С комментарием
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Approvals;
