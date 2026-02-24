import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, LogOut, User, Building2, TrendingUp, AlertTriangle, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import ProfileSettings from "@/components/ProfileSettings";
import { format } from "date-fns";

interface Project {
  id: string;
  name: string;
  code: string | null;
  city: string | null;
  address: string | null;
  work_type: string;
  status: string;
  client_name: string | null;
  start_date: string | null;
  end_date: string | null;
  cover_image_url: string | null;
  photo_url: string | null;
}

interface ProjectKPI {
  alertsCount: number;
  crewsCount: number;
  progressPct: number;
}

const statusLed: Record<string, { bg: string; glow: string }> = {
  draft:     { bg: "bg-[hsl(var(--blue))]",  glow: "shadow-[0_0_6px_hsl(var(--blue)/0.4)]" },
  active:    { bg: "bg-primary",              glow: "shadow-[0_0_6px_hsl(var(--green-glow))]" },
  paused:    { bg: "bg-[hsl(var(--amber))]",  glow: "shadow-[0_0_6px_hsl(var(--amber)/0.4)]" },
  completed: { bg: "bg-[hsl(var(--blue))]",   glow: "shadow-[0_0_6px_hsl(var(--blue)/0.4)]" },
};

const workTypeLabels: Record<string, string> = {
  spk: "СПК",
  nvf: "НВФ",
  both: "НВФ • СПК",
};

interface ProjectListProps {
  onSelectProject: (id: string, name?: string) => void;
  onCreateNew: () => void;
}

const ProjectList = ({ onSelectProject, onCreateNew }: ProjectListProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<Record<string, ProjectKPI>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { displayName, signOut } = useAuth();

  useEffect(() => {
    const fetchProjects = async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, code, city, address, work_type, status, client_name, start_date, end_date, cover_image_url, photo_url")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setProjects(data as Project[]);
        loadKPIs(data.map((p: any) => p.id));
      }
      setLoading(false);
    };
    fetchProjects();
  }, []);

  const loadKPIs = async (projectIds: string[]) => {
    const results: Record<string, ProjectKPI> = {};
    await Promise.all(
      projectIds.map(async (pid) => {
        const [alertsRes, crewsRes, floorsRes] = await Promise.all([
          supabase.from("alerts").select("id", { count: "exact", head: true }).eq("project_id", pid).eq("is_resolved", false),
          supabase.from("crews").select("id", { count: "exact", head: true }).eq("project_id", pid).eq("is_active", true),
          supabase.from("floors").select("modules_plan, modules_fact, facade_id").in(
            "facade_id",
            (await supabase.from("facades").select("id").eq("project_id", pid)).data?.map((f: any) => f.id) || []
          ),
        ]);

        const totalPlan = (floorsRes.data || []).reduce((s, r) => s + Number(r.modules_plan), 0);
        const totalFact = (floorsRes.data || []).reduce((s, r) => s + Number(r.modules_fact), 0);
        const progressPct = totalPlan > 0 ? Math.round((totalFact / totalPlan) * 100) : 0;

        results[pid] = {
          alertsCount: alertsRes.count || 0,
          crewsCount: crewsRes.count || 0,
          progressPct,
        };
      })
    );
    setKpis(results);
  };

  const initials = displayName
    ? displayName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[hsl(var(--bg0)/0.88)] backdrop-blur-[20px] border-b border-border px-3.5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-bg2 flex items-center justify-center text-[10px] font-bold text-t2">
            {initials}
          </div>
          <div>
            <div className="text-[13px] font-bold tracking-tight">🏗️ Объекты</div>
            {displayName && <div className="text-[9px] text-t3 truncate max-w-[120px]">{displayName}</div>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 rounded-xl bg-bg2 flex items-center justify-center text-t2 hover:text-t1 transition-colors"
            title="Профиль"
          >
            <User size={14} />
          </button>
          <button
            onClick={signOut}
            className="w-8 h-8 rounded-xl bg-bg2 flex items-center justify-center text-t2 hover:text-destructive transition-colors"
            title="Выйти"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      <ProfileSettings open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* Project Cards */}
      <div className="p-3 space-y-4 pb-28">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : projects.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Building2 size={64} className="text-t3 opacity-20" />
            <div className="text-[14px] text-t2 font-semibold">Создайте первый объект</div>
            <button
              onClick={onCreateNew}
              className="bg-primary text-primary-foreground rounded-xl px-6 py-3 text-[13px] font-bold hover:brightness-110 active:scale-[0.97] transition-all"
            >
              Новый объект
            </button>
          </div>
        ) : (
          projects.map((p, index) => {
            const led = statusLed[p.status] || statusLed.draft;
            const kpi = kpis[p.id];
            const heroImg = p.cover_image_url || p.photo_url;
            const wtLabel = workTypeLabels[p.work_type] || p.work_type;
            const subtitle = [p.city, wtLabel].filter(Boolean).join(" • ");

            return (
              <button
                key={p.id}
                onClick={() => onSelectProject(p.id, p.name)}
                className="stagger-item w-full text-left h-[260px] relative rounded-2xl overflow-hidden shadow-lg active:scale-[0.98] transition-transform duration-150"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                {/* Hero image or placeholder */}
                {heroImg ? (
                  <img
                    src={heroImg}
                    alt={p.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--bg2))] to-[hsl(var(--bg3))] flex items-center justify-center">
                    <Building2 size={48} className="text-t3 opacity-[0.15]" />
                  </div>
                )}

                {/* LED strip top */}
                <div className={`absolute top-0 left-0 right-0 h-[2px] ${led.bg} ${led.glow} z-10`} />

                {/* Client badge */}
                {p.client_name && (
                  <div className="absolute top-3 right-3 z-10 bg-black/40 backdrop-blur-sm rounded-lg px-2 py-1 text-[9px] text-white/80 font-medium max-w-[140px] truncate">
                    {p.client_name}
                  </div>
                )}

                {/* Gradient overlay */}
                <div
                  className="absolute inset-0 z-[1]"
                  style={{
                    background: "linear-gradient(to top, hsl(var(--bg0)) 0%, hsl(var(--bg0) / 0.7) 35%, transparent 60%)"
                  }}
                />

                {/* Content on overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1.5 z-[2]">
                  <h3
                    className="text-[20px] font-bold text-white leading-tight"
                    style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
                  >
                    {p.name}
                  </h3>

                  {subtitle && (
                    <div className="text-[12px] text-white/70">{subtitle}</div>
                  )}

                  {p.start_date && p.end_date && (
                    <div className="text-[11px] text-white/50">
                      {format(new Date(p.start_date), "dd.MM.yyyy")} — {format(new Date(p.end_date), "dd.MM.yyyy")}
                    </div>
                  )}

                  {/* KPI chips */}
                  <div className="flex gap-2 mt-2">
                    <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-lg px-2.5 py-1">
                      <TrendingUp size={12} className="text-primary" />
                      <span className="num text-[13px] font-bold text-white">{kpi?.progressPct ?? "—"}%</span>
                    </div>
                    <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-lg px-2.5 py-1">
                      <AlertTriangle size={12} className={(kpi?.alertsCount || 0) > 0 ? "text-destructive" : "text-white/50"} />
                      <span className="num text-[13px] font-bold text-white">{kpi?.alertsCount ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm rounded-lg px-2.5 py-1">
                      <Users size={12} className="text-white/50" />
                      <span className="num text-[13px] font-bold text-white">{kpi?.crewsCount ?? "—"}</span>
                    </div>
                  </div>
                </div>

                {/* Progress bar bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[hsl(var(--bg3))] z-[3]">
                  <div
                    className="h-full bg-primary rounded-r-full transition-all duration-500"
                    style={{ width: `${kpi?.progressPct || 0}%` }}
                  />
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Floating FAB */}
      <button
        onClick={onCreateNew}
        className="fixed bottom-20 right-4 z-50 w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-[0_0_16px_hsl(var(--green-glow))] hover:brightness-110 active:scale-[0.95] transition-all"
      >
        <Plus size={24} />
      </button>
    </div>
  );
};

export default ProjectList;
