// src/components/DirectorDashboard.tsx
// MONOLITH v3.0 — Director Portfolio Dashboard
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, AlertTriangle, Users, Building2, ChevronRight, DollarSign } from "lucide-react";
import { format } from "date-fns";

interface DirectorDashboardProps {
  projectId?: string;
  onOpenProject?: (id: string) => void;
}

interface ProjectSummary {
  id: string;
  name: string;
  city: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  alertsCount: number;
  crewsCount: number;
  progress: number;
}

const DirectorDashboard = ({ onOpenProject, projectId }: DirectorDashboardProps) => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [criticalAlerts, setCriticalAlerts] = useState<any[]>([]);
  const [financePlanFact, setFinancePlanFact] = useState({ plan: 0, fact: 0 });
  const [foremanStatus, setForemanStatus] = useState<{ name: string; submitted: boolean }[]>([]);
  const [deptKpis, setDeptKpis] = useState({ designAlerts: 0, supplyDeficit: 0, montageProgress: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { data: projectsData } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
        if (!projectsData) { setLoading(false); return; }

        const today = new Date().toISOString().split("T")[0];

        const [critRes, financeRes, foremenRes] = await Promise.all([
          supabase.from("alerts").select("id, title, priority, project_id, created_at")
            .eq("is_resolved", false).eq("priority", "critical").order("created_at", { ascending: false }).limit(3),
          supabase.from("plan_fact").select("plan_value, fact_value"),
          supabase.from("user_roles").select("user_id, role, profiles(display_name, telegram_chat_id)")
            .in("role", ["foreman1", "foreman2", "foreman3"]),
        ]);

        setCriticalAlerts(critRes.data || []);

        const fp = (financeRes.data || []).reduce((acc, r) => ({
          plan: acc.plan + Number(r.plan_value || 0),
          fact: acc.fact + Number(r.fact_value || 0),
        }), { plan: 0, fact: 0 });
        setFinancePlanFact(fp);

        const foremenData = foremenRes.data || [];
        const foremanStatuses = await Promise.all(
          foremenData.slice(0, 10).map(async (f: any) => {
            const { count } = await supabase.from("daily_logs")
              .select("id", { count: "exact", head: true })
              .eq("submitted_by", f.user_id).eq("date", today);
            return {
              name: f.profiles?.display_name || "Прораб",
              submitted: (count || 0) > 0,
            };
          })
        );
        setForemanStatus(foremanStatuses);

        const [designRes, supplyRes] = await Promise.all([
          supabase.from("alerts").select("id", { count: "exact", head: true }).eq("is_resolved", false),
          supabase.from("materials").select("id", { count: "exact", head: true }).gt("deficit", 0),
        ]);
        setDeptKpis({
          designAlerts: designRes.count || 0,
          supplyDeficit: supplyRes.count || 0,
          montageProgress: fp.plan > 0 ? Math.round((fp.fact / fp.plan) * 100) : 0,
        });

        const summaries: ProjectSummary[] = await Promise.all(
          projectsData.map(async (p) => {
            try {
              const [alertsRes, crewsRes, pfRes] = await Promise.all([
                supabase.from("alerts").select("id", { count: "exact", head: true }).eq("project_id", p.id).eq("is_resolved", false),
                supabase.from("crews").select("id", { count: "exact", head: true }).eq("project_id", p.id).eq("is_active", true),
                supabase.from("plan_fact").select("plan_value, fact_value").eq("project_id", p.id),
              ]);
              const totalPlan = (pfRes.data || []).reduce((s, r) => s + Number(r.plan_value || 0), 0);
              const totalFact = (pfRes.data || []).reduce((s, r) => s + Number(r.fact_value || 0), 0);
              return {
                id: p.id, name: p.name, city: p.city, status: p.status,
                startDate: p.start_date, endDate: p.end_date,
                alertsCount: alertsRes.count || 0, crewsCount: crewsRes.count || 0,
                progress: totalPlan > 0 ? Math.round((totalFact / totalPlan) * 100) : 0,
              };
            } catch {
              return { id: p.id, name: p.name, city: p.city, status: p.status,
                startDate: p.start_date, endDate: p.end_date,
                alertsCount: 0, crewsCount: 0, progress: 0 };
            }
          })
        );
        setProjects(summaries);
      } catch (e) {
        console.error("DirectorDashboard load error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
        <div className="text-[11px] text-t2">Загрузка портфеля…</div>
      </div>
    );
  }

  const totalAlerts = projects.reduce((s, p) => s + p.alertsCount, 0);
  const totalCrews = projects.reduce((s, p) => s + p.crewsCount, 0);
  const avgProgress = projects.length > 0 ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length) : 0;

  const statusLedMap: Record<string, string> = {
    active: "led-green",
    draft: "led-blue",
    completed: "led-green",
    paused: "led-amber",
  };
  const statusColors: Record<string, string> = {
    active: "bg-[hsl(var(--green-dim))] text-primary",
    draft: "bg-bg3 text-t3",
    completed: "bg-emerald-500/15 text-emerald-500",
    paused: "bg-[hsl(var(--amber-dim))] text-amber-500",
  };
  const statusLabels: Record<string, string> = {
    active: "Активный", draft: "Черновик", completed: "Завершён", paused: "Пауза",
  };

  const deviation = financePlanFact.plan > 0
    ? Math.round(((financePlanFact.fact - financePlanFact.plan) / financePlanFact.plan) * 100)
    : 0;

  return (
    <div className="p-3 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="px-1 pt-2 pb-1 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-[hsl(var(--green-dim))] flex items-center justify-center">
          <Building2 size={16} className="text-primary" />
        </div>
        <div>
          <div className="text-[16px] font-bold text-t1">Портфель проектов</div>
          <div className="text-[10px] text-t3">{projects.length} проектов</div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="stagger-item bg-bg1 border border-border rounded-xl p-3 text-center led-top led-green">
          <TrendingUp size={16} className="mx-auto text-primary mb-1" />
          <div className="num text-2xl font-bold text-t1">{avgProgress}%</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-t3">Ср. прогресс</div>
        </div>
        <div className={`stagger-item bg-bg1 border border-border rounded-xl p-3 text-center led-top ${totalAlerts > 0 ? "led-red" : "led-green"}`}
          style={{ animationDelay: "50ms" }}>
          <AlertTriangle size={16} className="mx-auto text-destructive mb-1" />
          <div className="num text-2xl font-bold text-t1">{totalAlerts}</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-t3">Алертов</div>
        </div>
        <div className="stagger-item bg-bg1 border border-border rounded-xl p-3 text-center led-top led-green" style={{ animationDelay: "100ms" }}>
          <Users size={16} className="mx-auto text-primary mb-1" />
          <div className="num text-2xl font-bold text-t1">{totalCrews}</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-t3">Бригад</div>
        </div>
      </div>

      {/* Department KPIs */}
      <div className="bg-bg1 border border-border rounded-xl p-3">
        <p className="section-label">KPI по отделам</p>
        <div className="grid grid-cols-3 gap-2 mt-2">
          <div className="text-center">
            <div className="num text-[16px] font-bold text-destructive">{deptKpis.designAlerts}</div>
            <div className="text-[9px] uppercase tracking-[0.15em] text-t3">Замечаний</div>
          </div>
          <div className="text-center">
            <div className="num text-[16px] font-bold text-amber-500">{deptKpis.supplyDeficit}</div>
            <div className="text-[9px] uppercase tracking-[0.15em] text-t3">Дефицит поз.</div>
          </div>
          <div className="text-center">
            <div className="num text-[16px] font-bold text-primary">{deptKpis.montageProgress}%</div>
            <div className="text-[9px] uppercase tracking-[0.15em] text-t3">Монтаж</div>
          </div>
        </div>
      </div>

      {/* Finance plan/fact */}
      {financePlanFact.plan > 0 && (
        <div className="bg-bg1 border border-border rounded-xl p-3">
          <div className="section-label">
            <DollarSign size={12} />Бюджет план/факт
          </div>
          <div className="flex items-end justify-between mt-2">
            <div>
              <div className="text-[10px] text-t3">План</div>
              <div className="num text-[14px] font-bold text-t1">{financePlanFact.plan.toLocaleString("ru")}</div>
            </div>
            <div>
              <div className="text-[10px] text-t3">Факт</div>
              <div className="num text-[14px] font-bold text-t1">{financePlanFact.fact.toLocaleString("ru")}</div>
            </div>
            <div className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${deviation > 0 ? "bg-[hsl(var(--red-dim))] text-destructive" : "bg-emerald-500/15 text-emerald-500"}`}>
              {deviation > 0 ? "+" : ""}{deviation}%
            </div>
          </div>
          {/* Shimmer progress bar */}
          <div className="h-1.5 rounded-full bg-bg3 overflow-hidden mt-3">
            <div className="h-full rounded-full bg-primary transition-all duration-700 relative"
              style={{ width: `${Math.min(deptKpis.montageProgress, 100)}%`, animation: 'progress-fill 0.8s cubic-bezier(0.4,0,0.2,1)' }}>
              <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-white/15 to-transparent rounded-full" />
            </div>
          </div>
        </div>
      )}

      {/* Critical alerts */}
      {criticalAlerts.length > 0 && (
        <div className="bg-bg1 border border-destructive/30 rounded-xl p-3 led-top led-red shadow-[0_0_8px_hsl(var(--red-glow))]">
          <p className="section-label text-destructive">Критические отклонения</p>
          <div className="space-y-2 mt-2">
            {criticalAlerts.map((a, i) => (
              <div key={a.id} className="stagger-item flex items-start gap-2 text-[10px]" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-t1">{a.title}</span>
                  <div className="text-t3">{format(new Date(a.created_at), "dd.MM HH:mm")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Foreman report status */}
      {foremanStatus.length > 0 && (
        <div className="bg-bg1 border border-border rounded-xl p-3">
          <p className="section-label">Сводка по прорабам</p>
          <div className="space-y-1.5 mt-2">
            {foremanStatus.map((f, i) => (
              <div key={i} className="stagger-item flex items-center justify-between text-[10px]" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${f.submitted ? "bg-primary" : "bg-destructive"}`} />
                  <span className="text-t1">{f.name}</span>
                </div>
                <span className={`text-[9px] font-semibold ${f.submitted ? "text-primary" : "text-destructive"}`}>
                  {f.submitted ? "Подан" : "Нет отчёта"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project list */}
      <div>
        <p className="section-label">Проекты</p>
        <div className="space-y-2 mt-2">
          {projects.map((p, i) => (
            <button
              key={p.id}
              onClick={() => onOpenProject?.(p.id)}
              className={`stagger-item w-full bg-bg1 border border-border rounded-xl p-3 text-left hover:border-[rgba(255,255,255,0.1)] transition-all duration-150 active:scale-[0.97] led-top ${statusLedMap[p.status] || ""}`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 size={12} className="text-primary flex-shrink-0" />
                    <span className="text-[12px] font-bold text-t1 truncate">{p.name}</span>
                  </div>
                  {p.city && <div className="text-[9px] text-t3 ml-5">{p.city}</div>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[8px] font-semibold px-2 py-0.5 rounded-full ${statusColors[p.status] || statusColors.draft}`}>
                    {statusLabels[p.status] || p.status}
                  </span>
                  <ChevronRight size={14} className="text-t3" />
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 ml-5">
                <div className="flex-1">
                  <div className="h-1.5 rounded-full bg-bg3 overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all duration-700 relative"
                      style={{ width: `${Math.min(p.progress, 100)}%` }}>
                      <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-white/15 to-transparent rounded-full" />
                    </div>
                  </div>
                </div>
                <span className="num text-[10px] font-bold text-primary w-10 text-right">{p.progress}%</span>
                {p.alertsCount > 0 && (
                  <span className="text-[9px] text-destructive font-semibold">⚠ {p.alertsCount}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {projects.length === 0 && (
        <div className="text-center py-12 text-t2 text-[11px]">Нет проектов</div>
      )}
    </div>
  );
};

export default DirectorDashboard;
