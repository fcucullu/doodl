/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

// Update badge by calling the badge API
async function updateBadge() {
  try {
    const authId = await getStoredValue("doodl_auth_id");
    let url: string;
    if (authId) {
      url = `/api/badge?authId=${authId}`;
    } else {
      const userId = await getStoredValue("doodl_user_id");
      const roomId = await getStoredValue("doodl_room_id");
      if (!userId || !roomId) return;
      url = `/api/badge?userId=${userId}&roomId=${roomId}`;
    }

    const response = await fetch(url);
    if (!response.ok) return;
    const { count } = await response.json();

    if ("setAppBadge" in navigator) {
      if (count > 0) {
        await (navigator as any).setAppBadge(count);
      } else {
        await (navigator as any).clearAppBadge();
      }
    }
  } catch {}
}

function getStoredValue(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    self.clients.matchAll({ type: "window" }).then((clients) => {
      if (clients.length === 0) { resolve(null); return; }
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => resolve(event.data);
      clients[0].postMessage({ type: "get-storage", key }, [channel.port2]);
      setTimeout(() => resolve(null), 2000);
    });
  });
}

// Push notification handler
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || "Nuevo doodle!",
    icon: data.icon || "/icon-192.png",
    badge: "/icon-192.png",
    image: data.image,
    data: { url: data.url || "/feed" },
    vibrate: [200, 100, 200],
  } as any;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || "Doodl", options),
      updateBadge(),
    ])
  );
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/feed";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});

// Periodic background sync
self.addEventListener("periodicsync", (event: any) => {
  if (event.tag === "update-badge") {
    event.waitUntil(updateBadge());
  }
});

// Register periodic sync on activate
self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      (self.registration as any).periodicSync
        ? (self.registration as any).periodicSync.register("update-badge", {
            minInterval: 24 * 60 * 60 * 1000,
          }).catch(() => {})
        : Promise.resolve(),
    ])
  );
});

// Message handler
self.addEventListener("message", (event) => {
  if (event.data === "update-badge") {
    event.waitUntil(updateBadge());
  }
});
