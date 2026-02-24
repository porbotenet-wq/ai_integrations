// src/components/ForemanDashboard.tsx
// MONOLITH v3.0 — Foreman Dashboard with LED accents
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Camera, FileText, CheckCircle2, HardHat } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

interface Props { projectId: string; }

const ForemanDashboard = ({ projectId }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [myFloors, setMyFloors] = useState<any[]>([]);
  const [recentPhotos, setRecentPhotos] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];

        const [logsRes, crewsRes, photosRes] = await Promise.all([
          supabase.from("daily_logs")
            .select("id", { count: "exact", head: true })
            .eq("project_id", projectId)
            .eq("submitted_by", user.id)
            .eq("date", today),
          supabase.from("crews")
            .select("id, name, facade_id, facades(id, name, floors_count)")
            .eq("project_id", projectId)
            .eq("foreman_user_id", user.id)
            .eq("is_active", true),
          supabase.from("bot_documents")
            .select("id, doc_type, created_at, file_url, comment")
            .eq("sender_id", user.id)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        setReportSubmitted((logsRes.count || 0) > 0);
        
        const facadeIds = (crewsRes.data || [])
          .map((c: any) => c.facade_id)
          .filter(Boolean);
        
        if (facadeIds.length > 0) {
          const { data: floorsData } = await supabase
            .from("floors")
            .select("*")
            .in("facade_id", facadeIds)
            .order("floor_number");
          setMyFloors(floorsData || []);
        }

        setRecentPhotos(photosRes.data || []);
      } catch (e) {
        console.error("ForemanDashboard error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId, user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
        <div className="text-[11px] text-t2">Загрузка…</div>
      </div>
    );
  }

  const totalPlan = myFloors.reduce((s, f) => s + (f.modules_plan || 0), 0);
  const totalFact = myFloors.reduce((s, f) => s + (f.modules_fact || 0), 0);
  const pct = totalPlan > 0 ? Math.round((totalFact / totalPlan) * 100) : 0;

  return (
    <div className="p-3 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="px-1 pt-2 pb-1 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-[hsl(var(--green-dim))] flex items-center justify-center">
          <HardHat size={16} className="text-primary" />
        </div>
        <div className="text-[16px] font-bold text-t1">Панель прораба</div>
      </div>

      {/* Report CTA */}
      <button
        className={`w-full rounded-xl p-4 text-center transition-all duration-150 active:scale-[0.97] ${
          reportSubmitted
            ? "bg-bg2 border border-border"
            : "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(var(--green-glow))]"
        }`}
        style={{ minHeight: 64 }}
        disabled={reportSubmitted}
      >
        {reportSubmitted ? (
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 size={20} className="text-primary" />
            <span className="font-bold text-[14px] text-t1">Отчёт подан ✓</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <FileText size={20} />
            <span className="font-bold text-[14px]">Подать отчёт</span>
          </div>
        )}
      </button>

      {/* Floors progress */}
      {myFloors.length > 0 && (
        <div className="bg-bg1 border border-border rounded-xl p-3">
          <p className="section-label">Мои этажи — <span className="num text-primary">{pct}%</span></p>
          <div className="h-1.5 rounded-full bg-bg3 overflow-hidden mb-3 mt-2">
            <div className="h-full rounded-full bg-primary transition-all duration-700 relative"
              style={{ width: `${Math.min(pct, 100)}%`, animation: 'progress-fill 0.8s cubic-bezier(0.4,0,0.2,1)' }}>
              <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-white/15 to-transparent rounded-full" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {myFloors.slice(0, 12).map((f, i) => {
              const floorPct = f.modules_plan > 0 ? Math.round((f.modules_fact / f.modules_plan) * 100) : 0;
              const isComplete = floorPct >= 100;
              const isStarted = floorPct > 0;
              return (
                <div
                  key={f.id}
                  className={`stagger-item relative rounded-xl p-1.5 text-center border transition-all led-top ${
                    isComplete
                      ? "bg-[hsl(var(--green-dim))] border-primary/25 text-primary led-green"
                      : isStarted
                      ? "bg-[hsl(var(--amber-dim))] border-amber-500/25 text-amber-500 led-amber"
                      : "bg-bg2 border-border text-t3"
                  }`}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="text-[9px] font-semibold">Эт.{f.floor_number}</div>
                  <div className="num text-[12px] font-bold">{floorPct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent photos */}
      {recentPhotos.length > 0 && (
        <div className="bg-bg1 border border-border rounded-xl p-3">
          <div className="section-label">
            <Camera size={12} />Последние фото
          </div>
          <div className="space-y-2 mt-2">
            {recentPhotos.map((p, i) => (
              <div key={p.id} className="stagger-item flex items-center gap-2 text-[10px]" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <span className="text-t1 truncate flex-1">{p.doc_type}: {p.comment || "без комментария"}</span>
                <span className="text-t3">{format(new Date(p.created_at), "dd.MM")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {myFloors.length === 0 && recentPhotos.length === 0 && (
        <div className="text-center py-12 text-t2 text-[11px]">
          Нет привязанных этажей. Обратитесь к РП.
        </div>
      )}
    </div>
  );
};

export default ForemanDashboard;
