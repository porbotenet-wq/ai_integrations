import { useState } from "react";
import { X, Download, Share, Plus } from "lucide-react";
import { usePWA } from "@/hooks/usePWA";

const InstallPWA = () => {
  const { showBanner, isIOS, isInstalled, isTelegram, promptInstall, dismissInstall } = usePWA();
  const [installing, setInstalling] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (!showBanner || isInstalled || isTelegram) return null;

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    setInstalling(true);
    await promptInstall();
    setInstalling(false);
  };

  // ── iOS — инструкция ────────────────────────────────────
  if (showIOSGuide) {
    return (
      <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-end">
        <div className="w-full bg-card border-t border-border rounded-t-2xl p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[13px] font-bold text-foreground">Добавить на экран «Домой»</div>
            <button onClick={dismissInstall} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <span className="text-[11px] font-bold text-primary">1</span>
              </div>
              <div className="flex-1">
                <div className="text-[11px] font-semibold text-foreground">Нажмите кнопку «Поделиться»</div>
                <div className="text-[9px] text-muted-foreground mt-0.5">Иконка <Share size={10} className="inline" /> внизу экрана в Safari</div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                <Share size={14} className="text-blue-400" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <span className="text-[11px] font-bold text-primary">2</span>
              </div>
              <div className="flex-1">
                <div className="text-[11px] font-semibold text-foreground">Выберите «На экран «Домой»»</div>
                <div className="text-[9px] text-muted-foreground mt-0.5">Прокрутите список действий вниз</div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Plus size={14} className="text-primary" />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <span className="text-[11px] font-bold text-primary">3</span>
              </div>
              <div className="flex-1">
                <div className="text-[11px] font-semibold text-foreground">Нажмите «Добавить»</div>
                <div className="text-[9px] text-muted-foreground mt-0.5">STSphera появится на рабочем столе</div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-[16px]">
                🏗️
              </div>
            </div>
          </div>

          <button
            onClick={dismissInstall}
            className="w-full mt-4 py-3 rounded-xl bg-muted text-muted-foreground text-[11px] font-semibold"
          >
            Понятно
          </button>
        </div>
      </div>
    );
  }

  // ── Android / Desktop — нативный баннер ─────────────────
  return (
    <div className="fixed bottom-[70px] left-3 right-3 z-[200] animate-fade-in">
      <div className="bg-card border border-primary/25 rounded-2xl p-3.5 shadow-xl shadow-black/40">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-emerald-600/20 border border-primary/30 flex items-center justify-center text-2xl flex-shrink-0">
            🏗️
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-bold text-foreground">Установить STSphera</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">
              Быстрый доступ с рабочего стола · Работает офлайн
            </div>
          </div>

          <button
            onClick={dismissInstall}
            className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0"
          >
            <X size={12} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex gap-2 mt-2.5 mb-3">
          {["📵 Офлайн", "⚡ Быстро", "🔔 Уведомления"].map((f) => (
            <div key={f} className="px-2 py-1 rounded-md bg-muted border border-border text-[9px] text-muted-foreground">
              {f}
            </div>
          ))}
        </div>

        <button
          onClick={handleInstall}
          disabled={installing}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50"
        >
          <Download size={14} />
          {installing ? "Установка..." : "Установить приложение"}
        </button>
      </div>
    </div>
  );
};

export default InstallPWA;
