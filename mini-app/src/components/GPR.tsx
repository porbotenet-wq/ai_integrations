import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface GPRProps {
  projectId: string;
}

const GPR = ({ projectId }: GPRProps) => {
  const [workTypes, setWorkTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from("work_types").select("*").eq("project_id", projectId).order("sort_number");
      setWorkTypes(data || []);
      setLoading(false);
    };
    fetchData();
  }, [projectId]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (workTypes.length === 0) {
    return (
      <div className="animate-fade-in p-2.5 text-center py-8">
        <div className="text-2xl mb-2">📆</div>
        <div className="text-[12px] text-foreground font-semibold">Нет видов работ</div>
        <div className="text-[10px] text-muted-foreground mt-1">Добавьте виды работ для формирования ГПР</div>
      </div>
    );
  }

  const maxVol = Math.max(...workTypes.map(w => Number(w.volume) || 0), 1);

  // Group by section
  const sections = new Map<string, any[]>();
  workTypes.forEach(wt => {
    const sec = wt.section || "Прочее";
    if (!sections.has(sec)) sections.set(sec, []);
    sections.get(sec)!.push(wt);
  });

  // Summary
  const totalTypes = workTypes.length;
  const withDates = workTypes.filter(w => w.start_date && w.end_date).length;
  const totalVol = workTypes.reduce((s, w) => s + (Number(w.volume) || 0), 0);

  return (
    <div className="animate-fade-in p-2.5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-1.5 mb-2.5">
        {[
          { label: "Работ", value: totalTypes, color: "hsl(var(--foreground))" },
          { label: "С датами", value: withDates, color: "hsl(var(--primary))" },
          { label: "Объём", value: totalVol.toLocaleString("ru"), color: "hsl(var(--info))" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-2.5 text-center">
            <div className="font-mono text-[14px] font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[8px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground my-3.5 flex items-center gap-2">
        График производства работ <span className="flex-1 h-px bg-border" />
      </div>

      {/* Gantt-like bars */}
      <div className="bg-card border border-border rounded-lg p-3.5 mb-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          Объёмы работ <span className="flex-1 h-px bg-border" />
        </div>
        <div>
          {workTypes.map((w) => {
            const vol = Number(w.volume) || 0;
            const wd = Math.max((vol / maxVol) * 80 + 10, 10);
            return (
              <div key={w.id} className="flex items-center gap-1.5 mb-1.5 text-[10px]">
                <div className="w-24 flex-shrink-0 text-[9px] text-muted-foreground text-right whitespace-nowrap overflow-hidden text-ellipsis">{w.name}</div>
                <div className="flex-1 h-5 bg-accent/30 rounded-sm relative overflow-hidden">
                  <div
                    className="absolute top-[1px] bottom-[1px] rounded-sm flex items-center px-1.5 font-mono text-[8px] font-semibold whitespace-nowrap bg-primary/20 border border-primary/40 text-primary"
                    style={{ width: `${wd}%` }}
                  >
                    {vol > 0 ? `${vol.toLocaleString("ru")} ${w.unit}` : w.unit}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sections table */}
      {Array.from(sections.entries()).map(([sec, items]) => (
        <div key={sec} className="bg-card border border-border rounded-lg p-3.5 mb-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            {sec} <span className="flex-1 h-px bg-border" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr>
                  {["Работа", "Ед.", "Объём", "Дней", "Начало", "Конец"].map((h) => (
                    <th key={h} className="text-left text-[8px] font-bold uppercase tracking-wide text-muted-foreground p-1.5 border-b border-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((wt) => (
                  <tr key={wt.id} className="hover:bg-accent/30 transition-colors">
                    <td className="p-2 border-b border-border font-semibold text-foreground whitespace-nowrap">{wt.name}</td>
                    <td className="p-2 border-b border-border font-mono text-[9px] text-muted-foreground">{wt.unit}</td>
                    <td className="p-2 border-b border-border font-mono text-center">{wt.volume || "—"}</td>
                    <td className="p-2 border-b border-border font-mono text-center">{wt.duration_days || "—"}</td>
                    <td className="p-2 border-b border-border font-mono text-[9px] text-muted-foreground">{wt.start_date || "—"}</td>
                    <td className="p-2 border-b border-border font-mono text-[9px] text-muted-foreground">{wt.end_date || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GPR;
