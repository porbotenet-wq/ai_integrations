// src/components/Dashboard.tsx
// MONOLITH v3.0 — Bento KPI grid with LED accents and kinetic typography
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import RiskCards from "./RiskCards";

interface DashboardProps {
  projectId: string;
}

/* Skeleton placeholder — matches KPI card height */
const SkeletonKPI = () => (
  <div className="skeleton h-[92px] rounded-xl" />
);

/* Progress bar with highlight shimmer on fill end */
const ProgressBar = ({ pct, color }: { pct: number; color: string }) => (
  <div className="h-1.5 rounded-full bg-bg3 overflow-hidden">
    <div
      className="h-full rounded-full transition-all duration-700 ease-out relative"
      style={{
        width: `${Math.min(pct, 100)}%`,
        backgroundColor: color,
        animation: 'progress-fill 0.8s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Highlight shimmer on tip */}
      <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-white/15 to-transparent rounded-full" />
    </div>
  </div>
);

/* KPI Card — left LED border, kinetic number, monolith surface */
const KPICard = ({
  label, value, sub, accentColor, ledColor,
}: {
  label: string; value: string; sub: string;
  accentColor: string; ledColor: string;
}) => (
  <div
    className="relative bg-bg1 border border-border rounded-xl p-3.5 overflow-hidden transition-all duration-150 hover:border-[rgba(255,255,255,0.1)]"
    style={{ borderLeftColor: ledColor, borderLeftWidth: 3 }}
  >
    <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-t3 mb-1.5">
      {label}
    </p>
    <p className="num text-2xl font-bold leading-none" style={{ color: accentColor }}>
      {value}
    </p>
    <p className="text-[10px] text-t3 mt-1">{sub}</p>
  </div>
);

const Dashboard = ({ projectId }: DashboardProps) => {
  const [facades, setFacades] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFacade, setActiveFacade] = useState(0);

  useEffect(() => {
    const fetchAll = async () => {
      const [facRes, flRes, matRes] = await Promise.all([
        supabase.from("facades").select("*").eq("project_id", projectId),
        supabase.from("floors").select("*"),
        supabase.from("materials").select("*").eq("project_id", projectId),
      ]);
      setFacades(facRes.data || []);
      setFloors(flRes.data || []);
      setMaterials(matRes.data || []);
      setLoading(false);
    };
    fetchAll();
  }, [projectId]);

  if (loading) {
    return (
      <div className="p-4 space-y-3 animate-fade-in">
        <div className="grid grid-cols-2 gap-2.5">
          {[0, 1, 2, 3].map((i) => <SkeletonKPI key={i} />)}
        </div>
      </div>
    );
  }

  const totalModulesPlan = floors.reduce((s, f) => s + (f.modules_plan || 0), 0);
  const totalModulesFact = floors.reduce((s, f) => s + (f.modules_fact || 0), 0);
  const totalBracketsPlan = floors.reduce((s, f) => s + (f.brackets_plan || 0), 0);
  const totalBracketsFact = floors.reduce((s, f) => s + (f.brackets_fact || 0), 0);
  const totalSealantPlan = floors.reduce((s, f) => s + Number(f.sealant_plan || 0), 0);
  const totalSealantFact = floors.reduce((s, f) => s + Number(f.sealant_fact || 0), 0);
  const deficitCount = materials.filter((m) => m.status === "deficit" || m.deficit > 0).length;

  const green = "hsl(158 100% 39%)";
  const amber = "hsl(36 88% 56%)";
  const blue = "hsl(218 92% 62%)";
  const red = "hsl(4 76% 52%)";

  const kpis = [
    { label: "Модули СПК", value: totalModulesFact.toLocaleString("ru"), sub: `из ${totalModulesPlan.toLocaleString("ru")} шт`, accentColor: green, ledColor: green },
    { label: "Кронштейны", value: totalBracketsFact.toLocaleString("ru"), sub: `из ${totalBracketsPlan.toLocaleString("ru")} компл`, accentColor: amber, ledColor: amber },
    { label: "Герметизация", value: Math.round(totalSealantFact).toLocaleString("ru"), sub: `из ${Math.round(totalSealantPlan).toLocaleString("ru")} м.п.`, accentColor: blue, ledColor: blue },
    { label: "Дефицит", value: String(deficitCount), sub: "позиций", accentColor: deficitCount > 0 ? red : green, ledColor: deficitCount > 0 ? red : green },
  ];

  const progress = [
    { label: "Модули СПК", pct: totalModulesPlan > 0 ? Math.round((totalModulesFact / totalModulesPlan) * 100) : 0, color: green },
    { label: "Кронштейны", pct: totalBracketsPlan > 0 ? Math.round((totalBracketsFact / totalBracketsPlan) * 100) : 0, color: amber },
    { label: "Герметизация", pct: totalSealantPlan > 0 ? Math.round((totalSealantFact / totalSealantPlan) * 100) : 0, color: blue },
  ];

  const hasData = totalModulesPlan > 0 || facades.length > 0 || materials.length > 0;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Empty state */}
      {!hasData && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-bg2 border border-border flex items-center justify-center mb-3">
            <span className="text-t3 text-xl">◧</span>
          </div>
          <p className="text-t2 font-semibold text-sm">Нет данных</p>
          <p className="text-t3 text-xs mt-1">Добавьте фасады, этажи и материалы</p>
        </div>
      )}

      {/* KPI Bento Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {kpis.map((k, i) => <KPICard key={k.label} {...k} />)}
      </div>

      {/* Risk Cards */}
      <RiskCards projectId={projectId} />

      {/* Progress section */}
      {totalModulesPlan > 0 && (
        <div className="bg-bg1 border border-border rounded-xl p-4">
          <p className="section-label">Общий прогресс</p>
          <div className="space-y-3.5 mt-2">
            {progress.map((p) => (
              <div key={p.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-t2">{p.label}</span>
                  <span className="num text-[11px] font-bold" style={{ color: p.color }}>
                    {p.pct}%
                  </span>
                </div>
                <ProgressBar pct={p.pct} color={p.color} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Facade grid */}
      {facades.length > 0 && (
        <div>
          <p className="section-label">Фасады</p>
          <div className="grid grid-cols-4 gap-2.5">
            {facades.map((f: any, i: number) => {
              const isActive = activeFacade === i;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFacade(i)}
                  className={`relative rounded-xl p-2.5 text-center transition-all duration-150 border active:scale-[0.97] ${
                    isActive
                      ? "bg-[hsl(var(--green-dim))] border-primary/25 text-primary led-top led-green"
                      : "bg-bg2 border-border hover:border-[rgba(255,255,255,0.1)] text-t2 hover:text-t1"
                  }`}
                >
                  <div className="num text-[10px] font-bold">{f.code || f.name.slice(0, 2)}</div>
                  <div className="num text-lg font-bold mt-0.5 leading-none">{(f.total_modules || 0).toLocaleString("ru")}</div>
                  <div className="text-[8px] text-t3 mt-0.5">мод.</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
