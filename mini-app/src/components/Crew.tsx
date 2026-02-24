import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface CrewProps {
  projectId: string;
}

const Crew = ({ projectId }: CrewProps) => {
  const [crews, setCrews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from("crews").select("*").eq("project_id", projectId).order("name");
      setCrews(data || []);
      setLoading(false);
    };
    fetchData();
  }, [projectId]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (crews.length === 0) {
    return (
      <div className="animate-fade-in p-2.5 text-center py-8">
        <div className="text-2xl mb-2">👷</div>
        <div className="text-[12px] text-foreground font-semibold">Нет бригад</div>
        <div className="text-[10px] text-muted-foreground mt-1">Добавьте бригады для этого проекта</div>
      </div>
    );
  }

  const activeCount = crews.filter(c => c.is_active).length;
  const totalHeadcount = crews.reduce((s, c) => s + (c.headcount || 0), 0);

  return (
    <div className="animate-fade-in p-2.5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-1.5 mb-2.5">
        {[
          { label: "Бригад", value: crews.length, color: "hsl(var(--foreground))" },
          { label: "Активных", value: activeCount, color: "hsl(var(--primary))" },
          { label: "Человек", value: totalHeadcount, color: "hsl(var(--info))" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-2.5 text-center">
            <div className="font-mono text-[16px] font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[8px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground my-3.5 flex items-center gap-2">
        Активные бригады <span className="flex-1 h-px bg-border" />
      </div>

      {crews.map((b) => (
        <div key={b.id} className="bg-card border border-border rounded-lg p-3 mb-1.5 cursor-pointer hover:border-primary/30 transition-all">
          <div className="flex justify-between items-center mb-1.5">
            <div className="text-xs font-bold text-foreground">{b.name}</div>
            <div className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
              b.is_active 
                ? "bg-primary/12 text-primary border border-primary/20" 
                : "bg-muted text-muted-foreground border border-border"
            }`}>
              {b.is_active ? "Активна" : "Ожидание"}
            </div>
          </div>
          {b.specialization && <div className="text-[9px] text-muted-foreground mb-2">{b.specialization}</div>}
          <div className="grid grid-cols-2 gap-1.5 text-center">
            <div className="bg-accent/30 rounded-md py-1.5">
              <div className="font-mono text-[13px] font-bold text-info">{b.headcount}</div>
              <div className="text-[8px] text-muted-foreground uppercase tracking-wider">чел</div>
            </div>
            <div className="bg-accent/30 rounded-md py-1.5">
              <div className="font-mono text-[13px] font-bold text-warning truncate px-1">{b.foreman_name || "—"}</div>
              <div className="text-[8px] text-muted-foreground uppercase tracking-wider">прораб</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Crew;
