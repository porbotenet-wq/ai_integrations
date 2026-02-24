import { useState, useEffect } from 'react';
import { useUpdateNotificationSettings } from '@/shared/api';
import {
  Bell, Clock, Calendar, Volume2, VolumeX, AlertTriangle,
  CheckCircle2, RefreshCw,
} from 'lucide-react';
import type { NotificationSettings, UpdateNotificationSettingsRequest } from '@/shared/api/types';

interface Props {
  settings: NotificationSettings;
}

const DAYS_OF_WEEK: Record<string, string> = {
  monday: 'Понедельник',
  tuesday: 'Вторник',
  wednesday: 'Среда',
  thursday: 'Четверг',
  friday: 'Пятница',
  saturday: 'Суббота',
  sunday: 'Воскресенье',
};

export function ProfileSettingsTab({ settings }: Props) {
  const mutation = useUpdateNotificationSettings();
  const [draft, setDraft] = useState<NotificationSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset draft when settings change from server
  useEffect(() => {
    setDraft(settings);
    setHasChanges(false);
  }, [settings]);

  function update(patch: Partial<NotificationSettings>) {
    setDraft((prev) => ({ ...prev, ...patch }));
    setHasChanges(true);
  }

  function handleSave() {
    const changes: UpdateNotificationSettingsRequest = {};
    if (draft.work_hours_start !== settings.work_hours_start) changes.work_hours_start = draft.work_hours_start;
    if (draft.work_hours_end !== settings.work_hours_end) changes.work_hours_end = draft.work_hours_end;
    if (draft.plan_fact_time !== settings.plan_fact_time) changes.plan_fact_time = draft.plan_fact_time;
    if (draft.reminder_interval_1_min !== settings.reminder_interval_1_min) changes.reminder_interval_1_min = draft.reminder_interval_1_min;
    if (draft.reminder_interval_2_min !== settings.reminder_interval_2_min) changes.reminder_interval_2_min = draft.reminder_interval_2_min;
    if (draft.weekly_audit_day !== settings.weekly_audit_day) changes.weekly_audit_day = draft.weekly_audit_day;
    if (draft.weekly_audit_time !== settings.weekly_audit_time) changes.weekly_audit_time = draft.weekly_audit_time;
    if (draft.push_enabled !== settings.push_enabled) changes.push_enabled = draft.push_enabled;
    if (draft.critical_only_outside_hours !== settings.critical_only_outside_hours) changes.critical_only_outside_hours = draft.critical_only_outside_hours;

    mutation.mutate(changes);
    setHasChanges(false);
  }

  return (
    <div className="space-y-2">

      {/* ── Push toggle ───────────────────────────────── */}
      <div className="section-header">Уведомления</div>
      <div className="mx-4 card">
        <ToggleRow
          icon={draft.push_enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          label="Push-уведомления"
          description="Получать уведомления от бота"
          value={draft.push_enabled}
          onChange={(v) => update({ push_enabled: v })}
        />

        <div className="border-t border-tg-hint/10 mt-3 pt-3">
          <ToggleRow
            icon={<AlertTriangle size={18} />}
            label="Только критические вне рабочих часов"
            description="Обычные уведомления молчат ночью"
            value={draft.critical_only_outside_hours}
            onChange={(v) => update({ critical_only_outside_hours: v })}
          />
        </div>
      </div>

      {/* ── Work Hours ────────────────────────────────── */}
      <div className="section-header mt-2">Рабочие часы</div>
      <div className="mx-4 card space-y-3">
        <div className="flex items-center gap-3">
          <Clock size={18} className="text-tg-hint" />
          <span className="text-sm text-tg-text flex-1">Начало рабочего дня</span>
          <TimeInput
            value={draft.work_hours_start}
            onChange={(v) => update({ work_hours_start: v })}
          />
        </div>
        <div className="flex items-center gap-3">
          <Clock size={18} className="text-tg-hint" />
          <span className="text-sm text-tg-text flex-1">Конец рабочего дня</span>
          <TimeInput
            value={draft.work_hours_end}
            onChange={(v) => update({ work_hours_end: v })}
          />
        </div>
        <div className="text-2xs text-tg-hint px-8">
          Вне этих часов доставляются только критические алерты
        </div>
      </div>

      {/* ── Plan-Fact Report ──────────────────────────── */}
      <div className="section-header mt-2">Ежедневный план-факт</div>
      <div className="mx-4 card space-y-3">
        <div className="flex items-center gap-3">
          <Calendar size={18} className="text-tg-accent" />
          <span className="text-sm text-tg-text flex-1">Время запроса отчёта</span>
          <TimeInput
            value={draft.plan_fact_time}
            onChange={(v) => update({ plan_fact_time: v })}
          />
        </div>
        <div className="text-2xs text-tg-hint px-8">
          Бот отправит запрос на заполнение план-факта в указанное время
        </div>
      </div>

      {/* ── Reminder Intervals ────────────────────────── */}
      <div className="section-header mt-2">Напоминания при неответе</div>
      <div className="mx-4 card space-y-3">
        <div className="flex items-center gap-3">
          <RefreshCw size={18} className="text-tg-hint" />
          <span className="text-sm text-tg-text flex-1">Первое напоминание</span>
          <MinutesSelect
            value={draft.reminder_interval_1_min}
            onChange={(v) => update({ reminder_interval_1_min: v })}
            options={[15, 30, 60, 120]}
          />
        </div>
        <div className="flex items-center gap-3">
          <RefreshCw size={18} className="text-status-yellow" />
          <span className="text-sm text-tg-text flex-1">Второе напоминание</span>
          <MinutesSelect
            value={draft.reminder_interval_2_min}
            onChange={(v) => update({ reminder_interval_2_min: v })}
            options={[60, 120, 240, 480]}
          />
        </div>
        <div className="text-2xs text-tg-hint px-8">
          При отсутствии реакции бот отправит напоминание через указанные интервалы.
          После 2-го — эскалация руководителю.
        </div>
      </div>

      {/* ── Weekly Audit ──────────────────────────────── */}
      <div className="section-header mt-2">Еженедельный аудит качества</div>
      <div className="mx-4 card space-y-3">
        <div className="flex items-center gap-3">
          <Calendar size={18} className="text-tg-hint" />
          <span className="text-sm text-tg-text flex-1">День недели</span>
          <select
            value={draft.weekly_audit_day}
            onChange={(e) => update({ weekly_audit_day: e.target.value })}
            className="bg-tg-secondary-bg text-tg-text text-sm rounded-lg px-2 py-1.5
              border border-tg-hint/20 outline-none touch-target"
          >
            {Object.entries(DAYS_OF_WEEK).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <Clock size={18} className="text-tg-hint" />
          <span className="text-sm text-tg-text flex-1">Время запуска</span>
          <TimeInput
            value={draft.weekly_audit_time}
            onChange={(v) => update({ weekly_audit_time: v })}
          />
        </div>
        <div className="text-2xs text-tg-hint px-8">
          Бот сгенерирует ссылки на чек-листы контроля качества
        </div>
      </div>

      {/* ── Save Button ───────────────────────────────── */}
      {hasChanges && (
        <div className="px-4 pt-2 pb-4">
          <button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="w-full py-3.5 bg-tg-button text-tg-button-text rounded-xl
              text-sm font-semibold touch-target transition-opacity
              disabled:opacity-60 active:scale-[0.98]"
          >
            {mutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin" />
                Сохранение...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <CheckCircle2 size={14} />
                Сохранить настройки
              </span>
            )}
          </button>
        </div>
      )}

      {mutation.isSuccess && !hasChanges && (
        <div className="px-4">
          <div className="flex items-center justify-center gap-2 text-sm text-status-green py-2">
            <CheckCircle2 size={14} />
            Настройки сохранены
          </div>
        </div>
      )}

      {/* ── Info block ────────────────────────────────── */}
      <div className="mx-4 mt-2 mb-4">
        <div className="bg-tg-section-bg rounded-card p-3">
          <div className="flex items-start gap-2">
            <Bell size={14} className="text-tg-hint flex-shrink-0 mt-0.5" />
            <div className="text-2xs text-tg-hint leading-relaxed">
              Система эскалации (3 уровня) не подлежит отключению.
              При просрочке критических задач руководитель получит уведомление
              автоматически, вне зависимости от ваших настроек.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Toggle Row ────────────────────────────────────────── */

function ToggleRow({ icon, label, description, value, onChange }: {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex items-center gap-3 w-full text-left touch-target"
    >
      <div className="text-tg-hint">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-tg-text">{label}</div>
        <div className="text-2xs text-tg-hint mt-0.5">{description}</div>
      </div>
      {/* Toggle switch */}
      <div className={`w-11 h-6 rounded-full p-0.5 transition-colors flex-shrink-0
        ${value ? 'bg-status-green' : 'bg-tg-hint/30'}`}>
        <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform
          ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </button>
  );
}

/* ── Time Input ────────────────────────────────────────── */

function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-tg-secondary-bg text-tg-text text-sm rounded-lg px-2 py-1.5
        border border-tg-hint/20 outline-none w-24 text-center touch-target
        [color-scheme:dark]"
    />
  );
}

/* ── Minutes Select ────────────────────────────────────── */

function MinutesSelect({ value, onChange, options }: {
  value: number;
  onChange: (v: number) => void;
  options: number[];
}) {
  function formatMinutes(m: number): string {
    if (m < 60) return `${m} мин`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h}ч ${rem}м` : `${h}ч`;
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="bg-tg-secondary-bg text-tg-text text-sm rounded-lg px-2 py-1.5
        border border-tg-hint/20 outline-none touch-target"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>{formatMinutes(opt)}</option>
      ))}
    </select>
  );
}
