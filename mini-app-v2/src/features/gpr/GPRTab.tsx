import { useState } from 'react';
import { useGPR, useSignGPR } from '@/shared/api';
import { formatDate, GPR_STATUS_LABELS, DEPARTMENT_LABELS } from '@/shared/lib/format';
import { useAppStore } from '@/shared/hooks/useAppStore';
import { Check, X, Filter, FileSignature } from 'lucide-react';
import type { Department, GPRItem } from '@/shared/api/types';

interface Props {
  objectId: number;
}

export function GPRTab({ objectId }: Props) {
  const { data: gpr, isLoading } = useGPR(objectId);
  const signMutation = useSignGPR();
  const user = useAppStore((s) => s.user);
  const [filterDept, setFilterDept] = useState<Department | ''>('');

  if (isLoading) return <div className="skeleton h-64 mx-4 rounded-card" />;
  if (!gpr) return <div className="text-center text-tg-hint py-8">ГПР не создан</div>;

  const filteredItems = filterDept
    ? gpr.items.filter((item) => item.department === filterDept)
    : gpr.items;

  const departments = [...new Set(gpr.items.map((i) => i.department))];

  const canSign =
    user?.permissions.includes('gpr.sign') &&
    gpr.status === 'pending_signatures';

  return (
    <div className="px-4 space-y-3">
      {/* GPR header */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-tg-text">
              ГПР v{gpr.version}
            </h3>
            <span className={gprBadge(gpr.status)}>
              {GPR_STATUS_LABELS[gpr.status]}
            </span>
          </div>
          {canSign && (
            <button
              onClick={() => signMutation.mutate({ gprId: gpr.id, data: {} })}
              disabled={signMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 bg-tg-button text-tg-button-text rounded-lg text-xs font-medium touch-target"
            >
              <FileSignature size={14} />
              Подписать
            </button>
          )}
        </div>

        {/* Signatures */}
        {gpr.signatures.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {gpr.signatures.map((sig, i) => (
              <div
                key={i}
                className={`flex items-center gap-1 text-2xs px-2 py-1 rounded-full
                  ${sig.signed ? 'bg-status-green/15 text-status-green' : 'bg-tg-hint/10 text-tg-hint'}`}
              >
                {sig.signed ? <Check size={10} /> : <X size={10} />}
                {sig.user}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <Filter size={14} className="text-tg-hint flex-shrink-0" />
        <button
          onClick={() => setFilterDept('')}
          className={`text-xs px-2.5 py-1.5 rounded-full whitespace-nowrap transition-colors
            ${!filterDept ? 'bg-tg-button text-tg-button-text' : 'bg-tg-section-bg text-tg-hint'}`}
        >
          Все ({gpr.items.length})
        </button>
        {departments.map((dept) => (
          <button
            key={dept}
            onClick={() => setFilterDept(dept === filterDept ? '' : dept)}
            className={`text-xs px-2.5 py-1.5 rounded-full whitespace-nowrap transition-colors
              ${dept === filterDept ? 'bg-tg-button text-tg-button-text' : 'bg-tg-section-bg text-tg-hint'}`}
          >
            {DEPARTMENT_LABELS[dept] || dept}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full min-w-[600px] text-xs">
          <thead>
            <tr className="text-tg-section-header text-left">
              <th className="py-2 px-2 font-medium">№</th>
              <th className="py-2 px-2 font-medium">Работа</th>
              <th className="py-2 px-2 font-medium">Отдел</th>
              <th className="py-2 px-2 font-medium">Начало</th>
              <th className="py-2 px-2 font-medium">Конец</th>
              <th className="py-2 px-2 font-medium">Дни</th>
              <th className="py-2 px-2 font-medium">Ответ.</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item, idx) => (
              <GPRRow key={item.id} item={item} index={idx + 1} />
            ))}
          </tbody>
        </table>
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center text-tg-hint py-8">Нет записей</div>
      )}
    </div>
  );
}

function GPRRow({ item, index }: { item: GPRItem; index: number }) {
  const isOverdue = item.end_date && new Date(item.end_date) < new Date();

  return (
    <tr className="border-t border-tg-hint/10">
      <td className="py-2.5 px-2 text-tg-hint">{index}</td>
      <td className="py-2.5 px-2 text-tg-text font-medium max-w-[200px] truncate">
        {item.title}
      </td>
      <td className="py-2.5 px-2 text-tg-hint">
        {DEPARTMENT_LABELS[item.department] || item.department}
      </td>
      <td className="py-2.5 px-2 text-tg-hint">{formatDate(item.start_date)}</td>
      <td className={`py-2.5 px-2 ${isOverdue ? 'text-status-red font-medium' : 'text-tg-hint'}`}>
        {formatDate(item.end_date)}
      </td>
      <td className="py-2.5 px-2 text-tg-hint">{item.duration_days ?? '—'}</td>
      <td className="py-2.5 px-2 text-tg-hint truncate max-w-[100px]">
        {item.responsible ?? '—'}
      </td>
    </tr>
  );
}

function gprBadge(status: string): string {
  const map: Record<string, string> = {
    draft: 'badge-gray', pending_signatures: 'badge-yellow',
    active: 'badge-green', revised: 'badge-blue', archived: 'badge-gray',
  };
  return map[status] || 'badge-gray';
}
