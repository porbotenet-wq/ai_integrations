import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

interface SupplyProps {
  projectId: string;
}

const statusCfg: Record<string, { label: string; cls: string; dot: string }> = {
  ok:       { label: "ОК",      cls: "bg-primary/10 text-primary border border-primary/20",             dot: "bg-primary" },
  normal:   { label: "ОК",      cls: "bg-primary/10 text-primary border border-primary/20",             dot: "bg-primary" },
  low:      { label: "Мало",    cls: "bg-warning/10 text-warning border border-warning/20",             dot: "bg-warning" },
  deficit:  { label: "Дефицит", cls: "bg-destructive/10 text-destructive border border-destructive/20", dot: "bg-destructive" },
  critical: { label: "Критич.", cls: "bg-destructive/10 text-destructive border border-destructive/20", dot: "bg-destructive" },
};

const PIE_COLORS = ["hsl(158 88% 40%)", "hsl(34 94% 56%)", "hsl(4 78% 54%)"];

const Supply = ({ projectId }: SupplyProps) => {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("materials").select("*").eq("project_id", projectId).order("name");
      setMaterials(data || []);
      setLoading(false);
    })();
  }, [projectId]);

  if (loading) {
    return (
      <div className="p-4 space-y-2 animate-fade-in">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-10 rounded-lg" />
        ))}
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
        <div className="text-3xl mb-2 opacity-30">◫</div>
        <p className="text-[hsl(var(--t2))] font-semibold text-sm">Нет материалов</p>
        <p className="text-[hsl(var(--t3))] text-xs mt-1">Добавьте материалы для этого проекта</p>
      </div>
    );
  }

  const okCount  = materials.filter((m) => m.status === "ok" || m.status === "normal").length;
  const lowCount = materials.filter((m) => m.status === "low").length;
  const defCount = materials.filter((m) => m.status === "deficit" || m.status === "critical").length;

  const pieData = [
    { name: "В наличии", value: okCount },
    { name: "Мало",      value: lowCount },
    { name: "Дефицит",   value: defCount },
  ].filter((d) => d.value > 0);

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Сводка статусов */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "В наличии", count: okCount,  color: "hsl(158 88% 40%)", dotCls: "bg-primary" },
          { label: "Мало",      count: lowCount, color: "hsl(34 94% 56%)",  dotCls: "bg-warning" },
          { label: "Дефицит",   count: defCount, color: "hsl(4 78% 54%)",   dotCls: "bg-destructive" },
        ].map((s) => (
          <div key={s.label} className="bg-[hsl(var(--bg1))] border border-border rounded-lg p-3 text-center">
            <div className="num text-xl font-bold" style={{ color: s.color }}>
              {s.count}
            </div>
            <p className="text-[10px] text-[hsl(var(--t3))] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Таблица материалов */}
      <div className="bg-[hsl(var(--bg1))] border border-border rounded-lg overflow-hidden">
        <p className="section-label px-3 pt-3">
          Материалы
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                {["Материал", "Ед.", "Нужно", "На пл.", "Статус"].map((h) => (
                  <th key={h} className="text-left text-[8px] font-bold uppercase tracking-wide text-[hsl(var(--t3))] p-2 border-b border-border">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => {
                const st = statusCfg[m.status] || statusCfg.normal;
                const isDeficit = m.status === "deficit" || m.status === "critical";
                return (
                  <tr key={m.id} className="border-b border-border last:border-b-0">
                    <td className="p-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
                        <span className="font-semibold">{m.name}</span>
                      </div>
                    </td>
                    <td className="p-2 num text-[9px] text-[hsl(var(--t2))]">{m.unit}</td>
                    <td className="p-2 num text-center">
                      {Number(m.total_required).toLocaleString("ru")}
                    </td>
                    <td className={`p-2 num text-center font-semibold ${isDeficit ? "text-destructive" : ""}`}>
                      {Number(m.on_site).toLocaleString("ru")}
                    </td>
                    <td className="p-2">
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${st.cls}`}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Диаграмма */}
      {pieData.length > 1 && (
        <div className="bg-[hsl(var(--bg1))] border border-border rounded-lg p-3">
          <p className="section-label">Снабжение — обзор</p>
          <div className="h-[180px] mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={72} dataKey="value" paddingAngle={2}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(220 16% 9%)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 8,
                    fontSize: 10,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                <span className="text-[10px] text-[hsl(var(--t2))]">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Supply;
