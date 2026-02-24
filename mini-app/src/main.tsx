import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initTelegramWebApp } from "./lib/telegramWebApp";

// Telegram WebApp init
initTelegramWebApp();

// ── Регистрация Service Worker ───────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[SW] Registered:", reg.scope);

        // Слушаем обновление SW — показываем кнопку обновить
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent("sw-update-available"));
            }
          });
        });
      })
      .catch((e) => console.warn("[SW] Registration failed:", e));

    // Слушаем сообщения от SW (например, SYNC_REQUESTED)
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "SYNC_REQUESTED") {
        window.dispatchEvent(new CustomEvent("offline-sync-requested"));
      }
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
