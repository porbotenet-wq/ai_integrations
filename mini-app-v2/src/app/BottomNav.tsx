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
    <nav className="fixed bottom-0 left-0 right-0 bg-tg-secondary-bg border-t border-tg-separator z-50"
         style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = path === "/" ? pathname === "/" : pathname.startsWith(path);
          const showBadge = path === "/notifications" && unread > 0;

          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 relative transition-colors ${
                active ? "text-tg-button" : "text-tg-hint"
              }`}
            >
              <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium">{label}</span>
              {showBadge && (
                <span className="absolute -top-0.5 right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
