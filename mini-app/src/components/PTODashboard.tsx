// src/components/PTODashboard.tsx
// MONOLITH v3.0 — PTO Dashboard with LED accents
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, FileCheck, FileText, Inbox, Ruler } from "lucide-react";

interface Props { projectId: string; }

const PTODashboard = ({ projectId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [aosrDocs, setAosrDocs] = useState<any[]>([]);
  const [execSchemes, setExecSchemes] = useState(0);
  const [pendingInbox, setPendingInbox] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [docsRes, execRes, inboxRes] = await Promise.all([
          supabase.from("documents")
            .select("id, name, category, created_at")
            .eq("project_id", projectId)
            .in("category", ["aosr_brackets", "aosr_frame", "aosr_glass", "aosr"])
            .order("created_at", { ascending: false })
            .limit(20),
          supabase.from("documents")
            .select("id", { count: "exact", head: true })
            .eq("project_id", projectId)
            .eq("category", "exec_scheme"),
          supabase.from("bot_inbox")
            .select("id", { count: "exact", head: true })
            .eq("project_id", projectId)
            .eq("status", "new"),
        ]);

        setAosrDocs(docsRes.data || []);
        setExecSchemes(execRes.count || 0);
        setPendingInbox(inboxRes.count || 0);
      } catch (e) {
        console.error("PTODashboard error:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="px-1 pt-2 pb-1 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-[hsl(var(--green-dim))] flex items-center justify-center">
          <Ruler size={16} className="text-primary" />
        </div>
        <div className="text-[16px] font-bold text-t1">Панель ПТО</div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-2">
        <div className="stagger-item bg-bg1 border border-border rounded-xl p-3 text-center led-top led-green">
          <FileCheck size={16} className="mx-auto text-primary mb-1" />
          <div className="num text-2xl font-bold text-t1">{aosrDocs.length}</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-t3">АОСР</div>
        </div>
        <div className="stagger-item bg-bg1 border border-border rounded-xl p-3 text-center led-top led-green" style={{ animationDelay: "50ms" }}>
          <FileText size={16} className="mx-auto text-primary mb-1" />
          <div className="num text-2xl font-bold text-t1">{execSchemes}</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-t3">Исп. схемы</div>
        </div>
        <div className={`stagger-item bg-bg1 border border-border rounded-xl p-3 text-center led-top ${pendingInbox > 0 ? "led-amber" : "led-green"}`}
          style={{ animationDelay: "100ms" }}>
          <Inbox size={16} className={`mx-auto mb-1 ${pendingInbox > 0 ? "text-amber-500" : "text-primary"}`} />
          <div className="num text-2xl font-bold text-t1">{pendingInbox}</div>
          <div className="text-[9px] uppercase tracking-[0.15em] text-t3">Входящие</div>
        </div>
      </div>

      {/* AOSR registry */}
      <div className="bg-bg1 border border-border rounded-xl p-3">
        <p className="section-label">Реестр АОСР</p>
        {aosrDocs.length === 0 ? (
          <div className="text-[10px] text-t3 py-4 text-center">Нет документов АОСР</div>
        ) : (
          <div className="space-y-2 mt-2">
            {aosrDocs.map((d, i) => (
              <div key={d.id} className="stagger-item flex items-center gap-2 text-[10px]" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <span className="text-t1 truncate flex-1">{d.name}</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-[hsl(var(--green-dim))] text-primary font-semibold">{d.category}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PTODashboard;
