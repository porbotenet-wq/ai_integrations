import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { FileDown, Loader2, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";

import type { Project, PlanFactRecord, Material, Alert, Crew, Facade } from "@/types/database";

interface ReportPDFProps {
  projectId: string;
  projectName: string;
}

interface ProjectData {
  project: Project;
  planFact: PlanFactRecord[];
  materials: Material[];
  alerts: Alert[];
  crews: Crew[];
  facades: Facade[];
}

const CHART_COLORS = {
  plan: "#4B9EFF",
  fact: "#00D4A8",
};

const PIE_COLORS = ["#00D4A8", "#4B9EFF", "#FFA502", "#FF4757", "#A29BFE"];

const ReportPDF = ({ projectId, projectName }: ReportPDFProps) => {
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projRes, pfRes, matRes, alertsRes, crewsRes, facRes] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).single(),
        supabase.from("plan_fact").select("*").eq("project_id", projectId).order("date"),
        supabase.from("materials").select("*").eq("project_id", projectId),
        supabase.from("alerts").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
        supabase.from("crews").select("*").eq("project_id", projectId),
        supabase.from("facades").select("*").eq("project_id", projectId),
      ]);
      setData({
        project: projRes.data as unknown as Project,
        planFact: (pfRes.data || []) as unknown as PlanFactRecord[],
        materials: (matRes.data || []) as unknown as Material[],
        alerts: (alertsRes.data || []) as unknown as Alert[],
        crews: (crewsRes.data || []) as unknown as Crew[],
        facades: (facRes.data || []) as unknown as Facade[],
      });
    } catch (e) {
      console.error("Report fetch error:", e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [projectId]);

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => { window.print(); setPrinting(false); }, 300);
  };

  const calcStats = () => {
    if (!data) return null;

    const weekMap = new Map<number, { plan: number; fact: number }>();
    data.planFact.forEach((r) => {
      const cur = weekMap.get(r.week_number) || { plan: 0, fact: 0 };
      cur.plan += Number(r.plan_value || 0);
      cur.fact += Number(r.fact_value || 0);
      weekMap.set(r.week_number, cur);
    });
    const weeklyData = Array.from(weekMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([w, d]) => ({
        week: `Н${w}`,
        plan: Math.round(d.plan),
        fact: Math.round(d.fact),
        eff: d.plan > 0 ? Math.round((d.fact / d.plan) * 100) : 0,
      }));

    const totalPlan = data.planFact.reduce((s, r) => s + Number(r.plan_value || 0), 0);
    const totalFact = data.planFact.reduce((s, r) => s + Number(r.fact_value || 0), 0);
    const progress = totalPlan > 0 ? Math.round((totalFact / totalPlan) * 100) : 0;

    const lastWeeks = weeklyData.slice(-2);
    const trend = lastWeeks.length === 2 ? lastWeeks[1].eff - lastWeeks[0].eff : 0;

    const openAlerts = data.alerts.filter((a) => !a.is_resolved);
    const criticalAlerts = openAlerts.filter((a) => a.priority === "critical");
    const alertsByPriority = [
      { name: "Критичные", value: openAlerts.filter((a) => a.priority === "critical").length },
      { name: "Высокие", value: openAlerts.filter((a) => a.priority === "high").length },
      { name: "Средние", value: openAlerts.filter((a) => a.priority === "medium").length },
      { name: "Низкие", value: openAlerts.filter((a) => a.priority === "low").length },
    ].filter((x) => x.value > 0);

    const matOk = data.materials.filter((m) => m.status === "ok").length;
    const matDeficit = data.materials.filter((m) => m.deficit > 0).length;
    const matTotal = data.materials.length;
    const totalWorkers = data.crews.filter((c) => c.is_active).reduce((s, c) => s + (c.headcount || 0), 0);
    const endDate = data.project?.end_date ? new Date(data.project.end_date) : null;
    const daysLeft = endDate ? Math.ceil((endDate.getTime() - Date.now()) / 86400000) : null;

    return { weeklyData, totalPlan, totalFact, progress, trend, openAlerts, criticalAlerts, alertsByPriority, matOk, matDeficit, matTotal, totalWorkers, daysLeft };
  };

  const stats = calcStats();
  const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
        <div className="text-[11px] text-muted-foreground">Собираем данные для отчёта…</div>
      </div>
    );
  }

  const TrendIcon = stats?.trend && stats.trend > 5 ? TrendingUp : stats?.trend && stats.trend < -5 ? TrendingDown : Minus;
  const trendColor = stats?.trend && stats.trend > 5 ? "text-primary" : stats?.trend && stats.trend < -5 ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="sticky top-[52px] z-50 bg-background/90 backdrop-blur border-b border-border px-3.5 py-2.5 flex items-center justify-between print:hidden">
        <div>
          <div className="text-[13px] font-bold text-foreground">📊 Аналитика и отчёт</div>
          <div className="text-[9px] text-muted-foreground font-mono">{today}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center hover:border-primary/40 transition-colors">
            <RefreshCw size={12} className="text-muted-foreground" />
          </button>
          <button onClick={handlePrint} disabled={printing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:brightness-110 transition-all disabled:opacity-50">
            {printing ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
            Экспорт PDF
          </button>
        </div>
      </div>

      <div ref={reportRef} className="p-3 space-y-3 print:p-6 print:space-y-4">
        {/* Print header */}
        <div className="hidden print:block mb-6">
          <div className="text-2xl font-bold">{projectName}</div>
          <div className="text-sm text-muted-foreground">Отчёт сформирован: {today}</div>
          <hr className="mt-3" />
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted border border-border rounded-xl p-3">
            <div className="text-[9px] text-muted-foreground uppercase mb-1">Прогресс</div>
            <div className="text-[28px] font-bold text-primary leading-none">{stats?.progress}%</div>
            <div className="mt-2 h-1.5 rounded-full bg-accent overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400 transition-all" style={{ width: `${Math.min(stats?.progress || 0, 100)}%` }} />
            </div>
            <div className="text-[8px] text-muted-foreground mt-1 font-mono">{stats?.totalFact.toLocaleString()} / {stats?.totalPlan.toLocaleString()} ед.</div>
          </div>

          <div className={`bg-muted border rounded-xl p-3 ${stats?.daysLeft != null && stats.daysLeft < 0 ? "border-destructive/40" : stats?.daysLeft != null && stats.daysLeft < 30 ? "border-yellow-500/40" : "border-border"}`}>
            <div className="text-[9px] text-muted-foreground uppercase mb-1">До сдачи</div>
            {stats?.daysLeft != null ? (
              <>
                <div className={`text-[28px] font-bold leading-none ${stats.daysLeft < 0 ? "text-destructive" : stats.daysLeft < 30 ? "text-yellow-500" : "text-foreground"}`}>{Math.abs(stats.daysLeft)}</div>
                <div className="text-[9px] text-muted-foreground mt-1">{stats.daysLeft < 0 ? "дн. просрочки" : "дн. осталось"}</div>
              </>
            ) : (
              <div className="text-[20px] font-bold text-muted-foreground">—</div>
            )}
          </div>

          <div className={`bg-muted border rounded-xl p-3 ${stats?.criticalAlerts?.length ? "border-destructive/40" : "border-border"}`}>
            <div className="text-[9px] text-muted-foreground uppercase mb-1">Алерты</div>
            <div className={`text-[28px] font-bold leading-none ${stats?.openAlerts?.length ? "text-yellow-500" : "text-primary"}`}>{stats?.openAlerts?.length}</div>
            <div className="text-[9px] text-muted-foreground mt-1">открытых {stats?.criticalAlerts?.length ? `· ${stats.criticalAlerts.length} крит.` : ""}</div>
          </div>

          <div className="bg-muted border border-border rounded-xl p-3">
            <div className="text-[9px] text-muted-foreground uppercase mb-1">Бригада</div>
            <div className="text-[28px] font-bold leading-none text-foreground">{stats?.totalWorkers}</div>
            <div className="flex items-center gap-1 mt-1">
              <TrendIcon size={10} className={trendColor} />
              <div className={`text-[9px] ${trendColor}`}>{stats?.trend && stats.trend > 0 ? `+${stats.trend}%` : `${stats?.trend}%`} тренд</div>
            </div>
          </div>
        </div>

        {/* Plan-Fact chart */}
        {stats?.weeklyData && stats.weeklyData.length > 0 && (
          <div className="bg-muted border border-border rounded-xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-3">📈 Динамика план-факт</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={stats.weeklyData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="week" tick={{ fontSize: 9, fill: "#7A7A9D" }} />
                <YAxis tick={{ fontSize: 9, fill: "#7A7A9D" }} width={35} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 10 }} labelStyle={{ color: "hsl(var(--popover-foreground))" }} />
                <Bar dataKey="plan" name="План" fill={CHART_COLORS.plan} radius={[3, 3, 0, 0]} opacity={0.7} />
                <Bar dataKey="fact" name="Факт" fill={CHART_COLORS.fact} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Efficiency chart */}
        {stats?.weeklyData && stats.weeklyData.length > 1 && (
          <div className="bg-muted border border-border rounded-xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-3">📉 Эффективность (%)</div>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={stats.weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="week" tick={{ fontSize: 9, fill: "#7A7A9D" }} />
                <YAxis tick={{ fontSize: 9, fill: "#7A7A9D" }} width={35} domain={[0, 120]} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 10 }} />
                <Line dataKey="eff" name="%" stroke={CHART_COLORS.fact} strokeWidth={2} dot={{ r: 3, fill: CHART_COLORS.fact }} />
                <Line dataKey={() => 100} stroke={CHART_COLORS.plan} strokeDasharray="4 2" strokeWidth={1} dot={false} name="Цель" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Alerts by priority */}
        {stats?.alertsByPriority && stats.alertsByPriority.length > 0 && (
          <div className="bg-muted border border-border rounded-xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-3">🚨 Алерты по приоритетам</div>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={100} height={100}>
                <PieChart>
                  <Pie data={stats.alertsByPriority} cx={50} cy={50} innerRadius={28} outerRadius={45} dataKey="value">
                    {stats.alertsByPriority.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {stats.alertsByPriority.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-[9px] text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="text-[10px] font-bold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Open alerts */}
        {stats?.openAlerts && stats.openAlerts.length > 0 && (
          <div className="bg-muted border border-border rounded-xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2.5">⚠️ Открытые алерты ({stats.openAlerts.length})</div>
            <div className="space-y-1.5">
              {stats.openAlerts.slice(0, 8).map((alert: Alert) => {
                const styles: Record<string, string> = {
                  critical: "text-destructive bg-destructive/10 border-destructive/30",
                  high: "text-yellow-500 bg-yellow-500/10 border-yellow-500/30",
                  medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
                  low: "text-muted-foreground bg-accent border-border",
                };
                return (
                  <div key={alert.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${styles[alert.priority] || styles.low}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                    <span className="text-[10px] font-medium flex-1 truncate">{alert.title}</span>
                    <span className="text-[8px] font-mono opacity-60">{new Date(alert.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Materials */}
        {data && data.materials.length > 0 && (
          <div className="bg-muted border border-border rounded-xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2.5">📦 Статус материалов</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: "Норма", value: stats?.matOk, color: "text-primary" },
                { label: "Дефицит", value: stats?.matDeficit, color: "text-destructive" },
                { label: "Всего", value: stats?.matTotal, color: "text-foreground" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className={`text-[18px] font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-[8px] text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
            {data.materials.filter((m) => m.deficit > 0).slice(0, 5).map((m: Material) => (
              <div key={m.id} className="flex items-center justify-between py-1.5 border-t border-border first:border-0">
                <span className="text-[10px] text-foreground truncate flex-1">{m.name}</span>
                <span className="text-[9px] text-destructive font-mono ml-2">-{m.deficit} {m.unit}</span>
              </div>
            ))}
          </div>
        )}

        {/* Crews */}
        {data && data.crews.filter((c) => c.is_active).length > 0 && (
          <div className="bg-muted border border-border rounded-xl p-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2.5">👷 Бригады на объекте</div>
            {data.crews.filter((c) => c.is_active).map((crew: Crew) => (
              <div key={crew.id} className="flex items-center gap-2.5 py-1.5 border-b border-border last:border-0">
                <div className="w-6 h-6 rounded-full bg-primary/12 text-primary text-[9px] font-bold flex items-center justify-center flex-shrink-0">{crew.headcount}</div>
                <div className="flex-1">
                  <div className="text-[10px] font-semibold text-foreground">{crew.name}</div>
                  {crew.specialization && <div className="text-[8px] text-muted-foreground">{crew.specialization}</div>}
                </div>
                {crew.foreman_name && <div className="text-[9px] text-muted-foreground">{crew.foreman_name}</div>}
              </div>
            ))}
          </div>
        )}

        <div className="text-center py-4 text-[9px] text-muted-foreground">Отчёт сформирован {today} · STSphera</div>
      </div>

      <style>{`@media print { body { background: white !important; color: black !important; } .print\\:hidden { display: none !important; } @page { margin: 1.5cm; } }`}</style>
    </div>
  );
};

export default ReportPDF;
