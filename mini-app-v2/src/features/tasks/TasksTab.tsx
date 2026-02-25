import { useState } from 'react';
import { useObjectTasks, useUpdateTaskStatus } from '@/shared/api';
import {
  formatDateShort, daysUntil,
  TASK_STATUS_LABELS, TASK_STATUS_COLORS,
  DEPARTMENT_LABELS, PRIORITY_LABELS,
} from '@/shared/lib/format';
import { useAppStore } from '@/shared/hooks/useAppStore';
import { Filter, AlertCircle, Clock, User, ChevronRight } from 'lucide-react';
import type { TaskData, TaskStatus, Department } from '@/shared/api/types';

interface Props {
  objectId: number;
}

export function TasksTab({ objectId }: Props) {
  const [filterDept, setFilterDept] = useState<Department | ''>('');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | ''>('');
  const { data: tasks, isLoading } = useObjectTasks(objectId, filterDept || undefined);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);

  if (isLoading) return <TasksSkeleton />;

  const filtered = tasks?.filter((t) =>
    !filterStatus || t.status === filterStatus
  ) ?? [];

  const statusCounts = tasks?.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  return (
    <div className="px-4 space-y-3">
      {/* Status filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <Filter size={14} className="text-tg-hint flex-shrink-0" />
        <button
          onClick={() => setFilterStatus('')}
          className={`text-xs px-2.5 py-1.5 rounded-full whitespace-nowrap transition-colors
            ${!filterStatus ? 'bg-tg-button text-tg-button-text' : 'bg-tg-section-bg text-tg-hint'}`}
        >
          Все ({tasks?.length || 0})
        </button>
        {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => {
          const count = statusCounts[key] || 0;
          if (count === 0) return null;
          return (
            <button
              key={key}
              onClick={() => setFilterStatus(key === filterStatus ? '' : key as TaskStatus)}
              className={`text-xs px-2.5 py-1.5 rounded-full whitespace-nowrap transition-colors
                ${key === filterStatus ? 'bg-tg-button text-tg-button-text' : 'bg-tg-section-bg text-tg-hint'}`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Department filter */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setFilterDept('')}
          className={`text-xs px-2.5 py-1.5 rounded-full whitespace-nowrap transition-colors
            ${!filterDept ? 'bg-tg-accent/20 text-tg-accent' : 'bg-tg-section-bg text-tg-hint'}`}
        >
          Все отделы
        </button>
        {Object.entries(DEPARTMENT_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilterDept(key === filterDept ? '' : key as Department)}
            className={`text-xs px-2.5 py-1.5 rounded-full whitespace-nowrap transition-colors
              ${key === filterDept ? 'bg-tg-accent/20 text-tg-accent' : 'bg-tg-section-bg text-tg-hint'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-2">
        {filtered.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            expanded={expandedTask === task.id}
            onToggle={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-tg-hint py-8">Задач не найдено</div>
      )}
    </div>
  );
}

function TaskCard({ task, expanded, onToggle }: {
  task: TaskData;
  expanded: boolean;
  onToggle: () => void;
}) {
  const updateStatus = useUpdateTaskStatus();
  const days = daysUntil(task.deadline);
  const isOverdue = task.status === 'overdue' || (days !== null && days < 0 && task.status !== 'done');

  return (
    <div className="card">
      <button onClick={onToggle} className="w-full text-left touch-target">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {task.priority > 0 && (
                <AlertCircle size={14} className={task.priority >= 2 ? 'text-status-red' : 'text-status-yellow'} />
              )}
              <h4 className="text-sm font-medium text-tg-text truncate">{task.title}</h4>
            </div>
            <div className="flex items-center gap-2 mt-1 text-2xs text-tg-hint">
              <span>{DEPARTMENT_LABELS[task.department] || task.department}</span>
              {task.assignee && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-0.5">
                    <User size={10} /> {task.assignee}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={TASK_STATUS_COLORS[task.status]}>
              {TASK_STATUS_LABELS[task.status]}
            </span>
            {task.deadline && (
              <span className={`text-2xs flex items-center gap-0.5 ${isOverdue ? 'text-status-red' : 'text-tg-hint'}`}>
                <Clock size={10} />
                {formatDateShort(task.deadline)}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Expanded: quick actions */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-tg-hint/10">
          <div className="flex flex-wrap gap-2">
            {getNextStatuses(task.status).map((nextStatus) => (
              <button
                key={nextStatus}
                onClick={() => updateStatus.mutate({ taskId: task.id, status: nextStatus })}
                disabled={updateStatus.isPending}
                className="text-xs px-3 py-1.5 bg-tg-button/10 text-tg-button rounded-lg transition-colors active:bg-tg-button/20 touch-target"
              >
                → {TASK_STATUS_LABELS[nextStatus]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** State machine: allowed transitions */
function getNextStatuses(current: TaskStatus): TaskStatus[] {
  const transitions: Record<TaskStatus, TaskStatus[]> = {
    new: ['assigned', 'in_progress'],
    assigned: ['in_progress', 'blocked'],
    in_progress: ['review', 'blocked', 'done'],
    review: ['done', 'in_progress'],
    blocked: ['in_progress'],
    done: [],
    overdue: ['in_progress', 'done'],
  };
  return transitions[current] || [];
}

function TasksSkeleton() {
  return (
    <div className="px-4 space-y-2">
      {[1, 2, 3, 4, 5].map((i) => <div key={i} className="card h-20 skeleton" />)}
    </div>
  );
}
