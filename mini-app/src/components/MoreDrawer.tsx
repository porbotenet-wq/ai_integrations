// src/components/MoreDrawer.tsx
// MONOLITH v3.0 — Bottom drawer for additional tabs
import {
  CreditCard, BarChart3, Users, Package, Calendar as CalendarIcon,
  Workflow, CheckCircle, Sheet, FileText, Settings, Sparkles, Award,
  User, UsersRound
} from "lucide-react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { getAllowedTabs } from "@/data/roleConfig";

interface ExtraTab {
  id: string;
  label: string;
  icon?: string;
}

interface MoreDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
  showProjectCard?: boolean;
  userRoles?: string[];
  extraTabs?: ExtraTab[];
}

const MORE_TABS = [
  { id: "card", label: "Объект", icon: CreditCard },
  { id: "pf", label: "План-Факт", icon: BarChart3 },
  { id: "crew", label: "Бригады", icon: Users },
  { id: "sup", label: "Снабжение", icon: Package },
  { id: "gpr", label: "ГПР", icon: CalendarIcon },
  { id: "wflow", label: "Процессы", icon: Workflow },
  { id: "appr", label: "Согласования", icon: CheckCircle },
  { id: "sheets", label: "Sheets", icon: Sheet },
  { id: "docs", label: "Документы", icon: FileText },
  { id: "cal", label: "Календарь", icon: CalendarIcon },
  { id: "settings", label: "Настройки", icon: Settings },
];

// These are already in bottom bar
const BOTTOM_IDS = ["dash", "floors", "logs", "alerts"];

const MoreDrawer = ({ open, onOpenChange, activeTab, onTabChange, showProjectCard, userRoles, extraTabs }: MoreDrawerProps) => {
  const allowedTabs = getAllowedTabs(userRoles || []);

  const filteredTabs = MORE_TABS.filter((t) => {
    if (BOTTOM_IDS.includes(t.id)) return false;
    if (t.id === "card" && !showProjectCard) return false;
    if (allowedTabs && !allowedTabs.includes(t.id)) return false;
    return true;
  });

  const extraMapped = (extraTabs || []).map((t) => ({
    id: t.id,
    label: t.label,
    icon: Sparkles,
  }));

  const systemTabs = [
    { id: "team", label: "Команда", icon: UsersRound },
    { id: "profile", label: "Профиль", icon: User },
    { id: "report", label: "Отчёт", icon: FileText },
    { id: "xp", label: "XP", icon: Award },
  ];

  const allTabs = [...filteredTabs, ...extraMapped, ...systemTabs];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="bg-[hsl(var(--bg0)/0.95)] backdrop-blur-[20px] border-border">
        <div className="p-4 pb-8">
          <div className="grid grid-cols-3 gap-2">
            {allTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex flex-col items-center justify-center gap-1.5 min-h-[56px] rounded-xl border transition-all duration-150 active:scale-[0.97] ${
                    isActive
                      ? "bg-[hsl(var(--green-dim))] border-primary/25 text-primary"
                      : "bg-bg1 border-border text-t2 hover:text-t1 hover:border-[rgba(255,255,255,0.1)]"
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-[10px] font-semibold">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MoreDrawer;
