// src/components/QuickActions.tsx
// MONOLITH v3.0 — Role-specific 2×2 action grid
import {
  Camera, FileText, AlertTriangle, TrendingUp,
  Inbox, CheckCircle, BarChart3,
  Building2, DollarSign,
  Package, Send
} from "lucide-react";

interface Props {
  role: string;
  onAction: (tab: string) => void;
}

interface ActionItem {
  icon: React.ElementType;
  title: string;
  sub: string;
  tab: string;
  color: string;
  dimBg: string;
}

const ACTIONS: Record<string, ActionItem[]> = {
  foreman: [
    { icon: Camera, title: "Фото", sub: "Фотоотчёт", tab: "ai", color: "text-primary", dimBg: "bg-[hsl(var(--green-dim))]" },
    { icon: FileText, title: "Отчёт", sub: "Дневной", tab: "logs", color: "text-blue-400", dimBg: "bg-[hsl(var(--blue-dim))]" },
    { icon: AlertTriangle, title: "Алерт", sub: "Создать", tab: "alerts", color: "text-destructive", dimBg: "bg-[hsl(var(--red-dim))]" },
    { icon: TrendingUp, title: "Прогресс", sub: "Монтаж", tab: "pf", color: "text-amber-500", dimBg: "bg-[hsl(var(--amber-dim))]" },
  ],
  pm: [
    { icon: Inbox, title: "Входящие", sub: "Документы", tab: "docs", color: "text-primary", dimBg: "bg-[hsl(var(--green-dim))]" },
    { icon: CheckCircle, title: "Согласования", sub: "Ожидают", tab: "appr", color: "text-amber-500", dimBg: "bg-[hsl(var(--amber-dim))]" },
    { icon: AlertTriangle, title: "Алерт", sub: "Создать", tab: "alerts", color: "text-destructive", dimBg: "bg-[hsl(var(--red-dim))]" },
    { icon: BarChart3, title: "ГПР", sub: "График", tab: "gpr", color: "text-blue-400", dimBg: "bg-[hsl(var(--blue-dim))]" },
  ],
  director: [
    { icon: Building2, title: "Портфель", sub: "Проекты", tab: "dash", color: "text-primary", dimBg: "bg-[hsl(var(--green-dim))]" },
    { icon: TrendingUp, title: "KPI", sub: "Показатели", tab: "pf", color: "text-blue-400", dimBg: "bg-[hsl(var(--blue-dim))]" },
    { icon: AlertTriangle, title: "Критичное", sub: "Алерты", tab: "alerts", color: "text-destructive", dimBg: "bg-[hsl(var(--red-dim))]" },
    { icon: DollarSign, title: "Финансы", sub: "План/Факт", tab: "pf", color: "text-amber-500", dimBg: "bg-[hsl(var(--amber-dim))]" },
  ],
  supply: [
    { icon: Package, title: "Статус", sub: "Закупки", tab: "sup", color: "text-primary", dimBg: "bg-[hsl(var(--green-dim))]" },
    { icon: AlertTriangle, title: "Дефицит", sub: "Позиции", tab: "sup", color: "text-destructive", dimBg: "bg-[hsl(var(--red-dim))]" },
    { icon: Inbox, title: "Входящие", sub: "Документы", tab: "docs", color: "text-blue-400", dimBg: "bg-[hsl(var(--blue-dim))]" },
    { icon: Send, title: "Отправить", sub: "Документ", tab: "docs", color: "text-amber-500", dimBg: "bg-[hsl(var(--amber-dim))]" },
  ],
};

const QuickActions = ({ role, onAction }: Props) => {
  // Resolve role to action set
  const resolvedRole = ["foreman1", "foreman2", "foreman3"].includes(role) ? "foreman" : role;
  const actions = ACTIONS[resolvedRole] || ACTIONS.pm;

  return (
    <div>
      <p className="section-label">Быстрые действия</p>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a, i) => {
          const Icon = a.icon;
          return (
            <button
              key={a.tab + a.title}
              onClick={() => onAction(a.tab)}
              className="stagger-item min-h-[64px] bg-bg1 border border-border rounded-xl p-3 flex items-center gap-3 text-left transition-all duration-150 active:scale-[0.97] hover:border-[rgba(255,255,255,0.1)]"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className={`w-10 h-10 rounded-[10px] ${a.dimBg} flex items-center justify-center flex-shrink-0`}>
                <Icon size={20} className={a.color} />
              </div>
              <div>
                <div className="text-[12px] font-bold text-t1">{a.title}</div>
                <div className="text-[9px] text-t3">{a.sub}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuickActions;
