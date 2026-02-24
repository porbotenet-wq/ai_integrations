// src/hooks/usePWA.ts
// Хук для управления установкой PWA
// Определяет: уже установлено, можно установить, iOS/Android

import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  prompt(): Promise<void>;
}

interface PWAState {
  isInstalled: boolean;
  canInstall: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isTelegram: boolean;
  promptInstall: () => Promise<boolean>;
  dismissInstall: () => void;
  showBanner: boolean;
}

const DISMISSED_KEY = "pwa_install_dismissed";

export function usePWA(): PWAState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/.test(ua);
  const isTelegram = typeof (window as any).Telegram?.WebApp !== "undefined";

  const isInstalled =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes("android-app://");

  useEffect(() => {
    if (isInstalled || isTelegram || localStorage.getItem(DISMISSED_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // iOS — показываем баннер вручную
    if (isIOS && !isInstalled) {
      const visitCount = parseInt(localStorage.getItem("pwa_visit_count") || "0") + 1;
      localStorage.setItem("pwa_visit_count", String(visitCount));
      if (visitCount === 2 || visitCount === 5) {
        setShowBanner(true);
      }
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isInstalled, isIOS, isTelegram]);

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowBanner(false);
    if (outcome === "accepted") {
      localStorage.setItem(DISMISSED_KEY, "1");
    }
    return outcome === "accepted";
  };

  const dismissInstall = () => {
    setShowBanner(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  return {
    isInstalled,
    canInstall: !!deferredPrompt || isIOS,
    isIOS,
    isAndroid,
    isTelegram,
    promptInstall,
    dismissInstall,
    showBanner,
  };
}
