import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import PhotoUpload from "@/components/PhotoUpload";
import { useXP } from "@/hooks/useXP";
import XpToast from "@/components/XpToast";

interface PlanFactProps {
  projectId: string;
}

const PlanFact = ({ projectId }: PlanFactProps) => {
  const [records, setRecords] = useState<any[]>([]);
  const [workTypes, setWorkTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { award, lastXp, clearXp } = useXP(projectId);

  useEffect(() => {
    const fetchData = async () => {
      const [pfRes, wtRes] = await Promise.all([
        supabase.from("plan_fact").select("*").eq("project_id", projectId).order("date", { ascending: false }).limit(100),
        supabase.from("work_types").select("*").eq("project_id", projectId).order("sort_number"),
      ]);
      setRecords(pfRes.data || []);
      setWorkTypes(wtRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, [projectId]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  // Group by week
  const weekMap = new Map<number, { plan: number; fact: number }>();
  records.forEach(r => {
    const cur = weekMap.get(r.week_number) || { plan: 0, fact: 0 };
    cur.plan += Number(r.plan_value || 0);
    cur.fact += Number(r.fact_value || 0);
    weekMap.set(r.week_number, cur);
  });

  const chartData = Array.from(weekMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([w, d]) => ({ week: `Н${w}`, plan: d.plan, fact: d.fact }));

  const hasData = records.length > 0 || workTypes.length > 0;

  // Summary stats
  const totalPlan = records.reduce((s, r) => s + Number(r.plan_value || 0), 0);
  const totalFact = records.reduce((s, r) => s + Number(r.fact_value || 0), 0);
  const pct = totalPlan > 0 ? Math.round((totalFact / totalPlan) * 100) : 0;

  return (
    <div className="animate-fade-in p-2.5">
      {lastXp && <XpToast xp={lastXp.xp} action={lastXp.action} onDone={clearXp} />}

      {!hasData && (
        <div className="text-center py-8">
          <div className="text-2xl mb-2">📋</div>
          <div className="text-[12px] text-foreground font-semibold">Нет данных план-факт</div>
          <div className="text-[10px] text-muted-foreground mt-1">Добавьте виды работ и данные план-факт</div>
        </div>
      )}

      {/* Summary cards */}
      {hasData && (
        <div className="grid grid-cols-3 gap-1.5 mb-2.5">
          {[
            { label: "План", value: totalPlan.toLocaleString("ru"), color: "hsl(var(--info))" },
            { label: "Факт", value: totalFact.toLocaleString("ru"), color: "hsl(var(--primary))" },
            { label: "Выполн.", value: `${pct}%`, color: pct >= 100 ? "hsl(var(--primary))" : pct > 50 ? "hsl(var(--warning))" : "hsl(var(--destructive))" },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-lg p-2.5 text-center">
              <div className="font-mono text-[16px] font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[8px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Work types */}
      {workTypes.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-3.5 mb-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            Виды работ <span className="flex-1 h-px bg-border" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr>
                  {["Работа", "Ед.", "Объём"].map((h) => (
                    <th key={h} className="text-left text-[8px] font-bold uppercase tracking-wide text-muted-foreground p-1.5 border-b border-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {workTypes.map((wt) => (
                  <tr key={wt.id} className="hover:bg-accent/30 transition-colors">
                    <td className="p-2 border-b border-border font-semibold text-foreground">{wt.name}</td>
                    <td className="p-2 border-b border-border text-muted-foreground font-mono text-[9px]">{wt.unit}</td>
                    <td className="p-2 border-b border-border font-mono text-center">{wt.volume || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Photo reports per record */}
      {records.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-3.5 mb-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            Фото-отчёты <span className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-2">
            {records.slice(0, 5).map((r) => (
              <div key={r.id} className="border-b border-border pb-2 last:border-0">
                <div className="text-[10px] text-muted-foreground mb-1 font-mono">
                  {new Date(r.date).toLocaleDateString("ru-RU")} · Н{r.week_number}
                </div>
                <PhotoUpload
                  photos={r.photo_urls || []}
                  onPhotosChange={async (urls) => {
                    await supabase.from("plan_fact").update({ photo_urls: urls }).eq("id", r.id);
                    setRecords(prev => prev.map(rec => rec.id === r.id ? { ...rec, photo_urls: urls } : rec));
                  }}
                  onUploadComplete={(count) => {
                    for (let i = 0; i < count; i++) {
                      award("photo_upload", { source: "plan_fact", record_id: r.id });
                    }
                  }}
                  folder={`plan-fact/${r.id}`}
                  maxPhotos={5}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            План vs Факт по неделям <span className="flex-1 h-px bg-border" />
          </div>
          <div className="h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsla(var(--border))" />
                <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8, fontFamily: "JetBrains Mono" }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8, fontFamily: "JetBrains Mono" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsla(var(--border))", borderRadius: 8, fontSize: 10, color: "hsl(var(--foreground))" }} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Bar dataKey="plan" name="План" fill="hsl(var(--info) / 0.35)" radius={2} />
                <Bar dataKey="fact" name="Факт" fill="hsl(var(--primary) / 0.5)" radius={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanFact;
