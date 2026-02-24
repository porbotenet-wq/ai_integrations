import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useXP } from "@/hooks/useXP";
import PhotoUpload from "@/components/PhotoUpload";
import XpToast from "@/components/XpToast";

interface AlertsProps {
  projectId: string;
}

type Filter = "all" | "ug" | "wn" | "info";

const priorityConfig: Record<string, {
  tp: string; dot: string; border: string; badge: string; badgeText: string;
}> = {
  critical: {
    tp: "ug",
    dot: "bg-destructive",
    border: "border-l-destructive",
    badge: "bg-destructive/10 text-destructive border border-destructive/20",
    badgeText: "КРИТ",
  },
  high: {
    tp: "ug",
    dot: "bg-destructive/80",
    border: "border-l-destructive",
    badge: "bg-destructive/10 text-destructive border border-destructive/20",
    badgeText: "ВЫСОК",
  },
  normal: {
    tp: "wn",
    dot: "bg-warning",
    border: "border-l-warning",
    badge: "bg-warning/10 text-warning border border-warning/20",
    badgeText: "СРЕДН",
  },
  medium: {
    tp: "wn",
    dot: "bg-warning",
    border: "border-l-warning",
    badge: "bg-warning/10 text-warning border border-warning/20",
    badgeText: "СРЕДН",
  },
  low: {
    tp: "info",
    dot: "bg-primary/60",
    border: "border-l-primary",
    badge: "bg-primary/10 text-primary border border-primary/20",
    badgeText: "ИНФО",
  },
  info: {
    tp: "info",
    dot: "bg-primary/60",
    border: "border-l-primary",
    badge: "bg-primary/10 text-primary border border-primary/20",
    badgeText: "ИНФО",
  },
};

const filterBtns: { id: Filter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "ug", label: "Критические" },
  { id: "wn", label: "Предупреждения" },
  { id: "info", label: "Инфо" },
];

const Alerts = ({ projectId }: AlertsProps) => {
  const { user } = useAuth();
  const { award, lastXp, clearXp } = useXP(projectId);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("alerts")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(50);
      setAlerts(data || []);
      setLoading(false);
    })();
  }, [projectId]);

  const handleResolve = async (alertId: string) => {
    if (!user) return;
    setResolving(alertId);
    const { error } = await supabase
      .from("alerts")
      .update({ is_resolved: true, resolved_at: new Date().toISOString(), resolved_by: user.id })
      .eq("id", alertId);
    if (!error) {
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_resolved: true } : a));
      await award("alert_resolved", { alert_id: alertId });
    }
    setResolving(null);
  };

  if (loading) {
    return (
      <div className="p-4 space-y-2 animate-fade-in">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-16 rounded-lg" />
        ))}
      </div>
    );
  }

  const filtered = alerts.filter((a) => {
    if (filter === "all") return true;
    const cfg = priorityConfig[a.priority] || priorityConfig.normal;
    return cfg.tp === filter;
  });

  const critCount = alerts.filter((a) => a.priority === "critical").length;
  const highCount = alerts.filter((a) => a.priority === "high").length;

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
        <div className="text-3xl mb-2 opacity-30">◉</div>
        <p className="text-[hsl(var(--t2))] font-semibold text-sm">Нет уведомлений</p>
        <p className="text-[hsl(var(--t3))] text-xs mt-1">Алерты появятся при событиях на объекте</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 animate-fade-in">
      {lastXp && <XpToast xp={lastXp.xp} action={lastXp.action} onDone={clearXp} />}

      {/* Счётчики */}
      {(critCount > 0 || highCount > 0) && (
        <div className="flex items-center gap-2 px-3 py-2 bg-destructive/5 border border-destructive/15 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse-dot" />
          <span className="text-[11px] font-semibold text-destructive">
            {critCount > 0 && `${critCount} критич.`}
            {critCount > 0 && highCount > 0 && " · "}
            {highCount > 0 && `${highCount} высокий`}
          </span>
        </div>
      )}

      {/* Фильтры */}
      <div className="flex gap-1 flex-wrap">
        {filterBtns.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all duration-150 ${
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-[hsl(var(--bg2))] text-[hsl(var(--t2))] border border-border hover:text-[hsl(var(--t1))] hover:border-white/10"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Список */}
      <div className="space-y-1.5">
        {filtered.map((a) => {
          const cfg = priorityConfig[a.priority] || priorityConfig.normal;
          const age = Math.round((Date.now() - new Date(a.created_at).getTime()) / 3600000);
          const ageStr = age < 24 ? `${age}ч` : `${Math.round(age / 24)}д`;
          return (
            <div key={a.id} className={`bg-[hsl(var(--bg1))] rounded-lg border-l-[3px] ${cfg.border} border border-border overflow-hidden`}>
              <div className="flex gap-2.5 p-3">
                <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${cfg.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] font-semibold leading-tight">{a.title}</p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${cfg.badge}`}>
                        {cfg.badgeText}
                      </span>
                      {a.is_resolved ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">✓</span>
                      ) : (
                        <button
                          onClick={() => handleResolve(a.id)}
                          disabled={resolving === a.id}
                          className="text-[9px] font-bold px-2 py-1 rounded bg-primary/15 text-primary hover:bg-primary/25 transition-colors disabled:opacity-50"
                        >
                          {resolving === a.id ? "..." : "Закрыть"}
                        </button>
                      )}
                    </div>
                  </div>
                  {a.description && (
                    <p className="text-[10px] text-[hsl(var(--t2))] leading-snug mt-1">{a.description}</p>
                  )}
                  <p className="num text-[9px] text-[hsl(var(--t3))] mt-1">{ageStr} назад</p>
                </div>
              </div>
              <div className="px-3 pb-2">
                <PhotoUpload
                  photos={(a as any).photo_urls || []}
                  onPhotosChange={async (urls) => {
                    await supabase.from("alerts").update({ photo_urls: urls }).eq("id", a.id);
                    setAlerts(prev => prev.map(al => al.id === a.id ? { ...al, photo_urls: urls } : al));
                  }}
                  folder={`alerts/${a.id}`}
                  maxPhotos={3}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Alerts;
