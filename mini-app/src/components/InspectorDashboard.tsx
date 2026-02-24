// src/components/InspectorDashboard.tsx
// MONOLITH v3.0 — Inspector Dashboard with LED accents
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, ClipboardCheck, Plus, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

interface Props { projectId: string; }

const InspectorDashboard = ({ projectId }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [openAlerts, setOpenAlerts] = useState<any[]>([]);
  const [stageMatrix, setStageMatrix] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [alertsRes, stagesRes] = await Promise.all([
          supabase.from("alerts")
            .select("id, title, priority, created_at")
            .eq("project_id", projectId)
            .eq("is_resolved", false)
            .order("created_at", { ascending: false })
            .limit(10),
          supabase.from("stage_acceptance")
            .select("*")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

        setOpenAlerts(alertsRes.data || []);
        setStageMatrix(stagesRes.data || []);
      } catch (e) {
        console.error("InspectorDashboard error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  const statusConfig: Record<string, { css: string; label: string; led: string }> = {
    not_started: { css: "bg-bg3 text-t3", label: "Ожидание", led: "" },
    ready: { css: "bg-[hsl(var(--amber-dim))] text-amber-500", label: "Готов", led: "led-amber" },
    inspection: { css: "bg-[hsl(var(--green-dim))] text-primary", label: "Проверка", led: "led-green" },
    accepted: { css: "bg-emerald-500/15 text-emerald-500", label: "Принят", led: "led-green" },
    rejected: { css: "bg-[hsl(var(--red-dim))] text-destructive", label: "Отклонён", led: "led-red" },
  };

  return (
    <div className="p-3 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="px-1 pt-2 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[hsl(var(--green-dim))] flex items-center justify-center">
            <Search size={16} className="text-primary" />
          </div>
          <div className="text-[16px] font-bold text-t1">Технадзор</div>
        </div>
        <button className="flex items-center gap-1 bg-destructive text-destructive-foreground rounded-lg px-3 py-1.5 text-[11px] font-bold hover:opacity-90 transition-opacity active:scale-[0.97]">
          <Plus size={14} />
          Замечание
        </button>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 gap-2">
        <div className={`stagger-item bg-bg1 border border-border rounded-xl p-3 text-center led-top ${openAlerts.length > 0 ? "led-red" : "led-green"}`}>
          <AlertTriangle size={16} className="mx-auto text-destructive mb-1" />
          <div className="num text-2xl font-bold text-t1">{openAlerts.length}</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-t3">Открытых замечаний</div>
        </div>
        <div className="stagger-item bg-bg1 border border-border rounded-xl p-3 text-center led-top led-green" style={{ animationDelay: "50ms" }}>
          <ClipboardCheck size={16} className="mx-auto text-primary mb-1" />
          <div className="num text-2xl font-bold text-t1">{stageMatrix.filter(s => s.status === "accepted").length}</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-t3">Принято этапов</div>
        </div>
      </div>

      {/* Open alerts */}
      {openAlerts.length > 0 && (
        <div className="bg-bg1 border border-border rounded-xl p-3 led-top led-red">
          <p className="section-label">Открытые замечания</p>
          <div className="space-y-2 mt-2">
            {openAlerts.map((a, i) => (
              <div key={a.id} className="stagger-item flex items-start gap-2 text-[10px]" style={{ animationDelay: `${i * 50}ms` }}>
                <div className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${a.priority === "critical" ? "bg-destructive" : "bg-amber-500"}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-t1">{a.title}</span>
                  <div className="text-t3">{format(new Date(a.created_at), "dd.MM HH:mm")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stage acceptance matrix */}
      {stageMatrix.length > 0 && (
        <div className="bg-bg1 border border-border rounded-xl p-3">
          <p className="section-label">Приёмка этапов</p>
          <div className="space-y-1.5 mt-2">
            {stageMatrix.map((s, i) => {
              const cfg = statusConfig[s.status] || statusConfig.not_started;
              return (
                <div key={s.id} className="stagger-item flex items-center justify-between text-[10px]" style={{ animationDelay: `${i * 50}ms` }}>
                  <span className="text-t1">{s.stage}</span>
                  <span className={`text-[8px] font-semibold px-2 py-0.5 rounded-full ${cfg.css}`}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {openAlerts.length === 0 && stageMatrix.length === 0 && (
        <div className="text-center py-12 text-t2 text-[11px]">Нет данных</div>
      )}
    </div>
  );
};

export default InspectorDashboard;
