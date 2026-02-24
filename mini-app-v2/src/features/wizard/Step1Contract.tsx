import { useState, useRef } from 'react';
import { api } from '@/shared/api/client';
import {
  Building2, MapPin, Calendar, Banknote, User,
  Upload, FileText, Ruler, Grid3X3, Briefcase, X,
} from 'lucide-react';
import type { CreateObjectStep1 } from '@/shared/api/types';

interface Props {
  data: CreateObjectStep1;
  onChange: (data: CreateObjectStep1) => void;
  contractFileUrl: string | null;
  onFileUploaded: (url: string) => void;
}

export function Step1Contract({ data, onChange, contractFileUrl, onFileUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function update(patch: Partial<CreateObjectStep1>) {
    onChange({ ...data, ...patch });
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowed = ['application/pdf', 'image/jpeg', 'image/png',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) {
      window.Telegram?.WebApp?.showAlert('Допустимые форматы: PDF, JPG, PNG, DOC, DOCX');
      return;
    }
    // 20MB limit
    if (file.size > 20 * 1024 * 1024) {
      window.Telegram?.WebApp?.showAlert('Максимальный размер файла — 20 МБ');
      return;
    }

    setUploading(true);
    try {
      const result = await api.uploadFile(file, 'contract');
      onFileUploaded(result.url);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch {
      window.Telegram?.WebApp?.showAlert('Ошибка загрузки файла');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">

      {/* ── Project Identity ──────────────────────────── */}
      <div className="section-header">Идентификация проекта</div>
      <div className="mx-4 card space-y-4">
        <InputField
          icon={<Building2 size={18} />}
          label="Название объекта *"
          placeholder='напр. «ЖК Skyline Башня А»'
          value={data.name}
          onChange={(v) => update({ name: v })}
          required
        />

        <InputField
          icon={<Briefcase size={18} />}
          label="Фронт работ"
          placeholder="напр. «Фасадные работы НВФ+СПК»"
          value={data.work_front}
          onChange={(v) => update({ work_front: v })}
        />

        <InputField
          icon={<MapPin size={18} />}
          label="Город *"
          placeholder="Москва"
          value={data.city}
          onChange={(v) => update({ city: v })}
          required
        />

        <InputField
          icon={<MapPin size={18} />}
          label="Адрес объекта"
          placeholder="ул. Строителей, д. 12"
          value={data.address}
          onChange={(v) => update({ address: v })}
        />
      </div>

      {/* ── Dates ─────────────────────────────────────── */}
      <div className="section-header mt-2">Сроки</div>
      <div className="mx-4 card space-y-4">
        <DateField
          icon={<Calendar size={18} className="text-tg-link" />}
          label="Дата подписания договора *"
          value={data.contract_date}
          onChange={(v) => update({ contract_date: v })}
        />

        <DateField
          icon={<Calendar size={18} className="text-status-red" />}
          label="Плановый срок завершения *"
          value={data.deadline_date}
          onChange={(v) => update({ deadline_date: v })}
        />

        {/* Duration display */}
        {data.contract_date && data.deadline_date && (
          <div className="flex items-center gap-2 text-xs text-tg-hint bg-tg-section-bg rounded-lg px-3 py-2">
            <Calendar size={14} />
            <span>
              Срок проекта:{' '}
              <span className="text-tg-text font-medium">
                {daysBetween(data.contract_date, data.deadline_date)} дн.
              </span>
              {' '}(~{monthsBetween(data.contract_date, data.deadline_date)} мес.)
            </span>
          </div>
        )}
      </div>

      {/* ── Customer ──────────────────────────────────── */}
      <div className="section-header mt-2">Заказчик</div>
      <div className="mx-4 card space-y-4">
        <InputField
          icon={<User size={18} />}
          label="Наименование заказчика *"
          placeholder='ООО «ГенПодрядчик»'
          value={data.customer_name}
          onChange={(v) => update({ customer_name: v })}
          required
        />

        <InputField
          icon={<User size={18} />}
          label="Контактное лицо / телефон"
          placeholder="+7 (900) 123-45-67"
          value={data.customer_contact}
          onChange={(v) => update({ customer_contact: v })}
        />
      </div>

      {/* ── Financials & Metrics ───────────────────────── */}
      <div className="section-header mt-2">Финансы и метрики</div>
      <div className="mx-4 card space-y-4">
        <NumberField
          icon={<Banknote size={18} />}
          label="Сметная стоимость (₽)"
          placeholder="128 000 000"
          value={data.budget}
          onChange={(v) => update({ budget: v })}
          suffix="₽"
        />

        <NumberField
          icon={<Ruler size={18} />}
          label="Площадь фасада (м²)"
          placeholder="15 647"
          value={data.facade_area_m2}
          onChange={(v) => update({ facade_area_m2: v })}
          suffix="м²"
        />

        <NumberField
          icon={<Grid3X3 size={18} />}
          label="Количество модулей (шт.)"
          placeholder="2 486"
          value={data.total_modules}
          onChange={(v) => update({ total_modules: v })}
          suffix="шт."
        />
      </div>

      {/* ── Contract File ──────────────────────────────── */}
      <div className="section-header mt-2">Скан договора</div>
      <div className="mx-4">
        {contractFileUrl ? (
          <div className="card flex items-center gap-3">
            <FileText size={20} className="text-status-green flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-tg-text">Договор загружен</div>
              <div className="text-2xs text-tg-hint truncate">{contractFileUrl}</div>
            </div>
            <button
              onClick={() => onFileUploaded('')}
              className="p-2 text-tg-hint touch-target"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="card w-full flex items-center justify-center gap-2 py-6
              border-2 border-dashed border-tg-hint/20 active:scale-[0.98]
              transition-transform touch-target"
          >
            {uploading ? (
              <span className="text-sm text-tg-hint">Загрузка...</span>
            ) : (
              <>
                <Upload size={20} className="text-tg-link" />
                <span className="text-sm text-tg-link">Загрузить скан договора</span>
              </>
            )}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          className="hidden"
          onChange={handleFileUpload}
        />
        <div className="text-2xs text-tg-hint mt-1 px-1">
          PDF, JPG, PNG, DOC — до 20 МБ
        </div>
      </div>
    </div>
  );
}

/* ── Field Components ──────────────────────────────────── */

function InputField({ icon, label, placeholder, value, onChange, required }: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-2xs text-tg-hint mb-1 block">{label}</label>
      <div className="flex items-center gap-2">
        <div className="text-tg-hint flex-shrink-0">{icon}</div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="flex-1 bg-transparent text-sm text-tg-text placeholder:text-tg-hint/50
            outline-none border-b border-tg-hint/15 pb-1 focus:border-tg-button
            transition-colors touch-target"
        />
      </div>
    </div>
  );
}

function DateField({ icon, label, value, onChange }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-2xs text-tg-hint mb-1 block">{label}</label>
      <div className="flex items-center gap-2">
        <div className="flex-shrink-0">{icon}</div>
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-tg-secondary-bg text-sm text-tg-text rounded-lg
            px-3 py-2.5 border border-tg-hint/15 outline-none
            focus:border-tg-button transition-colors touch-target
            [color-scheme:dark]"
        />
      </div>
    </div>
  );
}

function NumberField({ icon, label, placeholder, value, onChange, suffix }: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix: string;
}) {
  function handleChange(raw: string) {
    const cleaned = raw.replace(/[^\d.]/g, '');
    if (cleaned === '') {
      onChange(null);
    } else {
      const num = parseFloat(cleaned);
      if (!isNaN(num)) onChange(num);
    }
  }

  // Format number with spaces for display
  function formatDisplay(n: number | null): string {
    if (n === null) return '';
    return n.toLocaleString('ru-RU');
  }

  return (
    <div>
      <label className="text-2xs text-tg-hint mb-1 block">{label}</label>
      <div className="flex items-center gap-2">
        <div className="text-tg-hint flex-shrink-0">{icon}</div>
        <input
          type="text"
          inputMode="decimal"
          value={formatDisplay(value)}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-tg-text placeholder:text-tg-hint/50
            outline-none border-b border-tg-hint/15 pb-1 focus:border-tg-button
            transition-colors touch-target"
        />
        <span className="text-xs text-tg-hint flex-shrink-0">{suffix}</span>
      </div>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────── */

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function monthsBetween(a: string, b: string): number {
  const days = daysBetween(a, b);
  return Math.round(days / 30);
}
