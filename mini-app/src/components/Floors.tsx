import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import PhotoUpload from "@/components/PhotoUpload";
import { useXP } from "@/hooks/useXP";
import XpToast from "@/components/XpToast";

interface FloorsProps {
  projectId: string;
}

const cellCfg: Record<string, { bg: string; text: string; border: string }> = {
  done:        { bg: "bg-primary/12",       text: "text-primary",     border: "border-primary/25" },
  in_progress: { bg: "bg-warning/10",       text: "text-warning",     border: "border-warning/25" },
  pending:     { bg: "bg-foreground/[0.03]", text: "text-[hsl(var(--t3))]", border: "border-transparent" },
  blocked:     { bg: "bg-destructive/10",    text: "text-destructive", border: "border-destructive/20" },
};

const Floors = ({ projectId }: FloorsProps) => {
  const [facades, setFacades] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const { award, lastXp, clearXp } = useXP(projectId);

  useEffect(() => {
    (async () => {
      const { data: facData } = await supabase
        .from("facades").select("*").eq("project_id", projectId).order("name");
      setFacades(facData || []);
      if (facData?.length) {
        const ids = facData.map(f => f.id);
        const { data: flData } = await supabase
          .from("floors").select("*").in("facade_id", ids).order("floor_number", { ascending: false });
        setFloors(flData || []);
      }
      setLoading(false);
    })();
  }, [projectId]);

  if (loading) {
    return (
      <div className="p-4 animate-fade-in">
        <div className="skeleton h-[300px] rounded-lg" />
      </div>
    );
  }

  if (facades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
        <div className="text-3xl mb-2 opacity-30">⊟</div>
        <p className="text-[hsl(var(--t2))] font-semibold text-sm">Нет фасадов</p>
        <p className="text-[hsl(var(--t3))] text-xs mt-1">Добавьте фасады и этажи для этого проекта</p>
      </div>
    );
  }

  const floorNumbers = [...new Set(floors.map(f => f.floor_number))].sort((a, b) => b - a);
  const selectedFloorNum = selectedFloor ?? (floorNumbers[0] || 1);
  const getFloor = (num: number, fid: string) => floors.find(f => f.floor_number === num && f.facade_id === fid);
  const selectedFloorDetails = floors.filter(f => f.floor_number === selectedFloorNum);

  const doneCount   = floors.filter(f => f.status === "done").length;
  const activeCount = floors.filter(f => f.status === "in_progress").length;
  const totalCount  = floors.length;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {lastXp && <XpToast xp={lastXp.xp} action={lastXp.action} onDone={clearXp} />}

      {/* Сводка */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Готово",    value: doneCount,   color: "hsl(158 88% 40%)" },
          { label: "В работе",  value: activeCount, color: "hsl(34 94% 56%)" },
          { label: "Всего эт.", value: totalCount,  color: "hsl(220 8% 52%)" },
        ].map(s => (
          <div key={s.label} className="bg-[hsl(var(--bg1))] border border-border rounded-lg p-3 text-center">
            <div className="num text-xl font-bold" style={{ color: s.color }}>
              {s.value}
            </div>
            <p className="text-[10px] text-[hsl(var(--t3))] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Матрица */}
      <div className="bg-[hsl(var(--bg1))] border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[hsl(var(--t3))]">Матрица этажей</span>
          <span className="num text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            {facades.length} фасадов
          </span>
        </div>

        {/* Легенда */}
        <div className="flex gap-3 mb-3 flex-wrap">
          {[
            { cls: "bg-primary",       label: "Готово" },
            { cls: "bg-warning",       label: "В работе" },
            { cls: "bg-foreground/10", label: "Не начат" },
            { cls: "bg-destructive",   label: "Проблема" },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1 text-[9px] text-[hsl(var(--t2))]">
              <div className={`w-[7px] h-[7px] rounded-sm ${l.cls}`} />
              {l.label}
            </div>
          ))}
        </div>

        {/* Заголовок колонок */}
        <div
          className="grid gap-0.5 text-[8px] num font-semibold text-[hsl(var(--t3))] mb-1"
          style={{ gridTemplateColumns: `28px repeat(${facades.length}, 1fr)` }}
        >
          <div />
          {facades.map(f => (
            <div key={f.id} className="text-center">{f.code || f.name.slice(0, 3)}</div>
          ))}
        </div>

        {/* Строки */}
        {floorNumbers.map(num => (
          <div
            key={num}
            className="mb-0.5"
            style={{ display: "grid", gridTemplateColumns: `28px repeat(${facades.length}, 1fr)`, gap: "2px" }}
          >
            <div className="num font-semibold text-[hsl(var(--t3))] text-[8px] flex items-center justify-center">
              {num}
            </div>
            {facades.map(facade => {
              const fl = getFloor(num, facade.id);
              const status = fl?.status || "pending";
              const pct = fl?.modules_plan > 0
                ? Math.round((fl.modules_fact / fl.modules_plan) * 100) : 0;
              const cfg = cellCfg[status] || cellCfg.pending;
              const isSelected = selectedFloorNum === num;
              return (
                <button
                  key={facade.id}
                  onClick={() => setSelectedFloor(num)}
                  className={`
                    h-6 rounded-sm flex items-center justify-center
                    num text-[8px] font-semibold transition-all duration-150 border
                    ${cfg.bg} ${cfg.text} ${cfg.border}
                    ${isSelected ? "ring-1 ring-white/20" : ""}
                    hover:brightness-125
                  `}
                >
                  {pct > 0 ? `${pct}%` : "—"}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Детализация этажа */}
      <div className="bg-[hsl(var(--bg1))] border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[hsl(var(--t3))]">
            Детализация
          </span>
          <span className="num text-[9px] px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">
            Этаж {selectedFloorNum}
          </span>
        </div>

        {selectedFloorDetails.length === 0 ? (
          <div className="text-[10px] text-[hsl(var(--t3))] text-center py-4">
            Нет данных для этажа {selectedFloorNum}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr>
                  {["Фасад", "Мод П", "Мод Ф", "Кр П", "Кр Ф", "%"].map(h => (
                    <th key={h} className="text-left text-[8px] font-bold uppercase tracking-wide text-[hsl(var(--t3))] p-1.5 border-b border-border">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedFloorDetails.map(fl => {
                  const facade = facades.find(f => f.id === fl.facade_id);
                  const pct = fl.modules_plan > 0
                    ? Math.round((fl.modules_fact / fl.modules_plan) * 100) : 0;
                  const color = pct >= 100
                    ? "hsl(158 88% 40%)"
                    : pct > 0
                    ? "hsl(34 94% 56%)"
                    : "hsl(220 8% 36%)";
                  return (
                    <tr key={fl.id} className="border-b border-border last:border-b-0">
                      <td className="p-2 font-semibold">{facade?.name || "—"}</td>
                      <td className="p-2 num text-center">{fl.modules_plan}</td>
                      <td className="p-2 num text-center font-semibold" style={{ color }}>{fl.modules_fact}</td>
                      <td className="p-2 num text-center">{fl.brackets_plan}</td>
                      <td className="p-2 num text-center font-semibold" style={{ color }}>{fl.brackets_fact}</td>
                      <td className="p-2 num text-center font-bold" style={{ color }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Фото */}
        {selectedFloorDetails.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[hsl(var(--t3))] mb-2">
              Фото — этаж {selectedFloorNum}
            </p>
            {selectedFloorDetails.map(fl => (
              <PhotoUpload
                key={fl.id}
                photos={(fl as any).photo_urls || []}
                onPhotosChange={async (urls) => {
                  await supabase.from("floors").update({ photo_urls: urls }).eq("id", fl.id);
                  setFloors(prev => prev.map(f => f.id === fl.id ? { ...f, photo_urls: urls } : f));
                }}
                onUploadComplete={(count) => {
                  for (let i = 0; i < count; i++) award("photo_upload", { source: "floors", floor_id: fl.id });
                }}
                folder={`floors/${fl.id}`}
                maxPhotos={5}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Floors;
