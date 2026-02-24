import { useNavigate, useLocation } from "react-router-dom";
import { Home, Bell, User } from "lucide-react";
import { useNotificationSummary } from "@/shared/api";

const tabs = [
  { path: "/", icon: Home, label: "Главная" },
  { path: "/notifications", icon: Bell, label: "Уведомления" },
  { path: "/profile", icon: User, label: "Профиль" },
];

export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: summary } = useNotificationSummary();
  const unread = summary?.total_unread || 0;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50"
         style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      {/* LED accent line */}
      <div className="led-accent" />
      <div className="bg-surface-1/95 backdrop-blur-xl border-t border-surface-3">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {tabs.map(({ path, icon: Icon, label }) => {
            const active = path === "/" ? pathname === "/" : pathname.startsWith(path);
            const showBadge = path === "/notifications" && unread > 0;

            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex flex-col items-center gap-0.5 px-6 py-2 relative transition-all duration-200 touch-target ${
                  active ? "text-status-blue" : "text-tg-hint"
                }`}
              >
                <div className="relative">
                  <Icon size={22} strokeWidth={active ? 2.2 : 1.6} />
                  {active && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-status-blue" />
                  )}
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-status-red text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] transition-all ${active ? "font-semibold" : "font-medium"}`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
