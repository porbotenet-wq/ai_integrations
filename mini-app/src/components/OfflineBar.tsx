import { useState, useEffect } from "react";
import { WifiOff, RefreshCw } from "lucide-react";

interface OfflineBarProps {
  projectId?: string;
}

const OfflineBar = ({ projectId }: OfflineBarProps) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };
    const goOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={`sticky top-0 z-[999] px-3 py-1.5 flex items-center justify-center gap-2 text-[10px] font-semibold transition-colors ${
        isOnline
          ? "bg-primary/15 text-primary"
          : "bg-destructive/15 text-destructive"
      }`}
    >
      {isOnline ? (
        <>
          <RefreshCw size={11} className="animate-spin" />
          Соединение восстановлено — синхронизация…
        </>
      ) : (
        <>
          <WifiOff size={11} />
          Нет подключения — работаем офлайн
        </>
      )}
    </div>
  );
};

export default OfflineBar;
