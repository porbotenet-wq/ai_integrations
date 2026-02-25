import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { Save, Filter, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface Props {
  objectId: number;
}

interface FactItem {
  id: number;
  floor: number;
  facade: string;
  work_name: string;
  work_code: string;
  unit: string;
  plan_qty: number;
  fact_qty: number;
  status: string;
  pct: number;
}

interface FactData {
  items: FactItem[];
  filters: { floors: number[]; facades: string[] };
}

export function FactEntryTab({ objectId }: Props) {
  const queryClient = useQueryClient();
  const [floor, setFloor] = useState<number | null>(null);
  const [facade, setFacade] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<number, number>>({});

  const params = new URLSearchParams();
  if (floor !== null) params.set('floor', String(floor));
  if (facade) params.set('facade', facade);

  const { data, isLoading } = useQuery<FactData>({
    queryKey: ['fact-entry', objectId, floor, facade],
    queryFn: () => api.get(`/api/objects/${objectId}/fact-entry?${params}`),
  });

  const saveMutation = useMutation({
    mutationFn: (entries: { floor_volume_id: number; fact_qty: number }[]) =>
      api.post(`/api/objects/${objectId}/fact-entry`, { entries }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fact-entry', objectId] });
      setEdits({});
    },
  });

  const handleChange = (id: number, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setEdits((prev) => ({ ...prev, [id]: num }));
    } else if (value === '') {
      setEdits((prev) => ({ ...prev, [id]: 0 }));
    }
  };

  const handleSave = () => {
    const entries = Object.entries(edits).map(([id, qty]) => ({
      floor_volume_id: Number(id),
      fact_qty: qty,
    }));
    if (entries.length > 0) saveMutation.mutate(entries);
  };

  const editCount = Object.keys(edits).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-tg-hint" size={24} />
      </div>
    );
  }

  const items = data?.items || [];
  const filters = data?.filters || { floors: [], facades: [] };

  // Group by facade+floor
  const grouped: Record<string, FactItem[]> = {};
  items.forEach((item) => {
    const key = `${item.facade} — Этаж ${item.floor}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  });

  return (
    <div className="space-y-3 pb-20">
      {/* Filters */}
      <div className="flex gap-2 items-center">
        <Filter size={14} className="text-tg-hint" />
        <select
          value={facade || ''}
          onChange={(e) => setFacade(e.target.value || null)}
          className="bg-tg-section-bg text-tg-text text-xs rounded-lg px-3 py-2 outline-none"
        >
          <option value="">Все фасады</option>
          {filters.facades.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <select
          value={floor ?? ''}
          onChange={(e) => setFloor(e.target.value ? Number(e.target.value) : null)}
          className="bg-tg-section-bg text-tg-text text-xs rounded-lg px-3 py-2 outline-none"
        >
          <option value="">Все этажи</option>
          {filters.floors.map((f) => (
            <option key={f} value={f}>Этаж {f}</option>
          ))}
        </select>
      </div>

      {/* Groups */}
      {Object.entries(grouped).map(([group, groupItems]) => (
        <div key={group} className="bg-tg-section-bg rounded-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-tg-hint/10">
            <span className="text-xs font-medium text-tg-text">{group}</span>
          </div>
          <div className="divide-y divide-tg-hint/5">
            {groupItems.map((item) => {
              const currentFact = edits[item.id] ?? item.fact_qty;
              const pct = item.plan_qty > 0 ? Math.round((currentFact / item.plan_qty) * 100) : 0;
              const isEdited = item.id in edits;

              return (
                <div key={item.id} className="px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-tg-text">{item.work_name}</span>
                    <span className={`text-2xs font-mono ${
                      pct >= 100 ? 'text-status-green' : pct >= 50 ? 'text-status-yellow' : 'text-tg-hint'
                    }`}>
                      {pct}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xs text-tg-hint w-16">
                      план: {item.plan_qty}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      value={isEdited ? edits[item.id] : item.fact_qty}
                      onChange={(e) => handleChange(item.id, e.target.value)}
                      className={`flex-1 bg-tg-bg text-tg-text text-sm rounded-lg px-3 py-2
                        outline-none text-center font-mono
                        ${isEdited ? 'ring-1 ring-tg-button/50' : ''}
                        focus:ring-1 focus:ring-tg-button/30`}
                    />
                    <span className="text-2xs text-tg-hint w-10">{item.unit}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-1.5 h-1 bg-tg-bg rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 100 ? 'bg-status-green' : pct >= 50 ? 'bg-status-yellow' : 'bg-tg-button/40'
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {items.length === 0 && (
        <div className="text-center py-8 text-tg-hint text-sm">
          Нет данных для выбранных фильтров
        </div>
      )}

      {/* Save FAB */}
      {editCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-50">
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl
              bg-tg-button text-tg-button-text font-medium text-sm
              active:opacity-80 disabled:opacity-50 transition-opacity shadow-lg"
          >
            {saveMutation.isPending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : saveMutation.isSuccess ? (
              <CheckCircle2 size={18} />
            ) : (
              <Save size={18} />
            )}
            {saveMutation.isPending
              ? 'Сохраняю...'
              : saveMutation.isSuccess
                ? 'Сохранено!'
                : `Сохранить (${editCount})`}
          </button>
        </div>
      )}
    </div>
  );
}
