import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { useState } from 'react';
import {
  Factory, Package, Truck, Layers, ChevronDown, ChevronRight,
    AlertTriangle, CheckCircle2, Clock, Boxes, TrendingUp,
} from 'lucide-react';

interface Props {
  objectId: number;
}

type SubTab = 'zones' | 'materials' | 'warehouse' | 'shipments' | 'tracking' | 'plan';

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'zones', label: 'Зоны', icon: <Layers size={14} /> },
  { id: 'tracking', label: 'Трекинг', icon: <Factory size={14} /> },
  { id: 'plan', label: 'План', icon: <TrendingUp size={14} /> },
  { id: 'materials', label: 'Материалы', icon: <Boxes size={14} /> },
  { id: 'warehouse', label: 'Склад', icon: <Package size={14} /> },
  { id: 'shipments', label: 'Отгрузки', icon: <Truck size={14} /> },
];

export function ProductionChainTab({ objectId }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('zones');

  return (
    <div className="space-y-3">
      {/* Sub-tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs
              font-medium whitespace-nowrap flex-shrink-0 touch-target transition-colors
              ${subTab === t.id
                ? 'bg-tg-button text-tg-button-text'
                : 'bg-tg-section-bg text-tg-hint'}`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'zones' && <ZonesView objectId={objectId} />}
      {subTab === 'tracking' && <TrackingView objectId={objectId} />}
      {subTab === 'plan' && <PlanView objectId={objectId} />}
      {subTab === 'materials' && <MaterialsView objectId={objectId} />}
      {subTab === 'warehouse' && <WarehouseView objectId={objectId} />}
      {subTab === 'shipments' && <ShipmentsView objectId={objectId} />}
    </div>
  );
}

/* ── Zones ─────────────────────────────────────────────── */

function ZonesView({ objectId }: { objectId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['production-chain-zones', objectId],
    queryFn: () => api.get<any[]>(`/api/production-chain/${objectId}/zones`),
  });
  const [expanded, setExpanded] = useState<number | null>(null);

  if (isLoading) return <Skeleton count={4} />;
  if (!data?.length) return <Empty text="Зоны не созданы" />;

  return (
    <div className="space-y-2">
      {data.map((z) => (
        <div key={z.id} className="card">
          <button
            onClick={() => setExpanded(expanded === z.id ? null : z.id)}
            className="w-full text-left touch-target"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-tg-text truncate">{z.name}</h4>
                <div className="flex items-center gap-2 mt-1 text-2xs text-tg-hint">
                  <span className="badge-blue">{z.system_type}</span>
                  <span>{z.floor_axis}</span>
                  <span>·</span>
                  <span>{z.bom_total} позиций</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <MiniProgress pct={z.progress_pct} />
                <ChevronDown
                  size={14}
                  className={`text-tg-hint transition-transform ${expanded === z.id ? 'rotate-180' : ''}`}
                />
              </div>
            </div>
          </button>

          {expanded === z.id && (
            <div className="mt-3 pt-3 border-t border-tg-hint/10">
              <BOMList objectId={objectId} zoneId={z.id} />
              <div className="flex items-center gap-3 mt-2 text-2xs text-tg-hint">
                {z.production_start_date && (
                  <span className="flex items-center gap-0.5">
                    <Factory size={10} /> Старт: {formatShort(z.production_start_date)}
                  </span>
                )}
                {z.delivery_date && (
                  <span className="flex items-center gap-0.5">
                    <Truck size={10} /> Доставка: {formatShort(z.delivery_date)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function BOMList({ objectId, zoneId }: { objectId: number; zoneId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['bom', objectId, zoneId],
    queryFn: () => api.get<any[]>(`/api/production-chain/${objectId}/zones/${zoneId}/bom`),
  });

  if (isLoading) return <div className="skeleton h-16 rounded-lg" />;
  if (!data?.length) return <div className="text-2xs text-tg-hint">Нет позиций</div>;

  return (
    <div className="space-y-1">
      {data.map((item) => (
        <div key={item.id} className="flex items-center gap-2 py-1.5 text-xs">
          <span className="font-mono text-tg-hint w-20 flex-shrink-0 truncate">{item.mark}</span>
          <span className="text-tg-text flex-1 truncate">{item.material}</span>
          <span className="text-tg-hint flex-shrink-0">{item.quantity} шт</span>
          <BOMStatusBadge status={item.status} />
        </div>
      ))}
    </div>
  );
}

/* ── Materials ─────────────────────────────────────────── */

function MaterialsView({ objectId }: { objectId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['materials', objectId],
    queryFn: () => api.get<any[]>(`/api/production-chain/${objectId}/materials`),
  });

  if (isLoading) return <Skeleton count={5} />;
  if (!data?.length) return <Empty text="Материалы не добавлены" />;

  const withDeficit = data.filter((m) => m.deficit > 0);
  const ok = data.filter((m) => m.deficit <= 0);

  return (
    <div className="space-y-3">
      {withDeficit.length > 0 && (
        <div className="card ring-1 ring-status-red/20 bg-status-red/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-status-red" />
            <span className="text-xs font-semibold text-status-red">
              Дефицит: {withDeficit.length} позиций
            </span>
          </div>
          {withDeficit.map((m) => <MaterialRow key={m.id} m={m} />)}
        </div>
      )}

      {ok.length > 0 && (
        <>
          <div className="section-header mt-0">Обеспечено ({ok.length})</div>
          {ok.map((m) => <MaterialRow key={m.id} m={m} />)}
        </>
      )}
    </div>
  );
}

function MaterialRow({ m }: { m: any }) {
  const hasDeficit = m.deficit > 0;
  const barColor = m.coverage_pct >= 100 ? 'bg-status-green'
    : m.coverage_pct >= 50 ? 'bg-status-yellow' : 'bg-status-red';

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-tg-text truncate">{m.name}</h4>
          <div className="text-2xs text-tg-hint mt-0.5">{m.code} · {m.unit}</div>
        </div>
        {hasDeficit && (
          <span className="badge-red flex-shrink-0">−{m.deficit.toLocaleString('ru-RU')}</span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1 text-2xs text-center">
        <div><div className="text-tg-hint">Потребность</div><div className="font-medium text-tg-text">{fmt(m.object_demand)}</div></div>
        <div><div className="text-tg-hint">Закуплено</div><div className="font-medium text-tg-text">{fmt(m.purchased)}</div></div>
        <div><div className="text-tg-hint">На складе</div><div className="font-medium text-tg-text">{fmt(m.in_stock)}</div></div>
        <div><div className="text-tg-hint">В произв.</div><div className="font-medium text-tg-text">{fmt(m.in_production)}</div></div>
      </div>
      <div className="mt-2">
        <div className="flex items-center justify-between text-2xs text-tg-hint mb-0.5">
          <span>Покрытие</span>
          <span className={`font-medium ${hasDeficit ? 'text-status-red' : 'text-status-green'}`}>{m.coverage_pct}%</span>
        </div>
        <div className="h-1 bg-tg-hint/10 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(m.coverage_pct, 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

/* ── Warehouse ─────────────────────────────────────────── */

function WarehouseView({ objectId }: { objectId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['warehouse', objectId],
    queryFn: () => api.get<any>(`/api/production-chain/${objectId}/warehouse`),
  });

  if (isLoading) return <Skeleton count={4} />;
  if (!data?.items?.length) return <Empty text="Склад пуст" />;

  const s = data.summary;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="card text-center">
          <div className="text-xl font-bold text-tg-text">{s.total_produced}</div>
          <div className="text-2xs text-tg-hint">Произведено</div>
        </div>
        <div className="card text-center">
          <div className="text-xl font-bold text-status-green">{s.ready_to_ship}</div>
          <div className="text-2xs text-tg-hint">Готово к отгрузке</div>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1.5">
        {data.items.filter((i: any) => i.produced_qty > 0).map((item: any) => (
          <div key={item.id} className="card flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-mono text-tg-text">{item.mark}</div>
              <div className="text-2xs text-tg-hint mt-0.5">
                {item.item_type} · {item.quantity} план
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-xs text-tg-text">{item.produced_qty} / {item.shipped_qty} отгр.</div>
              {item.ready_to_ship && (
                <div className="flex items-center gap-0.5 text-2xs text-status-green justify-end mt-0.5">
                  <CheckCircle2 size={10} /> Готов
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Shipments ─────────────────────────────────────────── */

function ShipmentsView({ objectId }: { objectId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['shipments', objectId],
    queryFn: () => api.get<any[]>(`/api/production-chain/${objectId}/shipments`),
  });

  if (isLoading) return <Skeleton count={3} />;
  if (!data?.length) return <Empty text="Отгрузок нет" />;

  return (
    <div className="space-y-2">
      {data.map((s) => (
        <div key={s.id} className="card">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-tg-hint" />
              <span className="text-sm font-semibold text-tg-text">{s.batch_number}</span>
            </div>
            {s.ship_date && (
              <span className="text-2xs text-tg-hint flex items-center gap-0.5">
                <Clock size={10} /> {formatShort(s.ship_date)}
              </span>
            )}
          </div>
          <div className="mt-2 text-xs text-tg-text">{s.items_list}</div>
          <div className="flex items-center gap-3 mt-2 text-2xs text-tg-hint">
            <span>{s.quantity} ед.</span>
            {s.vehicle && <span>🚛 {s.vehicle}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Production Plan ───────────────────────────────────── */

function PlanView({ objectId }: { objectId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['production-plan', objectId],
    queryFn: () => api.get<any>(`/api/production-chain/${objectId}/production-plan`),
  });
  const [expandedWs, setExpandedWs] = useState<string | null>(null);

  if (isLoading) return <Skeleton count={4} />;
  if (!data?.workshops?.length) return <Empty text="План производства не создан" />;

  const s = data.summary;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-tg-text">Выполнение плана</span>
          <span className="text-xs text-tg-hint">{s.days} дн.</span>
        </div>
        <div className="flex items-end gap-3 mb-2">
          <div>
            <div className="text-2xs text-tg-hint">План</div>
            <div className="text-lg font-bold text-tg-text">{fmt(s.total_plan)}</div>
          </div>
          <div>
            <div className="text-2xs text-tg-hint">Факт</div>
            <div className="text-lg font-bold text-status-blue">{fmt(s.total_fact)}</div>
          </div>
          <div className="flex-1" />
          <div className={`text-xl font-bold ${s.completion_pct >= 80 ? 'text-status-green' : s.completion_pct >= 50 ? 'text-status-yellow' : 'text-status-red'}`}>
            {s.completion_pct}%
          </div>
        </div>
        <div className="h-2 bg-tg-hint/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              s.completion_pct >= 80 ? 'bg-status-green' : s.completion_pct >= 50 ? 'bg-status-yellow' : 'bg-status-red'
            }`}
            style={{ width: `${Math.min(s.completion_pct, 100)}%` }}
          />
        </div>
      </div>

      {/* Workshops */}
      {data.workshops.map((ws: any) => {
        const isOpen = expandedWs === ws.name;
        const barColor = ws.pct >= 80 ? 'bg-status-green' : ws.pct >= 50 ? 'bg-status-yellow' : 'bg-status-red';

        return (
          <div key={ws.name} className="card">
            <button
              onClick={() => setExpandedWs(isOpen ? null : ws.name)}
              className="w-full text-left touch-target"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-tg-text">{ws.name}</h4>
                  <div className="text-2xs text-tg-hint mt-0.5">
                    {ws.lines.length} линий · План: {fmt(ws.plan)} · Факт: {fmt(ws.fact)}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-sm font-bold ${ws.pct >= 80 ? 'text-status-green' : ws.pct >= 50 ? 'text-status-yellow' : 'text-status-red'}`}>
                    {ws.pct}%
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-tg-hint transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>
              <div className="mt-2 h-1 bg-tg-hint/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(ws.pct, 100)}%` }} />
              </div>
            </button>

            {isOpen && (
              <div className="mt-3 pt-3 border-t border-tg-hint/10 space-y-3">
                {ws.lines.map((line: any) => (
                  <div key={line.name}>
                    <div className="text-2xs font-semibold text-tg-hint mb-1.5">{line.name}</div>
                    <div className="space-y-1">
                      {line.entries.slice(0, 10).map((e: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                          <span className="text-tg-hint w-14 flex-shrink-0">{e.date ? formatShort(e.date) : '—'}</span>
                          <span className="font-mono text-tg-hint w-16 flex-shrink-0 truncate">{e.mark}</span>
                          <span className="flex-1 min-w-0">
                            <span className="text-tg-text">{fmt(e.fact_qty)}</span>
                            <span className="text-tg-hint"> / {fmt(e.plan_qty)}</span>
                          </span>
                          {e.deviation !== null && e.deviation !== 0 && (
                            <span className={`text-2xs font-medium flex-shrink-0 ${e.deviation >= 0 ? 'text-status-green' : 'text-status-red'}`}>
                              {e.deviation > 0 ? '+' : ''}{e.deviation.toFixed(1)}
                            </span>
                          )}
                        </div>
                      ))}
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

/* ── Element Tracking (pipeline) ───────────────────────── */

const STAGE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  design: { text: 'text-tg-hint', bg: 'bg-tg-hint/10', border: 'border-l-tg-hint/30' },
  production_queue: { text: 'text-status-yellow', bg: 'bg-status-yellow/10', border: 'border-l-status-yellow/50' },
  in_production: { text: 'text-status-blue', bg: 'bg-status-blue/10', border: 'border-l-status-blue/50' },
  quality_check: { text: 'text-status-orange', bg: 'bg-status-orange/10', border: 'border-l-status-orange/50' },
  warehouse: { text: 'text-status-green', bg: 'bg-status-green/10', border: 'border-l-status-green/50' },
  shipped: { text: 'text-status-green', bg: 'bg-status-green/10', border: 'border-l-status-green/50' },
  installed: { text: 'text-status-green', bg: 'bg-status-green/10', border: 'border-l-status-green/50' },
};

const STAGE_ICONS: Record<string, string> = {
  design: '📐', production_queue: '⏳', in_production: '🏭',
  quality_check: '🔍', warehouse: '📦', shipped: '🚛', installed: '✅',
};

function TrackingView({ objectId }: { objectId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ['element-status', objectId],
    queryFn: () => api.get<any>(`/api/production-chain/${objectId}/element-status`),
  });
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  if (isLoading) return <Skeleton count={5} />;
  if (!data?.stages?.length) return <Empty text="Нет данных трекинга" />;

  const s = data.summary;

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-tg-text">Прогресс элементов</span>
          <span className="text-xs font-medium text-status-blue">{s.done}/{s.total}</span>
        </div>
        <div className="h-2 bg-tg-hint/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-status-blue transition-all duration-700"
            style={{ width: `${s.completion_pct}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2 text-2xs text-tg-hint">
          <span>В работе: {s.in_progress}</span>
          <span>Готово: {s.done}</span>
          {s.defects > 0 && (
            <span className="text-status-red flex items-center gap-0.5">
              <AlertTriangle size={10} /> Дефекты: {s.defects}
            </span>
          )}
        </div>
      </div>

      {/* Pipeline stages */}
      {data.stages.map((stage: any) => {
        const colors = STAGE_COLORS[stage.key] || STAGE_COLORS.design;
        const icon = STAGE_ICONS[stage.key] || '📋';
        const isOpen = expandedStage === stage.key;

        return (
          <div key={stage.key} className={`card border-l-4 ${colors.border}`}>
            <button
              onClick={() => setExpandedStage(isOpen ? null : stage.key)}
              className="w-full text-left touch-target"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-base">{icon}</span>
                  <div>
                    <span className="text-sm font-medium text-tg-text">{stage.label}</span>
                    <span className={`ml-2 text-xs font-semibold ${colors.text}`}>{stage.count}</span>
                  </div>
                </div>
                {stage.count > 0 && (
                  <ChevronDown
                    size={14}
                    className={`text-tg-hint transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                )}
              </div>
            </button>

            {isOpen && stage.items.length > 0 && (
              <div className="mt-3 pt-3 border-t border-tg-hint/10 space-y-1.5">
                {stage.items.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-2 py-1 text-xs">
                    <span className="font-mono text-tg-hint w-20 flex-shrink-0 truncate">{item.mark}</span>
                    <span className="text-tg-text flex-1 truncate" title={item.zone_name}>
                      {item.zone_name}
                    </span>
                    <span className="text-tg-hint flex-shrink-0">{item.quantity} шт</span>
                    {item.defect_count > 0 && (
                      <span className="badge-red flex-shrink-0">⚠ {item.defect_count}</span>
                    )}
                    <span className={`text-2xs font-medium flex-shrink-0 w-8 text-right ${
                      item.completion_pct >= 100 ? 'text-status-green'
                      : item.completion_pct >= 50 ? 'text-status-blue'
                      : 'text-tg-hint'
                    }`}>{item.completion_pct}%</span>
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

/* ── Shared components ─────────────────────────────────── */

function MiniProgress({ pct }: { pct: number }) {
  return (
    <div className="w-10 h-10 relative">
      <svg viewBox="0 0 36 36" className="w-10 h-10 transform -rotate-90">
        <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-tg-hint/10" />
        <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
          strokeDasharray={`${pct * 0.942} 100`} strokeLinecap="round" className="text-status-blue" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-2xs font-bold text-tg-text">{pct}%</span>
    </div>
  );
}

const BOM_STATUS: Record<string, { label: string; class: string }> = {
  draft: { label: 'Черновик', class: 'badge-gray' },
  approved: { label: 'Утверждён', class: 'badge-blue' },
  in_production: { label: 'В произв.', class: 'badge-yellow' },
  completed: { label: 'Готов', class: 'badge-green' },
};

function BOMStatusBadge({ status }: { status: string }) {
  const cfg = BOM_STATUS[status] || BOM_STATUS.draft;
  return <span className={`${cfg.class} flex-shrink-0`}>{cfg.label}</span>;
}

function Skeleton({ count }: { count: number }) {
  return <div className="space-y-2">{Array.from({ length: count }, (_, i) => <div key={i} className="card h-20 skeleton" />)}</div>;
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-tg-hint">
      <Factory size={36} className="mb-2 opacity-40" />
      <span className="text-sm">{text}</span>
    </div>
  );
}

function formatShort(d: string): string {
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function fmt(n: number): string {
  return n?.toLocaleString('ru-RU') ?? '0';
}
