// ─── Date formatting ────────────────────────────────────
export function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateShort(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function formatDateTime(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function daysUntil(d: string | null): number | null {
  if (!d) return null;
  const diff = new Date(d).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

// ─── Status labels ──────────────────────────────────────
export const OBJECT_STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  planning: "Планирование",
  active: "Активный",
  on_hold: "Приостановлен",
  completing: "Завершение",
  closed: "Закрыт",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  new: "Новая",
  assigned: "Назначена",
  in_progress: "В работе",
  review: "На проверке",
  done: "Выполнена",
  overdue: "Просрочена",
  cancelled: "Отменена",
};

export const TASK_STATUS_COLORS: Record<string, string> = {
  new: "text-tg-hint",
  assigned: "text-yellow-400",
  in_progress: "text-blue-400",
  review: "text-orange-400",
  done: "text-green-400",
  overdue: "text-red-400",
  cancelled: "text-tg-hint",
};

export const PRIORITY_LABELS: Record<number, string> = {
  1: "Низкий",
  2: "Средний",
  3: "Высокий",
  4: "Критический",
};

export const GPR_STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  pending: "На согласовании",
  approved: "Утверждён",
  rejected: "Отклонён",
};

export const DEPARTMENT_LABELS: Record<string, string> = {
  design_opr: "ОПР",
  design_km: "КМ",
  design_kmd: "КМД",
  supply: "Снабжение",
  production: "Производство",
  construction: "Монтаж",
  safety: "Охрана труда",
  pto: "ПТО",
  contract: "Договорной",
};

export const SUPPLY_STATUS_LABELS: Record<string, string> = {
  ordered: "Заказано",
  in_transit: "В пути",
  delivered: "Доставлено",
  delayed: "Задержка",
  cancelled: "Отменено",
};

// ─── Colors ─────────────────────────────────────────────
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    active: "text-green-400",
    done: "text-green-400",
    delivered: "text-green-400",
    approved: "text-green-400",
    in_progress: "text-blue-400",
    in_transit: "text-blue-400",
    pending: "text-yellow-400",
    assigned: "text-yellow-400",
    review: "text-yellow-400",
    new: "text-tg-hint",
    draft: "text-tg-hint",
    planning: "text-tg-hint",
    overdue: "text-red-400",
    delayed: "text-red-400",
    rejected: "text-red-400",
    cancelled: "text-tg-hint",
    on_hold: "text-orange-400",
  };
  return map[status] || "text-tg-hint";
}

export function statusBgColor(status: string): string {
  const map: Record<string, string> = {
    active: "bg-green-400/10",
    done: "bg-green-400/10",
    in_progress: "bg-blue-400/10",
    overdue: "bg-red-400/10",
    delayed: "bg-red-400/10",
    new: "bg-tg-hint/10",
  };
  return map[status] || "bg-tg-hint/10";
}
