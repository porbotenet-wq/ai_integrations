import { useState } from "react";
import { WORKFLOW, STAGES, STAGE_COLORS } from "@/data/workflowData";

const Workflow = () => {
  const [activeStage, setActiveStage] = useState<string | null>(null);

  const filtered = activeStage
    ? WORKFLOW.filter(w => w.stage === activeStage)
    : WORKFLOW;

  const grouped = filtered.reduce<Record<string, typeof WORKFLOW>>((acc, step) => {
    if (!acc[step.stage]) acc[step.stage] = [];
    acc[step.stage].push(step);
    return acc;
  }, {});

  return (
    <div className="px-2.5 py-2">
      <div className="text-[9px] font-bold uppercase tracking-wider text-t3 mb-2">
        Логика взаимодействия отделов
      </div>

      {/* Stage filter chips */}
      <div className="flex gap-1 mb-3 overflow-x-auto scrollbar-none pb-1">
        <button
          onClick={() => setActiveStage(null)}
          className={`flex-shrink-0 px-2.5 py-1 rounded-md text-[9px] font-bold transition-all border whitespace-nowrap ${
            activeStage === null
              ? "text-primary bg-primary/12 border-primary/25"
              : "text-t2 border-border hover:text-t1 hover:bg-bg2"
          }`}
        >
          Все
        </button>
        {STAGES.map(stage => {
          const color = STAGE_COLORS[stage] || '#888';
          const isActive = activeStage === stage;
          return (
            <button
              key={stage}
              onClick={() => setActiveStage(isActive ? null : stage)}
              className="flex-shrink-0 px-2.5 py-1 rounded-md text-[9px] font-bold transition-all border whitespace-nowrap"
              style={{
                color: isActive ? color : undefined,
                backgroundColor: isActive ? `${color}18` : undefined,
                borderColor: isActive ? `${color}40` : 'hsl(var(--border))',
              }}
            >
              {stage}
            </button>
          );
        })}
      </div>

      {/* Workflow cards grouped by stage */}
      {Object.entries(grouped).map(([stage, steps]) => (
        <div key={stage} className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: STAGE_COLORS[stage] }}
            />
            <span className="text-[9px] font-bold uppercase tracking-wider text-t3">
              {stage}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {steps.map((step, idx) => (
            <div
              key={`${stage}-${idx}`}
              className="bg-bg1 border border-border rounded-lg p-3 mb-1.5"
              style={{ borderLeftColor: STAGE_COLORS[stage], borderLeftWidth: 3 }}
            >
              <div className="flex justify-between items-start gap-2 mb-1.5">
                <div className="text-[11px] font-bold text-foreground">{step.sub}</div>
                <span
                  className="text-[7px] font-mono font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{
                    color: STAGE_COLORS[stage],
                    backgroundColor: `${STAGE_COLORS[stage]}18`,
                  }}
                >
                  {step.deadline}
                </span>
              </div>

              <p className="text-[10px] text-t2 leading-relaxed mb-2">{step.action}</p>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[8px]">
                <div>
                  <span className="text-t3 font-semibold">От: </span>
                  <span className="text-t1 font-medium">{step.from}</span>
                </div>
                <div>
                  <span className="text-t3 font-semibold">Кому: </span>
                  <span className="text-t1 font-medium">{step.to}</span>
                </div>
                {step.doc && step.doc !== '-' && (
                  <div>
                    <span className="text-t3 font-semibold">📄 </span>
                    <span className="text-t2">{step.doc}</span>
                  </div>
                )}
                {step.trigger && (
                  <div>
                    <span className="text-t3 font-semibold">⚡ </span>
                    <span className="text-primary/80">{step.trigger}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default Workflow;
