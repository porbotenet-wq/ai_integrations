import { useProfileActivity } from '@/shared/api';
import { formatDateTime } from '@/shared/lib/format';
import {
  CheckCircle2, Edit3, PlusCircle, Trash2, FileSignature,
  Eye, Upload, RefreshCw, AlertTriangle, MessageSquare,
} from 'lucide-react';
import type { ActivityLogEntry } from '@/shared/api/types';

const ACTION_CONFIG: Record<string, { icon: typeof Edit3; color: string; label: string }> = {
  'task.create': { icon: PlusCircle, color: 'text-status-green', label: 'Создал задачу' },
  'task.status_change': { icon: RefreshCw, color: 'text-status-blue', label: 'Сменил статус' },
  'task.complete': { icon: CheckCircle2, color: 'text-status-green', label: 'Завершил задачу' },
  'task.comment': { icon: MessageSquare, color: 'text-tg-hint', label: 'Комментарий' },
  'gpr.sign': { icon: FileSignature, color: 'text-status-blue', label: 'Подписал ГПР' },
  'gpr.create': { icon: PlusCircle, color: 'text-status-green', label: 'Создал ГПР' },
  'gpr.edit': { icon: Edit3, color: 'text-status-yellow', label: 'Изменил ГПР' },
  'checklist.toggle': { icon: CheckCircle2, color: 'text-status-green', label: 'Чек-лист' },
  'document.upload': { icon: Upload, color: 'text-status-blue', label: 'Загрузил документ' },
  'document.approve': { icon: FileSignature, color: 'text-status-green', label: 'Согласовал документ' },
  'supply.create': { icon: PlusCircle, color: 'text-status-blue', label: 'Создал заявку' },
  'supply.approve': { icon: CheckCircle2, color: 'text-status-green', label: 'Одобрил заявку' },
  'stage.update': { icon: RefreshCw, color: 'text-status-yellow', label: 'Обновил этап' },
  'stage.accept': { icon: CheckCircle2, color: 'text-status-green', label: 'Принял работы' },
  'stage.reject': { icon: AlertTriangle, color: 'text-status-red', label: 'Отклонил работы' },
  'user.role_change': { icon: Edit3, color: 'text-status-yellow', label: 'Сменил роль' },
  'object.create': { icon: PlusCircle, color: 'text-status-green', label: 'Создал объект' },
  'object.edit': { icon: Edit3, color: 'text-status-yellow', label: 'Изменил объект' },
};

export function ProfileActivityTab() {
  const { data: activity, isLoading } = useProfileActivity(50);

  if (isLoading) return <ActivitySkeleton />;
  if (!activity || activity.length === 0) {
    return (
      <div className="text-center text-tg-hint py-12">
        <Eye size={32} className="mx-auto mb-2 opacity-30" />
        <p>История действий пуста</p>
      </div>
    );
  }

  // ── Group by date ──
  const grouped = groupByDate(activity);

  return (
    <div className="space-y-4 px-4">
      {grouped.map(([dateLabel, entries]) => (
        <div key={dateLabel}>
          <div className="text-xs font-semibold text-tg-section-header uppercase tracking-wider mb-2">
            {dateLabel}
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[11px] top-3 bottom-3 w-px bg-tg-hint/10" />

            <div className="space-y-0">
              {entries.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Activity Row (timeline style) ─────────────────────── */

function ActivityRow({ entry }: { entry: ActivityLogEntry }) {
  const cfg = ACTION_CONFIG[entry.action] || {
    icon: Eye, color: 'text-tg-hint', label: entry.action_label || entry.action,
  };
  const Icon = cfg.icon;

  // Time from ISO
  const time = entry.created_at
    ? new Date(entry.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="flex gap-3 py-2 relative">
      {/* Timeline dot */}
      <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center
        flex-shrink-0 z-10 bg-tg-bg`}>
        <Icon size={14} className={cfg.color} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-sm text-tg-text">
              {cfg.label}
            </span>
            {entry.entity_title && (
              <span className="text-sm text-tg-hint ml-1">
                — {entry.entity_title}
              </span>
            )}
          </div>
          <span className="text-2xs text-tg-hint flex-shrink-0">{time}</span>
        </div>

        {/* Status change detail */}
        {entry.old_value && entry.new_value && (
          <div className="flex items-center gap-1.5 mt-1 text-2xs">
            <span className="px-1.5 py-0.5 bg-tg-hint/10 text-tg-hint rounded">
              {parseValue(entry.old_value)}
            </span>
            <span className="text-tg-hint">→</span>
            <span className="px-1.5 py-0.5 bg-status-blue/10 text-status-blue rounded">
              {parseValue(entry.new_value)}
            </span>
          </div>
        )}

        {/* Entity type badge */}
        <div className="mt-1">
          <span className="text-2xs text-tg-hint">
            {entityLabel(entry.entity_type)} #{entry.entity_id}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────── */

function groupByDate(entries: ActivityLogEntry[]): [string, ActivityLogEntry[]][] {
  const groups: Record<string, ActivityLogEntry[]> = {};

  for (const entry of entries) {
    const d = new Date(entry.created_at);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let label: string;
    if (d.toDateString() === today.toDateString()) {
      label = 'Сегодня';
    } else if (d.toDateString() === yesterday.toDateString()) {
      label = 'Вчера';
    } else {
      label = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    if (!groups[label]) groups[label] = [];
    groups[label].push(entry);
  }

  return Object.entries(groups);
}

function parseValue(val: string): string {
  try {
    const obj = JSON.parse(val);
    if (obj.status) return obj.status;
    if (obj.signed) return 'подписано';
    return val;
  } catch {
    return val;
  }
}

function entityLabel(type: string | null): string {
  const map: Record<string, string> = {
    task: 'Задача',
    gpr: 'ГПР',
    checklist_item: 'Чек-лист',
    document: 'Документ',
    supply_order: 'Заявка',
    construction_stage: 'Этап',
    object: 'Объект',
    user: 'Пользователь',
  };
  return map[type || ''] || type || '';
}

/* ── Skeleton ──────────────────────────────────────────── */

function ActivitySkeleton() {
  return (
    <div className="px-4 space-y-4">
      <div className="skeleton h-4 w-24 rounded" />
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="skeleton w-6 h-6 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="skeleton h-4 w-3/4 rounded" />
            <div className="skeleton h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
