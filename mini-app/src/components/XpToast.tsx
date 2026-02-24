import { useState, useEffect } from "react";

interface XpToastProps {
  xp: number;
  action: string;
  onDone: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  daily_report: "Ежедневный отчёт",
  photo_upload: "Фото загружено",
  alert_created: "Алерт создан",
  alert_resolved: "Алерт закрыт",
  plan_fact_entry: "План-факт",
  task_completed: "Задача выполнена",
  document_upload: "Документ загружен",
  login_streak: "Вход",
  onboarding_passed: "Онбординг пройден",
};

const XpToast = ({ xp, action, onDone }: XpToastProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 300);
    }, 2500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      className={`fixed top-14 right-3 z-[9999] flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground shadow-lg transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3"
      }`}
    >
      <span className="text-sm">⭐</span>
      <div>
        <div className="text-[11px] font-bold">+{xp} XP</div>
        <div className="text-[8px] opacity-80">{ACTION_LABELS[action] || action}</div>
      </div>
    </div>
  );
};

export default XpToast;
