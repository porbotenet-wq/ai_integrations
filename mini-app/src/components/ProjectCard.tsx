import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import type { ContactInfo } from "@/types/database";

interface ProjectCardProps {
  projectId: string;
  onBack: () => void;
}

const workTypeLabels: Record<string, { text: string; cls: string }> = {
  spk: { text: "СПК", cls: "bg-primary/12 text-primary border border-primary/20" },
  nvf: { text: "НВФ", cls: "bg-info/12 text-info border border-info/20" },
  both: { text: "НВФ + СПК", cls: "bg-warning/12 text-warning border border-warning/20" },
};

const InfoRow = ({ label, value }: { label: string; value: string | null }) => {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start py-2 border-b border-border last:border-0">
      <span className="text-[10px] text-muted-foreground flex-shrink-0 w-28">{label}</span>
      <span className="text-[10px] text-foreground font-semibold text-right">{value}</span>
    </div>
  );
};

const ProjectCard = ({ projectId, onBack }: ProjectCardProps) => {
  const [project, setProject] = useState<Tables<"projects"> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      setProject(data);
      setLoading(false);
    };
    fetch();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return <div className="text-center py-8 text-muted-foreground text-[11px]">Проект не найден</div>;
  }

  const wt = workTypeLabels[project.work_type] || workTypeLabels.spk;
  const contacts = (project.contacts as any[] | null) || [];

  return (
    <div className="animate-fade-in p-2.5">
      <button onClick={onBack} className="text-[11px] text-muted-foreground mb-3 hover:text-primary transition-colors">
        ← К списку объектов
      </button>

      {/* Заголовок проекта */}
      <div className="bg-card border border-border rounded-lg p-3.5 mb-2.5">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-[14px] font-bold text-foreground mb-0.5">{project.name}</div>
            {project.code && <div className="font-mono text-[10px] text-muted-foreground">{project.code}</div>}
          </div>
          <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded ${wt.cls}`}>{wt.text}</span>
        </div>
        {(project.city || project.address) && (
          <div className="text-[10px] text-muted-foreground mb-1">📍 {[project.city, project.address].filter(Boolean).join(", ")}</div>
        )}
        {project.start_date && project.end_date && (
          <div className="text-[10px] text-muted-foreground mb-1">📅 {project.start_date} — {project.end_date}</div>
        )}
      </div>

      {/* Заказчик */}
      <div className="bg-card border border-border rounded-lg p-3.5 mb-2.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
          🏢 Заказчик <span className="flex-1 h-px bg-border" />
        </div>
        <InfoRow label="Компания" value={project.client_name} />
        <InfoRow label="Директор" value={project.client_director} />
        <InfoRow label="ИНН" value={project.client_inn} />
        <InfoRow label="Телефон" value={project.client_phone} />
        <InfoRow label="E-mail" value={project.client_email} />
        <InfoRow label="Юр. адрес" value={project.client_legal_address} />
        <InfoRow label="Факт. адрес" value={project.client_actual_address} />
        <InfoRow label="Банк" value={project.client_bank} />
        <InfoRow label="Р/С" value={project.client_account} />
      </div>

      {/* Контакты */}
      {contacts.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-3.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            👥 Контакты <span className="flex-1 h-px bg-border" />
          </div>
          {contacts.map((c: ContactInfo, i: number) => (
            <div key={i} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
              <div className="w-7 h-7 rounded-full bg-primary/12 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                {(c.role || "?")[0]}
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-semibold text-foreground">{c.name || "—"}</div>
                <div className="text-[9px] text-muted-foreground">{c.role || "—"}</div>
              </div>
              <div className="text-[9px] text-muted-foreground font-mono">{c.phone || "—"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectCard;
