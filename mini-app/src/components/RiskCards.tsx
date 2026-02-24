// src/components/RiskCards.tsx
// MONOLITH v3.0 — Horizontal scrolling risk cards with LED accents
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock } from "lucide-react";
import { format } from "date-fns";

interface Props {
  projectId: string;
}

const PRIORITY_CONFIG: Record<string, { led: string; badge: string; label: string }> = {
  critical: { led: "led-red", badge: "bg-[hsl(var(--red-dim))] text-destructive", label: "КРИТИЧНЫЙ" },
  high: { led: "led-amber", badge: "bg-[hsl(var(--amber-dim))] text-amber-500", label: "ВЫСОКИЙ" },
  medium: { led: "led-blue", badge: "bg-[hsl(var(--blue-dim))] text-blue-400", label: "СРЕДНИЙ" },
  low: { led: "led-green", badge: "bg-[hsl(var(--green-dim))] text-primary", label: "НИЗКИЙ" },
};

const RiskCards = ({ projectId }: Props) => {
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("alerts")
        .select("id, title, description, priority, created_at")
        .eq("project_id", projectId)
        .eq("is_resolved", false)
        .order("created_at", { ascending: false })
        .limit(10);
      setAlerts(data || []);
    };
    load();
  }, [projectId]);

  if (alerts.length === 0) return null;

  return (
    <div>
      <p className="section-label">Риски</p>
      <div className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-1">
        {alerts.map((a, i) => {
          const cfg = PRIORITY_CONFIG[a.priority] || PRIORITY_CONFIG.medium;
          return (
            <div
              key={a.id}
              className={`stagger-item flex-shrink-0 w-[280px] snap-start bg-bg1 border border-border rounded-xl p-3.5 led-top ${cfg.led}`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className={`inline-block text-[9px] uppercase font-bold px-2 py-0.5 rounded-md mb-2 ${cfg.badge}`}>
                {cfg.label}
              </span>
              <div className="text-[13px] font-bold text-t1 mb-1 line-clamp-1">{a.title}</div>
              {a.description && (
                <div className="text-[11px] text-t2 line-clamp-2 mb-2">{a.description}</div>
              )}
              <div className="flex items-center gap-1 text-[10px] text-t3">
                <Clock size={10} />
                {format(new Date(a.created_at), "dd.MM HH:mm")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RiskCards;
