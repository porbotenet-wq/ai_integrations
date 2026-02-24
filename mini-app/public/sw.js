// public/sw.js — STSphera Service Worker v2 (PWA)
// Service Worker — кэш статики и офлайн-страница

const CACHE_NAME = "stsphera-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
];

// ─── Установка: кэшируем статику ──────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ─── Активация: удаляем старые кэши ──────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch: stale-while-revalidate для статики ────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Supabase API — только сеть, без кэша SW
  if (url.hostname.includes("supabase.co") || url.hostname.includes("supabase.in")) {
    return;
  }

  // Telegram API — только сеть
  if (url.hostname.includes("api.telegram.org")) {
    return;
  }

  // Статика — cache first, затем сеть
  if (
    event.request.method === "GET" &&
    (url.pathname.match(/\.(js|css|woff2?|png|ico|svg)$/) ||
      url.pathname === "/" ||
      url.pathname === "/index.html")
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const network = fetch(event.request).then((fresh) => {
          const clone = fresh.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          return fresh;
        });
        return cached || network;
      })
    );
    return;
  }

  // Остальное — network first
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) => cached || new Response("Офлайн", { status: 503 }))
    )
  );
});

// ─── Push-уведомления от Telegram бота ───────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "STSphera", {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-72.png",
      tag: data.tag || "stsphera",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url.includes(self.location.origin));
        if (existing) {
          existing.focus();
          existing.navigate(url);
        } else {
          self.clients.openWindow(url);
        }
      })
  );
});
