import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { ChevronDown, ChevronUp, Check, Loader2, Play, AlertTriangle } from 'lucide-react';

interface Props {
  objectId: number;
}

interface Step {
  id: number;
  step_number: number;
  name: string;
  status: string;
  status_emoji: string;
  assignee: string | null;
  planned_end: string | null;
  days_left: number | null;
  overdue: boolean;
  notes: string | null;
}

interface Phase {
  phase: string;
  label: string;
  steps: Step[];
  done: number;
  total: number;
  pct: number;
}

interface WorkflowData {
  instance: { id: number; status: string } | null;
  phases: Phase[];
  summary: { total_steps: number; done: number; pct: number } | null;
}

export function WorkflowTab({ objectId }: Props) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useQuery<WorkflowData>({
    queryKey: ['workflow', objectId],
    queryFn: () => api.get(`/api/workflow/instances/${objectId}`),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post(`/api/workflow/instances/${objectId}/create?template_id=1`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflow', objectId] }),
  });

  const updateStep = useMutation({
    mutationFn: ({ stepId, status }: { stepId: number; status: string }) =>
      api.patch(`/api/workflow/steps/${stepId}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflow', objectId] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-tg-hint" size={24} />
      </div>
    );
  }

  // No workflow yet
  if (!data?.instance) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <div className="text-4xl">🔄</div>
        <p className="text-sm text-tg-hint text-center">Workflow не создан для этого объекта</p>
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="px-6 py-3 rounded-2xl bg-tg-button text-tg-button-text text-sm font-medium
            active:opacity-80 disabled:opacity-50"
        >
          {createMutation.isPending ? 'Создаю...' : '🚀 Создать workflow'}
        </button>
      </div>
    );
  }

  const { phases, summary } = data;
  const toggle = (phase: string) =>
    setExpanded((prev) => ({ ...prev, [phase]: !prev[phase] }));

  return (
    <div className="space-y-3">
      {/* Summary */}
      {summary && (
        <div className="bg-tg-section-bg rounded-2xl px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-tg-text">Общий прогресс</span>
            <span className="text-sm font-bold text-tg-text">{summary.pct}%</span>
          </div>
          <div className="h-2 bg-tg-bg rounded-full overflow-hidden">
            <div
              className="h-full bg-tg-button rounded-full transition-all"
              style={{ width: `${summary.pct}%` }}
            />
          </div>
          <div className="text-2xs text-tg-hint mt-1">
            {summary.done} из {summary.total_steps} этапов выполнено
          </div>
        </div>
      )}

      {/* Phases */}
      {phases.map((phase) => {
        const isOpen = expanded[phase.phase] ?? false;
        const activeSteps = phase.steps.filter((s) => s.status === 'active' || s.status === 'in_progress');
        const overdueSteps = phase.steps.filter((s) => s.overdue);

        return (
          <div key={phase.phase} className="bg-tg-section-bg rounded-2xl overflow-hidden">
            <button
              onClick={() => toggle(phase.phase)}
              className="w-full flex items-center justify-between px-3 py-3 active:bg-tg-hint/5"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{phase.label}</span>
                {overdueSteps.length > 0 && (
                  <span className="flex items-center gap-0.5 text-2xs text-red-400">
                    <AlertTriangle size={10} /> {overdueSteps.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xs text-tg-hint">{phase.done}/{phase.total}</span>
                <div className="w-12 h-1.5 bg-tg-bg rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${phase.pct >= 100 ? 'bg-status-green' : 'bg-tg-button'}`}
                    style={{ width: `${phase.pct}%` }}
                  />
                </div>
                {isOpen ? <ChevronUp size={14} className="text-tg-hint" /> : <ChevronDown size={14} className="text-tg-hint" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-tg-hint/10 divide-y divide-tg-hint/5">
                {phase.steps.map((step) => (
                  <div key={step.id} className="px-3 py-2.5 flex items-center gap-2">
                    <span className="text-xs flex-shrink-0">{step.status_emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-tg-text truncate">{step.name}</div>
                      {step.assignee && (
                        <div className="text-2xs text-tg-hint">{step.assignee}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {step.days_left !== null && step.status !== 'done' && (
                        <span className={`text-2xs font-mono ${
                          step.overdue ? 'text-red-400' :
                          step.days_left <= 2 ? 'text-yellow-400' : 'text-tg-hint'
                        }`}>
                          {step.overdue ? `−${Math.abs(step.days_left)}д` : `${step.days_left}д`}
                        </span>
                      )}
                      {(step.status === 'active' || step.status === 'in_progress') && (
                        <button
                          onClick={() => updateStep.mutate({ stepId: step.id, status: 'done' })}
                          disabled={updateStep.isPending}
                          className="p-1.5 rounded-lg bg-status-green/10 active:bg-status-green/20"
                        >
                          <Check size={12} className="text-status-green" />
                        </button>
                      )}
                      {step.status === 'pending' && (
                        <button
                          onClick={() => updateStep.mutate({ stepId: step.id, status: 'active' })}
                          disabled={updateStep.isPending}
                          className="p-1.5 rounded-lg bg-tg-button/10 active:bg-tg-button/20"
                        >
                          <Play size={12} className="text-tg-button" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
