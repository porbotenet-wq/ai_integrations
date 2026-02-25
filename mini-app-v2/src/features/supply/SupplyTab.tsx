import { useSupply } from '@/shared/api';
import {
  formatDateShort, daysUntil,
  SUPPLY_STATUS_LABELS, statusColor,
} from '@/shared/lib/format';
import { Truck, Clock, AlertTriangle, Package } from 'lucide-react';

interface Props {
  objectId: number;
}

export function SupplyTab({ objectId }: Props) {
  const { data: orders, isLoading } = useSupply(objectId);

  if (isLoading) return <SupplySkeleton />;
  if (!orders || orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-tg-hint">
        <Package size={36} className="mb-2 opacity-40" />
        <span className="text-sm">Нет заявок на поставку</span>
      </div>
    );
  }

  const delayed = orders.filter((o) => o.status === 'delayed');
  const inTransit = orders.filter((o) => o.status === 'in_transit');
  const other = orders.filter((o) => o.status !== 'delayed' && o.status !== 'in_transit');

  return (
    <div className="space-y-3">
      {/* Delayed alert */}
      {delayed.length > 0 && (
        <div className="card ring-1 ring-status-red/20 bg-status-red/5">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-status-red" />
            <span className="text-xs font-semibold text-status-red">
              Задержки: {delayed.length}
            </span>
          </div>
          <div className="space-y-2">
            {delayed.map((o) => (
              <SupplyCard key={o.id} order={o} />
            ))}
          </div>
        </div>
      )}

      {/* In transit */}
      {inTransit.length > 0 && (
        <>
          <div className="section-header mt-0">В пути ({inTransit.length})</div>
          {inTransit.map((o) => (
            <SupplyCard key={o.id} order={o} />
          ))}
        </>
      )}

      {/* Other */}
      {other.length > 0 && (
        <>
          <div className="section-header mt-0">Все заявки ({other.length})</div>
          {other.map((o) => (
            <SupplyCard key={o.id} order={o} />
          ))}
        </>
      )}
    </div>
  );
}

function SupplyCard({ order }: { order: any }) {
  const days = daysUntil(order.expected_date);
  const isLate = order.status === 'delayed' || (days !== null && days < 0 && order.status !== 'delivered');

  return (
    <div className={`card border-l-4 ${isLate ? 'border-l-status-red' : 'border-l-tg-hint/20'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-tg-text truncate">
            {order.material || order.material_name}
          </h4>
          <div className="flex items-center gap-2 mt-1 text-2xs text-tg-hint">
            <span>{order.quantity} {order.unit}</span>
            {order.supplier && (
              <>
                <span>·</span>
                <span className="truncate">{order.supplier}</span>
              </>
            )}
          </div>
        </div>
        <span className={`text-xs font-medium ${statusColor(order.status)}`}>
          {SUPPLY_STATUS_LABELS[order.status] || order.status}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-2 text-2xs text-tg-hint">
        {order.expected_date && (
          <span className={`flex items-center gap-0.5 ${isLate ? 'text-status-red font-medium' : ''}`}>
            <Clock size={10} />
            Ожид. {formatDateShort(order.expected_date)}
          </span>
        )}
        {order.actual_date && (
          <span className="flex items-center gap-0.5 text-status-green">
            <Truck size={10} />
            Факт. {formatDateShort(order.actual_date)}
          </span>
        )}
      </div>
    </div>
  );
}

function SupplySkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => <div key={i} className="card h-20 skeleton" />)}
    </div>
  );
}
