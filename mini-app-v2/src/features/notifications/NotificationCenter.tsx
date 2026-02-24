import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useNotifications, useNotificationSummary,
  useMarkRead, useMarkAllRead, useNotificationAction,
} from '@/shared/api';
import {
  Bell, BellRing, CheckCheck, Filter, AlertTriangle,
  ChevronRight, Clock, Shield, Truck, FileSpreadsheet,
  ClipboardList, Zap, Settings, X, Loader2, Camera,
  MessageSquare, Building2, RefreshCw,
} from 'lucide-react';
import type {
  NotificationData, NotificationCategory, NotificationAction,
  NotificationPriority,
} from '@/shared/api/types';

/* ── Category definitions ──────────────────────────────── */

const CATEGORIES: { key: NotificationCategory | 'all'; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'Все', icon: <Bell size={14} /> },
  { key: 'tasks', label: 'Задачи', icon: <ClipboardList size={14} /> },
  { key: 'gpr', label: 'ГПР', icon: <FileSpreadsheet size={14} /> },
  { key: 'supply', label: 'Снабжение', icon: <Truck size={14} /> },
  { key: 'construction', label: 'Монтаж', icon: <Building2 size={14} /> },
  { key: 'escalation', label: 'Эскалации', icon: <AlertTriangle size={14} /> },
  { key: 'system', label: 'Система', icon: <Settings size={14} /> },
];

/* ── Priority config ───────────────────────────────────── */

const PRIORITY_CONFIG: Record<NotificationPriority, {
  border: string; bg: string; icon: string; pulse: boolean;
}> = {
  critical: { border: 'border-l-status-red', bg: 'bg-status-red/5', icon: '🔴', pulse: true },
  high: { border: 'border-l-status-yellow', bg: 'bg-status-yellow/5', icon: '⚠️', pulse: false },
  normal: { border: 'border-l-tg-button', bg: '', icon: '🔧', pulse: false },
  low: { border: 'border-l-tg-hint/30', bg: '', icon: '🚛', pulse: false },
};

/* ── Type → Icon mapping (from doc emoji spec) ─────────── */

const TYPE_ICONS: Partial<Record<string, { icon: string; color: string }>> = {
  task_assigned: { icon: '🔧', color: 'text-tg-button' },
  task_overdue: { icon: '🔴', color: 'text-status-red' },
  task_completed: { icon: '✅', color: 'text-status-green' },
  task_blocked: { icon: '⛔', color: 'text-status-red' },
  gpr_sign_request: { icon: '📋', color: 'text-status-yellow' },
  gpr_signed: { icon: '✍️', color: 'text-status-green' },
  gpr_all_signed: { icon: '🎉', color: 'text-status-green' },
  supply_delayed: { icon: '⚠️', color: 'text-status-yellow' },
  supply_shipped: { icon: '🚛', color: 'text-tg-hint' },
  supply_received: { icon: '📦', color: 'text-status-green' },
  stage_completed: { icon: '🏗', color: 'text-status-green' },
  stage_rejected: { icon: '❌', color: 'text-status-red' },
  escalation_l1: { icon: '⏰', color: 'text-status-yellow' },
  escalation_l2: { icon: '⚠️', color: 'text-status-yellow' },
  escalation_l3: { icon: '🔴', color: 'text-status-red' },
  defect_reported: { icon: '🔴', color: 'text-status-red' },
  defect_resolved: { icon: '✅', color: 'text-status-green' },
  plan_fact_request: { icon: '📊', color: 'text-tg-button' },
  plan_fact_overdue: { icon: '⏰', color: 'text-status-yellow' },
  kmd_issued: { icon: '📐', color: 'text-tg-button' },
  cascade_shift: { icon: '🔄', color: 'text-status-yellow' },
  object_status_change: { icon: '🏢', color: 'text-tg-button' },
  weekly_audit: { icon: '📋', color: 'text-tg-button' },
  general: { icon: 'ℹ️', color: 'text-tg-hint' },
};

/* ══════════════════════════════════════════════════════════ */

export function NotificationCenter() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<NotificationCategory | 'all'>('all');
  const [showActions, setShowActions] = useState<number | null>(null);

  const category = activeCategory === 'all' ? undefined : activeCategory;
  const { data: notifications, isLoading, refetch } = useNotifications({ category });
  const { data: summary } = useNotificationSummary();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();
  const execAction = useNotificationAction();

  // ── Telegram BackButton ──
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.BackButton?.show();
    const handler = () => navigate(-1);
    tg?.BackButton?.onClick(handler);
    return () => {
      tg?.BackButton?.offClick(handler);
      tg?.BackButton?.hide();
    };
  }, [navigate]);

  // ── Handle notification tap ──
  const handleTap = useCallback((notif: NotificationData) => {
    // Mark as read
    if (!notif.is_read) {
      markRead.mutate(notif.id);
    }

    // If has actions — expand inline actions
    if (notif.is_actionable && notif.actions.length > 0) {
      setShowActions(showActions === notif.id ? null : notif.id);
      window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
      return;
    }

    // Deep link navigation
    if (notif.deep_link) {
      navigate(notif.deep_link);
    } else if (notif.entity_type === 'object' && notif.object_id) {
      navigate(`/objects/${notif.object_id}`);
    } else if (notif.entity_type === 'task' && notif.entity_id) {
      navigate(`/objects/${notif.object_id}?tab=tasks&task=${notif.entity_id}`);
    }
  }, [showActions, markRead, navigate]);

  // ── Handle inline action ──
  const handleAction = useCallback(async (notif: NotificationData, action: NotificationAction) => {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');

    try {
      const result = await execAction.mutateAsync({
        notification_id: notif.id,
        action_key: action.key,
      });

      if (result.message) {
        window.Telegram?.WebApp?.showAlert(result.message);
      }

      setShowActions(null);
    } catch (err) {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('error');
    }
  }, [execAction]);

  // ── Group by time ──
  const grouped = groupByTime(notifications || []);

  return (
    <div className="pb-20">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-tg-text">Уведомления</h1>
          {summary && summary.total_unread > 0 && (
            <div className="text-2xs text-tg-hint mt-0.5">
              {summary.total_unread} непрочитанных
              {summary.critical_unread > 0 && (
                <span className="text-status-red font-medium">
                  {' '}· {summary.critical_unread} критических
                </span>
              )}
              {summary.escalations_active > 0 && (
                <span className="text-status-yellow font-medium">
                  {' '}· {summary.escalations_active} эскалаций
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {summary && summary.total_unread > 0 && (
            <button
              onClick={() => markAllRead.mutate(category)}
              disabled={markAllRead.isPending}
              className="flex items-center gap-1 text-xs text-tg-link px-2 py-1.5
                bg-tg-section-bg rounded-lg touch-target"
            >
              <CheckCheck size={14} />
              Прочесть всё
            </button>
          )}
          <button
            onClick={() => refetch()}
            className="p-2 text-tg-hint touch-target"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* ── Escalation Banner ──────────────────────────── */}
      {summary && summary.escalations_active > 0 && (
        <div className="mx-4 mb-2">
          <button
            onClick={() => setActiveCategory('escalation')}
            className="w-full card flex items-center gap-3 ring-1 ring-status-red/30
              bg-status-red/5 active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-full bg-status-red/20 flex items-center justify-center">
              <AlertTriangle size={20} className="text-status-red" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-status-red">
                Активные эскалации: {summary.escalations_active}
              </div>
              <div className="text-2xs text-tg-hint">
                Требуется немедленное вмешательство руководства
              </div>
            </div>
            <ChevronRight size={16} className="text-tg-hint" />
          </button>
        </div>
      )}

      {/* ── Pending Actions Counter ────────────────────── */}
      {summary && summary.pending_actions > 0 && activeCategory !== 'escalation' && (
        <div className="mx-4 mb-2">
          <div className="card flex items-center gap-3 ring-1 ring-tg-button/30 bg-tg-button/5">
            <div className="w-8 h-8 rounded-full bg-tg-button/20 flex items-center justify-center">
              <Zap size={16} className="text-tg-button" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-tg-text">
                {summary.pending_actions} действий ожидают ответа
              </div>
              <div className="text-2xs text-tg-hint">
                Подписания, подтверждения, проверки
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Category Tabs ──────────────────────────────── */}
      <div className="flex gap-1.5 px-4 overflow-x-auto no-scrollbar py-1">
        {CATEGORIES.map((cat) => {
          const count = cat.key === 'all'
            ? summary?.total_unread || 0
            : summary?.by_category?.[cat.key as NotificationCategory] || 0;

          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key as NotificationCategory | 'all')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs
                font-medium whitespace-nowrap flex-shrink-0 touch-target transition-colors
                ${activeCategory === cat.key
                  ? 'bg-tg-button text-tg-button-text'
                  : 'bg-tg-section-bg text-tg-hint'
                }`}
            >
              {cat.icon}
              {cat.label}
              {count > 0 && (
                <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-2xs
                  font-bold flex items-center justify-center
                  ${activeCategory === cat.key
                    ? 'bg-white/20 text-tg-button-text'
                    : cat.key === 'escalation'
                    ? 'bg-status-red text-white'
                    : 'bg-status-red/80 text-white'
                  }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Notification List ──────────────────────────── */}
      <div className="mt-2">
        {isLoading ? (
          <div className="px-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton h-20 rounded-card" />
            ))}
          </div>
        ) : (notifications || []).length === 0 ? (
          <EmptyState category={activeCategory} />
        ) : (
          Object.entries(grouped).map(([label, items]) => (
            <div key={label}>
              <div className="section-header">{label}</div>
              <div className="px-4 space-y-1.5">
                {items.map((notif) => (
                  <NotificationCard
                    key={notif.id}
                    notif={notif}
                    expanded={showActions === notif.id}
                    onTap={() => handleTap(notif)}
                    onAction={(action) => handleAction(notif, action)}
                    actionPending={execAction.isPending}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Notification Card — main rendering component
   ══════════════════════════════════════════════════════════ */

function NotificationCard({ notif, expanded, onTap, onAction, actionPending }: {
  notif: NotificationData;
  expanded: boolean;
  onTap: () => void;
  onAction: (action: NotificationAction) => void;
  actionPending: boolean;
}) {
  const prio = PRIORITY_CONFIG[notif.priority] || PRIORITY_CONFIG.normal;
  const typeIcon = TYPE_ICONS[notif.type] || TYPE_ICONS.general!;
  const isEscalation = notif.type.startsWith('escalation_');

  return (
    <div className={`rounded-card overflow-hidden transition-all
      ${prio.bg} ${!notif.is_read ? 'bg-tg-secondary-bg' : 'bg-tg-bg'}
      border-l-4 ${prio.border}`}
    >
      {/* Main card */}
      <button
        onClick={onTap}
        className="w-full text-left px-3 py-3 touch-target active:scale-[0.99] transition-transform"
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`text-lg flex-shrink-0 mt-0.5
            ${prio.pulse ? 'animate-pulse' : ''}`}>
            {typeIcon.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium leading-tight
                ${!notif.is_read ? 'text-tg-text' : 'text-tg-hint'}`}>
                {notif.title}
              </span>

              {/* Escalation level badge */}
              {isEscalation && notif.escalation_level && (
                <EscalationBadge level={notif.escalation_level} />
              )}
            </div>

            {notif.text && (
              <div className={`text-2xs mt-0.5 leading-snug line-clamp-2
                ${!notif.is_read ? 'text-tg-text/70' : 'text-tg-hint'}`}>
                {notif.text}
              </div>
            )}

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {notif.object_name && (
                <span className="text-2xs text-tg-hint bg-tg-section-bg px-1.5 py-0.5 rounded">
                  🏢 {notif.object_name}
                </span>
              )}

              <span className="text-2xs text-tg-hint flex items-center gap-0.5">
                <Clock size={10} />
                {formatTimeAgo(notif.created_at)}
              </span>

              {notif.triggered_by && (
                <span className="text-2xs text-tg-hint">
                  от {notif.triggered_by}
                </span>
              )}
            </div>

            {/* Action hint */}
            {notif.is_actionable && notif.actions.length > 0 && !expanded && (
              <div className="flex items-center gap-1 mt-1.5 text-2xs text-tg-link">
                <Zap size={10} />
                Требуется действие ({notif.actions.length})
              </div>
            )}
          </div>

          {/* Unread dot + chevron */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {!notif.is_read && (
              <div className="w-2.5 h-2.5 rounded-full bg-tg-button" />
            )}
            {(notif.deep_link || notif.entity_id) && !notif.is_actionable && (
              <ChevronRight size={14} className="text-tg-hint" />
            )}
          </div>
        </div>
      </button>

      {/* ── Expanded inline actions ───────────────────── */}
      {expanded && notif.actions.length > 0 && (
        <div className="px-3 pb-3 pt-1 border-t border-tg-hint/10">
          <div className="flex flex-wrap gap-2">
            {notif.actions.map((action) => (
              <button
                key={action.key}
                onClick={() => onAction(action)}
                disabled={actionPending}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl
                  text-xs font-semibold touch-target active:scale-95 transition-transform
                  disabled:opacity-50
                  ${ACTION_STYLES[action.style] || ACTION_STYLES.default}`}
              >
                {actionPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <span>{action.icon}</span>
                )}
                {action.label}
              </button>
            ))}
          </div>

          {/* Cascade shift detail */}
          {notif.type === 'cascade_shift' && (
            <div className="mt-2 text-2xs text-tg-hint bg-tg-section-bg rounded-lg px-3 py-2">
              <RefreshCw size={10} className="inline mr-1" />
              Система пересчитала каскадное влияние на ГПР.
              Затронутые отделы получат уведомления.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Action Button Styles ──────────────────────────────── */

const ACTION_STYLES: Record<string, string> = {
  primary: 'bg-tg-button text-tg-button-text',
  success: 'bg-status-green text-white',
  danger: 'bg-status-red/90 text-white',
  default: 'bg-tg-section-bg text-tg-text',
};

/* ── Escalation Badge ──────────────────────────────────── */

function EscalationBadge({ level }: { level: number }) {
  const config: Record<number, { label: string; bg: string }> = {
    1: { label: 'L1', bg: 'bg-status-yellow/20 text-status-yellow' },
    2: { label: 'L2', bg: 'bg-status-yellow text-white' },
    3: { label: 'L3', bg: 'bg-status-red text-white' },
  };
  const c = config[level] || config[1];

  return (
    <span className={`text-2xs font-bold px-1.5 py-0.5 rounded ${c.bg}`}>
      {c.label}
    </span>
  );
}

/* ── Empty State ───────────────────────────────────────── */

function EmptyState({ category }: { category: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
      <Bell size={40} className="text-tg-hint/30 mb-3" />
      <div className="text-sm font-medium text-tg-hint">Нет уведомлений</div>
      <div className="text-2xs text-tg-hint/60 mt-1">
        {category === 'escalation'
          ? 'Эскалаций нет — все процессы в норме'
          : 'Новые уведомления появятся здесь'}
      </div>
    </div>
  );
}

/* ── Time Grouping ─────────────────────────────────────── */

function groupByTime(items: NotificationData[]): Record<string, NotificationData[]> {
  const groups: Record<string, NotificationData[]> = {};
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();

  for (const item of items) {
    const d = new Date(item.created_at);
    const ds = d.toDateString();
    let label: string;

    if (ds === today) label = 'Сегодня';
    else if (ds === yesterday) label = 'Вчера';
    else label = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }

  return groups;
}

/* ── Time Formatting ───────────────────────────────────── */

function formatTimeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин.`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч.`;
  if (diff < 172800) return 'вчера';
  return `${Math.floor(diff / 86400)} дн.`;
}
