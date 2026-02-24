// src/components/PMDashboard.tsx
// MONOLITH v3.0 — PM Dashboard with LED accents
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Inbox, AlertTriangle, CheckCircle, Activity, ClipboardList } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

interface Props { projectId: string; }

const PMDashboard = ({ projectId }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inboxCount, setInboxCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [overdueTasks, setOverdueTasks] = useState(0);
  const [activity, setActivity] = useState<any[]>([]);
  const [gprProgress, setGprProgress] = useState<{ label: string; plan: number; fact: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [inboxRes, apprRes, tasksRes, auditRes, pfRes] = await Promise.all([
          supabase.from("bot_inbox").select("id", { count: "exact", head: true })
            .eq("project_id", projectId).eq("status", "new"),
          supabase.from("approvals").select("id", { count: "exact", head: true })
            .eq("project_id", projectId).eq("status", "pending"),
          supabase.from("ecosystem_tasks").select("id", { count: "exact", head: true })
            .eq("project_id", projectId).eq("status", "Просрочен"),
          supabase.from("bot_audit_log").select("*")
            .order("created_at", { ascending: false }).limit(10),
          supabase.from("plan_fact").select("work_type_id, plan_value, fact_value")
            .eq("project_id", projectId),
        ]);

        setInboxCount(inboxRes.count || 0);
        setPendingApprovals(apprRes.count || 0);
        setOverdueTasks(tasksRes.count || 0);
        setActivity(auditRes.data || []);

        const byType = new Map<string, { plan: number; fact: number }>();
        for (const r of pfRes.data || []) {
          const key = r.work_type_id || "other";
          const cur = byType.get(key) || { plan: 0, fact: 0 };
          cur.plan += Number(r.plan_value || 0);
          cur.fact += Number(r.fact_value || 0);
          byType.set(key, cur);
        }
        setGprProgress(Array.from(byType.entries()).slice(0, 5).map(([k, v]) => ({
          label: k === "other" ? "Прочее" : k.slice(0, 8),
          ...v,
        })));
      } catch (e) {
        console.error("PMDashboard error:", e);
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
        <div className="text-[11px] text-t2">Загрузка…</div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="px-1 pt-2 pb-1 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-[hsl(var(--green-dim))] flex items-center justify-center">
          <ClipboardList size={16} className="text-primary" />
        </div>
        <div className="text-[16px] font-bold text-t1">Панель РП</div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-3 gap-2">
        <div className={`stagger-item bg-bg1 border border-border rounded-xl p-3 text-center led-top ${inboxCount > 0 ? "led-green" : ""}`}>
          <Inbox size={16} className="mx-auto text-primary mb-1" />
          <div className="num text-2xl font-bold text-t1">{inboxCount}</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-t3">Входящие</div>
        </div>
        <div className={`stagger-item bg-bg1 border border-border rounded-xl p-3 text-center led-top ${overdueTasks > 0 ? "led-red" : "led-green"}`}
          style={{ animationDelay: "50ms" }}>
          <AlertTriangle size={16} className="mx-auto text-destructive mb-1" />
          <div className="num text-2xl font-bold text-t1">{overdueTasks}</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-t3">Просрочено</div>
        </div>
        <div className="stagger-item bg-bg1 border border-border rounded-xl p-3 text-center led-top led-amber"
          style={{ animationDelay: "100ms" }}>
          <CheckCircle size={16} className="mx-auto text-amber-500 mb-1" />
          <div className="num text-2xl font-bold text-t1">{pendingApprovals}</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-t3">На согласов.</div>
        </div>
      </div>

      {/* GPR Progress */}
      {gprProgress.length > 0 && (
        <div className="bg-bg1 border border-border rounded-xl p-3">
          <p className="section-label">Прогресс ГПР</p>
          <div className="space-y-3 mt-2">
            {gprProgress.map((g) => {
              const pct = g.plan > 0 ? Math.round((g.fact / g.plan) * 100) : 0;
              return (
                <div key={g.label}>
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="text-t2">{g.label}</span>
                    <span className="num text-[11px] font-bold text-primary">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-bg3 overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all duration-700 relative"
                      style={{ width: `${Math.min(pct, 100)}%`, animation: 'progress-fill 0.8s cubic-bezier(0.4,0,0.2,1)' }}>
                      <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-white/15 to-transparent rounded-full" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity feed */}
      <div className="bg-bg1 border border-border rounded-xl p-3">
        <div className="section-label">
          <Activity size={12} />Лента активности
        </div>
        {activity.length === 0 ? (
          <div className="text-[10px] text-t3 py-4 text-center">Нет событий</div>
        ) : (
          <div className="space-y-2 mt-2">
            {activity.map((a, i) => (
              <div key={a.id} className="stagger-item flex items-start gap-2 text-[10px]" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-t1">{a.action}</span>
                  <div className="text-t3">{format(new Date(a.created_at), "dd.MM HH:mm")}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PMDashboard;
