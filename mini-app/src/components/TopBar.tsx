// src/components/TopBar.tsx
// MONOLITH v3.0 — Command center top bar, frosted concrete surface
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import TelegramChats from "@/components/TelegramChats";

interface TopBarAction {
  icon: string;
  label: string;
  onClick: () => void;
}

interface TopBarProps {
  projectName?: string;
  projectId?: string;
  onBackToProjects?: () => void;
  extraActions?: TopBarAction[];
}

const TopBar = ({ projectName, projectId, onBackToProjects, extraActions }: TopBarProps) => {
  const { displayName, signOut } = useAuth();
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const n = new Date();
      setTime(
        n.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) +
          " · " +
          n.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
      );
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="sticky top-0 z-50 h-14 bg-[hsl(var(--bg0)/0.85)] backdrop-blur-[20px] border-b border-border px-4 flex items-center justify-between">
      {/* Left: back + brand + project */}
      <div className="flex items-center gap-2.5 min-w-0">
        {onBackToProjects && (
          <button
            onClick={onBackToProjects}
            className="w-9 h-9 rounded-[10px] bg-bg2 border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-all duration-150 active:scale-[0.97] flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}

        {/* Brand mark */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-[10px] bg-[hsl(var(--green-dim))] border border-primary/20 flex items-center justify-center">
            <span className="text-primary font-mono text-[11px] font-bold">S</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[14px] font-bold tracking-tight leading-none">СФЕРА</span>
            {projectName && (
              <span className="text-[10px] text-t3 truncate max-w-[120px] leading-tight mt-0.5">
                {projectName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: actions + live + user */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {extraActions && extraActions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            title={action.label}
            className="w-9 h-9 rounded-[10px] bg-bg2 border border-border flex items-center justify-center text-[13px] hover:border-primary/30 transition-all duration-150 active:scale-[0.97]"
          >
            {action.icon}
          </button>
        ))}

        {/* LIVE indicator */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-bg2/50">
          <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--green-glow))] animate-pulse-dot" />
          <span className="font-mono text-[10px] text-t2">{time}</span>
        </div>

        {projectId && <TelegramChats projectId={projectId} />}

        {displayName && (
          <span className="text-[10px] text-t3 truncate max-w-[60px] hidden sm:block">
            {displayName}
          </span>
        )}

        <button
          onClick={signOut}
          className="w-9 h-9 rounded-[10px] bg-bg2 border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-all duration-150 active:scale-[0.97]"
          title="Выйти"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TopBar;
