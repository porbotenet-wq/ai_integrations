import { useNavigate } from 'react-router-dom';
import { useDashboard, useProfile, useNotificationSummary } from '@/shared/api';
import { formatDateShort, daysUntil, OBJECT_STATUS_LABELS } from '@/shared/lib/format';
import type { ProductionKPI } from '@/shared/api/types';
import {
  Building2, CheckCircle2, AlertTriangle, Clock, Truck, Plus, Bell,
  Layers, Wrench, TrendingUp,
} from 'lucide-react';

export function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useDashboard();
  const { data: profile } = useProfile();
  const { data: notifSummary } = useNotificationSummary();

  const canCreate = profile?.permissions?.includes('object.create');

  if (isLoading) return <DashboardSkeleton />;
  if (error || !data) return <ErrorState message="Не удалось загрузить данные" />;

  return (
    <div className="pb-20">
      {/* Header with notification bell */}
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <h1 className="text-lg font-bold text-tg-text">Объекты</h1>
        <button
          onClick={() => navigate('/notifications')}
          className="relative p-2 text-tg-hint touch-target"
        >
          <Bell size={22} />
          {notifSummary && notifSummary.total_unread > 0 && (
            <span className={`absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] px-1
              rounded-full text-2xs font-bold flex items-center justify-center text-white
              ${notifSummary.critical_unread > 0
                ? 'bg-status-red animate-pulse'
                : 'bg-tg-button'}`}>
              {notifSummary.total_unread > 99 ? '99+' : notifSummary.total_unread}
            </span>
          )}
        </button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 p-4">
        <KPICard
          icon={<Building2 size={20} />}
          label="Объекты"
          value={data.active_objects}
          color="text-status-blue"
        />
        <KPICard
          icon={<CheckCircle2 size={20} />}
          label="Выполнено"
          value={data.completed_tasks}
          color="text-status-green"
        />
        <KPICard
          icon={<AlertTriangle size={20} />}
          label="Просрочено"
          value={data.overdue_tasks}
          color="text-status-red"
        />
        <KPICard
          icon={<Truck size={20} />}
          label="Задержки поставок"
          value={data.delayed_supplies}
          color="text-status-yellow"
        />
      </div>

      {/* Production Progress */}
      {data.production && (
        <div className="px-4 space-y-3">
          <div className="section-header mt-0">Производство</div>

          {/* Modules + Brackets */}
          <div className="grid grid-cols-2 gap-3">
            <ProductionGauge
              label="Модули"
              icon={<Layers size={16} />}
              fact={data.production.modules_fact}
              plan={data.production.modules_plan}
              pct={data.production.modules_pct}
              color="blue"
            />
            <ProductionGauge
              label="Кронштейны"
              icon={<Wrench size={16} />}
              fact={data.production.brackets_fact}
              plan={data.production.brackets_plan}
              pct={data.production.brackets_pct}
              color="green"
            />
          </div>

          {/* KPI by work type */}
          {data.production.kpi.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-tg-hint" />
                <span className="text-xs font-semibold text-tg-text">По видам работ</span>
              </div>
              <div className="space-y-2.5">
                {data.production.kpi.map((kpi) => (
                  <KPIProgressRow key={kpi.name} kpi={kpi} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Objects list */}
      <div className="section-header mt-2">Объекты</div>
      <div className="flex flex-col gap-2 px-4">
        {data.objects.map((obj) => {
          const days = daysUntil(obj.deadline_date);
          const isOverdue = days !== null && days < 0;

          return (
            <button
              key={obj.id}
              onClick={() => navigate(`/objects/${obj.id}`)}
              className="card text-left w-full active:scale-[0.98] transition-transform touch-target"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-semibold text-tg-text truncate">
                    {obj.name}
                  </h3>
                  {obj.city && (
                    <p className="text-xs text-tg-hint mt-0.5">{obj.city}</p>
                  )}
                </div>
                <span className={OBJECT_STATUS_LABELS[obj.status] ? statusBadgeClass(obj.status) : 'badge-gray'}>
                  {OBJECT_STATUS_LABELS[obj.status]}
                </span>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-tg-hint mb-1">
                  <span>Прогресс</span>
                  <span className="font-medium text-tg-text">{obj.progress_pct}%</span>
                </div>
                <div className="h-1.5 bg-tg-hint/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 bg-status-blue"
                    style={{ width: `${obj.progress_pct}%` }}
                  />
                </div>
              </div>

              {/* Bottom meta */}
              <div className="flex items-center justify-between mt-3 text-xs text-tg-hint">
                <div className="flex items-center gap-3">
                  <span>
                    <span className="text-tg-text font-medium">{obj.task_done}</span>/{obj.task_total} задач
                  </span>
                  {obj.task_overdue > 0 && (
                    <span className="text-status-red font-medium">
                      {obj.task_overdue} просрочено
                    </span>
                  )}
                </div>
                {obj.deadline_date && (
                  <span className={isOverdue ? 'text-status-red font-medium' : ''}>
                    <Clock size={12} className="inline mr-1" />
                    {formatDateShort(obj.deadline_date)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {data.objects.length === 0 && (
        <div className="text-center text-tg-hint py-12">
          Нет активных объектов
        </div>
      )}

      {/* FAB — Create Object */}
      {canCreate && (
        <button
          onClick={() => navigate('/objects/new')}
          className="fixed bottom-24 right-4 w-14 h-14 bg-tg-button text-tg-button-text
            rounded-full shadow-lg flex items-center justify-center z-30
            active:scale-90 transition-transform touch-target"
          aria-label="Создать объект"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────

function KPICard({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="card flex items-center gap-3">
      <div className={`${color} opacity-80`}>{icon}</div>
      <div>
        <div className="text-xl font-bold text-tg-text">{value}</div>
        <div className="text-2xs text-tg-hint">{label}</div>
      </div>
    </div>
  );
}

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    active: 'badge-green',
    planning: 'badge-blue',
    draft: 'badge-gray',
    on_hold: 'badge-yellow',
    completing: 'badge-yellow',
    closed: 'badge-gray',
  };
  return map[status] || 'badge-gray';
}

function DashboardSkeleton() {
  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card h-16 skeleton" />
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="card h-28 skeleton" />
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-tg-hint">
      <AlertTriangle size={40} className="mb-3 text-status-red" />
      <p>{message}</p>
    </div>
  );
}

// ─── Production components ───────────────────────────────

function ProductionGauge({ label, icon, fact, plan, pct, color }: {
  label: string;
  icon: React.ReactNode;
  fact: number;
  plan: number;
  pct: number;
  color: 'blue' | 'green';
}) {
  const colorClass = color === 'blue' ? 'text-status-blue' : 'text-status-green';
  const bgClass = color === 'blue' ? 'bg-status-blue' : 'bg-status-green';

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-2">
        <div className={`${colorClass} opacity-80`}>{icon}</div>
        <span className="text-xs font-medium text-tg-hint">{label}</span>
      </div>
      <div className="text-xl font-bold text-tg-text">
        {fact.toLocaleString('ru-RU')}
        <span className="text-xs font-normal text-tg-hint ml-1">/ {plan.toLocaleString('ru-RU')}</span>
      </div>
      <div className="mt-2">
        <div className="flex items-center justify-between text-2xs text-tg-hint mb-1">
          <span>Выполнение</span>
          <span className={`font-medium ${colorClass}`}>{pct}%</span>
        </div>
        <div className="h-1.5 bg-tg-hint/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${bgClass}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function KPIProgressRow({ kpi }: { kpi: ProductionKPI }) {
  const pctColor = kpi.pct >= 80 ? 'text-status-green'
    : kpi.pct >= 40 ? 'text-status-yellow'
    : 'text-status-red';
  const barColor = kpi.pct >= 80 ? 'bg-status-green'
    : kpi.pct >= 40 ? 'bg-status-yellow'
    : 'bg-status-red';

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-tg-text truncate flex-1 mr-2">{kpi.name}</span>
        <span className="text-tg-hint flex-shrink-0">
          {kpi.fact.toLocaleString('ru-RU')} / {kpi.plan.toLocaleString('ru-RU')} {kpi.unit}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1 bg-tg-hint/10 rounded-full overflow-hidden flex-1">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.min(kpi.pct, 100)}%` }}
          />
        </div>
        <span className={`text-2xs font-medium ${pctColor} w-10 text-right`}>{kpi.pct}%</span>
      </div>
    </div>
  );
}
