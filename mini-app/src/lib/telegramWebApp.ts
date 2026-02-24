// Telegram WebApp SDK helper
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
          auth_date: number;
          hash: string;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
        };
        BackButton: {
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
        };
        themeParams: Record<string, string>;
        colorScheme: "light" | "dark";
        platform: string;
      };
    };
  }
}

export const tg = window.Telegram?.WebApp;

export const isTelegramWebApp = !!tg?.initData;

export function getTelegramUser() {
  return tg?.initDataUnsafe?.user || null;
}

export function getTelegramInitData(): string {
  return tg?.initData || "";
}

// Обёртка для fetch с Telegram initData
export async function tgFetch(url: string, options: RequestInit = {}) {
  const initData = getTelegramInitData();
  const headers = new Headers(options.headers);

  if (initData) {
    headers.set("x-telegram-init-data", initData);
  }

  return fetch(url, { ...options, headers });
}

// Инициализация при старте Mini App
export function initTelegramWebApp() {
  if (tg) {
    tg.ready();
    tg.expand();
  }
}
