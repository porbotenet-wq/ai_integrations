// src/components/TabBar.tsx
// MONOLITH v3.0 — Fixed bottom navigation with LED indicators
import { LayoutDashboard, Building2, ClipboardList, Bell, LayoutGrid } from "lucide-react";
import { getAllowedTabs } from "@/data/roleConfig";

interface ExtraTab {
  id: string;
  label: string;
  icon?: string;
}

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  showProjectCard?: boolean;
  userRoles?: string[];
  extraTabs?: ExtraTab[];
  alertsCount?: number;
}

const BOTTOM_TABS = [
  { id: "dash", label: "Дашборд", icon: LayoutDashboard },
  { id: "floors", label: "Этажи", icon: Building2 },
  { id: "logs", label: "Задачи", icon: ClipboardList },
  { id: "alerts", label: "Алерты", icon: Bell },
];

const TabBar = ({ activeTab, onTabChange, showProjectCard, userRoles, extraTabs, alertsCount }: TabBarProps) => {
  const allowedTabs = getAllowedTabs(userRoles || []);

  const visibleBottom = BOTTOM_TABS.filter((t) => {
    if (allowedTabs && !allowedTabs.includes(t.id)) return false;
    return true;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[hsl(var(--bg0)/0.92)] backdrop-blur-[20px] border-t border-border"
      style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center justify-around px-2 pt-1.5">
        {visibleBottom.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center gap-0.5 min-w-[56px] py-1.5 transition-all duration-150 active:scale-[0.97]"
            >
              {/* LED indicator top */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full bg-primary shadow-[0_0_6px_hsl(var(--green-glow))]" />
              )}
              <div className="relative">
                <Icon size={22} className={isActive ? "text-primary" : "text-t3"} />
                {/* Badge for alerts */}
                {tab.id === "alerts" && alertsCount != null && alertsCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-destructive flex items-center justify-center text-[8px] font-bold text-white">
                    {alertsCount > 9 ? "9+" : alertsCount}
                  </span>
                )}
              </div>
              <span className={`text-[9px] font-semibold ${isActive ? "text-primary" : "text-t3"}`}>
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* Menu button (replaces More drawer) */}
        <button
          onClick={() => onTabChange("menu")}
          className="relative flex flex-col items-center gap-0.5 min-w-[56px] py-1.5 transition-all duration-150 active:scale-[0.97]"
        >
          {activeTab === "menu" && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full bg-primary shadow-[0_0_6px_hsl(var(--green-glow))]" />
          )}
          <LayoutGrid size={22} className={activeTab === "menu" ? "text-primary" : "text-t3"} />
          <span className={`text-[9px] font-semibold ${activeTab === "menu" ? "text-primary" : "text-t3"}`}>
            Меню
          </span>
        </button>
      </div>
    </nav>
  );
};

export default TabBar;
