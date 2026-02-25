import { useConstruction, useToggleChecklist } from '@/shared/api';
import { statusColor } from '@/shared/lib/format';
import { HardHat, CheckSquare, Square, ChevronDown, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface Props {
  objectId: number;
}

const STAGE_STATUS_LABELS: Record<string, string> = {
  not_started: 'Не начат',
  in_progress: 'В работе',
  completed: 'Завершён',
  accepted: 'Принят ТН',
  rejected: 'Замечания',
};

export function ConstructionTab({ objectId }: Props) {
  const { data: stages, isLoading } = useConstruction(objectId);

  if (isLoading) return <ConstructionSkeleton />;
  if (!stages || stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-tg-hint">
        <HardHat size={36} className="mb-2 opacity-40" />
        <span className="text-sm">Этапы монтажа не созданы</span>
      </div>
    );
  }

  const completed = stages.filter((s) => s.status === 'accepted' || s.status === 'completed').length;
  const total = stages.length;
  const pct = total > 0 ? Math.round(completed / total * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-tg-text">Прогресс монтажа</span>
          <span className="text-xs font-medium text-status-blue">{completed}/{total} этапов</span>
        </div>
        <div className="h-2 bg-tg-hint/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-status-blue transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Stages */}
      {stages.map((stage) => (
        <StageCard key={stage.id} stage={stage} />
      ))}
    </div>
  );
}

function StageCard({ stage }: { stage: any }) {
  const [open, setOpen] = useState(stage.status === 'in_progress');
  const toggle = useToggleChecklist();

  const checkDone = stage.checklist?.filter((c: any) => c.is_done).length || 0;
  const checkTotal = stage.checklist?.length || 0;

  return (
    <div className="card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left touch-target"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-tg-text truncate">{stage.name}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-2xs text-tg-hint">
              <span className={`font-medium ${statusColor(stage.status)}`}>
                {STAGE_STATUS_LABELS[stage.status] || stage.status}
              </span>
              {checkTotal > 0 && (
                <>
                  <span>·</span>
                  <span>{checkDone}/{checkTotal} пунктов</span>
                </>
              )}
            </div>
          </div>
          {checkTotal > 0 && (
            <ChevronDown
              size={16}
              className={`text-tg-hint transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
            />
          )}
        </div>
      </button>

      {/* Checklist */}
      {open && stage.checklist && stage.checklist.length > 0 && (
        <div className="mt-3 pt-3 border-t border-tg-hint/10 space-y-1">
          {stage.checklist.map((item: any) => (
            <button
              key={item.id}
              onClick={() => toggle.mutate(item.id)}
              disabled={toggle.isPending}
              className="flex items-center gap-2.5 w-full text-left py-1.5 touch-target active:opacity-70"
            >
              {toggle.isPending ? (
                <Loader2 size={16} className="text-tg-hint animate-spin flex-shrink-0" />
              ) : item.is_done ? (
                <CheckSquare size={16} className="text-status-green flex-shrink-0" />
              ) : (
                <Square size={16} className="text-tg-hint flex-shrink-0" />
              )}
              <span className={`text-xs ${item.is_done ? 'text-tg-hint line-through' : 'text-tg-text'}`}>
                {item.title}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ConstructionSkeleton() {
  return (
    <div className="space-y-2">
      <div className="card h-16 skeleton" />
      {[1, 2, 3].map((i) => <div key={i} className="card h-24 skeleton" />)}
    </div>
  );
}
