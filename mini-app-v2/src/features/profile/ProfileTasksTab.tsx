import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfileTasks, useProfileApprovals } from '@/shared/api';
import {
  TASK_STATUS_LABELS, TASK_STATUS_COLORS, formatDateShort, daysUntil,
} from '@/shared/lib/format';
import {
  AlertCircle, Clock, Building2, FileSignature,
  CheckCircle2, Package, HardHat, ChevronRight,
} from 'lucide-react';
import type { ProfileTask, ProfileApproval, TaskStatus } from '@/shared/api/types';

type TaskFilter = 'all' | 'overdue' | 'today' | 'upcoming';

export function ProfileTasksTab() {
  const { data: tasks, isLoading: tasksLoading } = useProfileTasks();
  const { data: approvals, isLoading: approvalsLoading } = useProfileApprovals();
  const [filter, setFilter] = useState<TaskFilter>('all');
  const navigate = useNavigate();

  const isLoading = tasksLoading || approvalsLoading;
  if (isLoading) return <TasksTabSkeleton />;

  // ── Sort: overdue → today → this week → later ──
  const sortedTasks = [...(tasks || [])].sort((a, b) => {
    const aDays = a.days_left ?? 999;
    const bDays = b.days_left ?? 999;
    if (aDays < 0 && bDays >= 0) return -1;
    if (bDays < 0 && aDays >= 0) return 1;
    return aDays - bDays;
  });

  // ── Filter ──
  const filtered = sortedTasks.filter((t) => {
    if (filter === 'overdue') return (t.days_left ?? 999) < 0 && t.status !== 'done';
    if (filter === 'today') return t.days_left === 0;
    if (filter === 'upcoming') return (t.days_left ?? 0) > 0 && (t.days_left ?? 0) <= 7;
    return true;
  });

  // ── Counts ──
  const overdueCount = sortedTasks.filter((t) => (t.days_left ?? 999) < 0 && t.status !== 'done').length;
  const todayCount = sortedTasks.filter((t) => t.days_left === 0).length;
  const weekCount = sortedTasks.filter((t) => (t.days_left ?? 0) > 0 && (t.days_left ?? 0) <= 7).length;

  return (
    <div className="space-y-2">

      {/* ── Pending Approvals ─────────────────────────── */}
      {(approvals?.length ?? 0) > 0 && (
        <>
          <div className="section-header">
            На согласовании
            <span className="ml-1 min-w-[16px] h-4 px-1 text-2xs font-bold
              bg-status-red text-white rounded-full inline-flex items-center justify-center">
              {approvals!.length}
            </span>
          </div>
          <div className="mx-4 space-y-1.5">
            {approvals!.map((a) => (
              <ApprovalCard key={`${a.type}-${a.id}`} approval={a} />
            ))}
          </div>
        </>
      )}

      {/* ── Task Filters ─────────────────────────────── */}
      <div className="section-header mt-2">Мои задачи</div>
      <div className="flex gap-1.5 px-4 overflow-x-auto scrollbar-hide">
        <FilterChip
          label={`Все (${sortedTasks.length})`}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <FilterChip
          label={`Просрочено (${overdueCount})`}
          active={filter === 'overdue'}
          onClick={() => setFilter('overdue')}
          variant={overdueCount > 0 ? 'danger' : undefined}
        />
        <FilterChip
          label={`Сегодня (${todayCount})`}
          active={filter === 'today'}
          onClick={() => setFilter('today')}
          variant={todayCount > 0 ? 'warning' : undefined}
        />
        <FilterChip
          label={`Неделя (${weekCount})`}
          active={filter === 'upcoming'}
          onClick={() => setFilter('upcoming')}
        />
      </div>

      {/* ── Task List ─────────────────────────────────── */}
      <div className="mx-4 space-y-1.5">
        {filtered.map((task) => (
          <TaskRow key={task.id} task={task} onTap={() => navigate(`/objects/0/tasks`)} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-tg-hint py-8">
          {filter === 'all' ? 'Нет назначенных задач' : 'Нет задач с данным фильтром'}
        </div>
      )}
    </div>
  );
}

/* ── Task Row ──────────────────────────────────────────── */

function TaskRow({ task, onTap }: { task: ProfileTask; onTap: () => void }) {
  const isOverdue = (task.days_left ?? 999) < 0 && task.status !== 'done';
  const isDone = task.status === 'done';

  return (
    <button
      onClick={onTap}
      className="card w-full text-left active:scale-[0.98] transition-transform touch-target"
    >
      <div className="flex items-start gap-3">
        {/* Priority indicator */}
        <div className={`w-1 self-stretch rounded-full flex-shrink-0
          ${isOverdue ? 'bg-status-red'
            : task.priority >= 2 ? 'bg-status-red'
            : task.priority === 1 ? 'bg-status-yellow'
            : 'bg-tg-hint/20'}`}
        />

        <div className="flex-1 min-w-0">
          {/* Title + status */}
          <div className="flex items-start justify-between gap-2">
            <h4 className={`text-sm font-medium truncate
              ${isDone ? 'text-tg-hint line-through' : 'text-tg-text'}`}>
              {task.title}
            </h4>
            <span className={`flex-shrink-0 ${TASK_STATUS_COLORS[task.status]}`}>
              {TASK_STATUS_LABELS[task.status]}
            </span>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-2 mt-1.5 text-2xs text-tg-hint">
            <span className="flex items-center gap-0.5">
              <Building2 size={10} /> {task.object_name}
            </span>
            <span>·</span>
            <span>{task.department_name}</span>
          </div>

          {/* Deadline */}
          {task.deadline && (
            <div className={`flex items-center gap-1 mt-1 text-2xs
              ${isOverdue ? 'text-status-red font-medium' : 'text-tg-hint'}`}>
              <Clock size={10} />
              {formatDateShort(task.deadline)}
              {task.days_left !== null && (
                <span className="ml-1">
                  {task.days_left < 0
                    ? `(${Math.abs(task.days_left)} дн. назад)`
                    : task.days_left === 0
                    ? '(сегодня)'
                    : `(через ${task.days_left} дн.)`}
                </span>
              )}
            </div>
          )}
        </div>

        <ChevronRight size={16} className="text-tg-hint flex-shrink-0 mt-1" />
      </div>
    </button>
  );
}

/* ── Approval Card ─────────────────────────────────────── */

const APPROVAL_TYPE_CONFIG: Record<string, { icon: typeof FileSignature; label: string; color: string }> = {
  gpr_sign: { icon: FileSignature, label: 'Подписание ГПР', color: 'text-status-blue' },
  task_review: { icon: CheckCircle2, label: 'Проверка задачи', color: 'text-status-yellow' },
  supply_approve: { icon: Package, label: 'Одобрение заявки', color: 'text-status-green' },
  stage_accept: { icon: HardHat, label: 'Приёмка работ', color: 'text-status-yellow' },
};

function ApprovalCard({ approval }: { approval: ProfileApproval }) {
  const cfg = APPROVAL_TYPE_CONFIG[approval.type] || {
    icon: AlertCircle, label: approval.type, color: 'text-tg-hint',
  };
  const Icon = cfg.icon;

  return (
    <div className="card border-l-2 border-status-yellow">
      <div className="flex items-start gap-3">
        <Icon size={18} className={`${cfg.color} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="text-2xs text-tg-hint">{cfg.label}</div>
          <h4 className="text-sm font-medium text-tg-text truncate">{approval.title}</h4>
          <div className="flex items-center gap-2 mt-1 text-2xs text-tg-hint">
            <span className="flex items-center gap-0.5">
              <Building2 size={10} /> {approval.object_name}
            </span>
            <span>·</span>
            <span>от {approval.requested_by}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Filter Chip ───────────────────────────────────────── */

function FilterChip({ label, active, onClick, variant }: {
  label: string;
  active: boolean;
  onClick: () => void;
  variant?: 'danger' | 'warning';
}) {
  const baseClass = active
    ? 'bg-tg-button text-tg-button-text'
    : variant === 'danger' ? 'bg-status-red/10 text-status-red'
    : variant === 'warning' ? 'bg-status-yellow/10 text-status-yellow'
    : 'bg-tg-section-bg text-tg-hint';

  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1.5 rounded-full whitespace-nowrap transition-colors touch-target ${baseClass}`}
    >
      {label}
    </button>
  );
}

/* ── Skeleton ──────────────────────────────────────────── */

function TasksTabSkeleton() {
  return (
    <div className="px-4 space-y-2">
      <div className="skeleton h-16 rounded-card" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-8 w-24 rounded-full" />)}
      </div>
      {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-20 rounded-card" />)}
    </div>
  );
}
