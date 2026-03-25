/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

// Update badge by calling the badge API
async function updateBadge() {
  try {
    // Try auth_id first for multi-room, fall back to single room
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

// Read localStorage values via client messaging
function getStoredValue(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    // Try to get from a connected client
    self.clients.matchAll({ type: "window" }).then((clients) => {
      if (clients.length === 0) {
        resolve(null);
        return;
      }
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => resolve(event.data);
      clients[0].postMessage({ type: "get-storage", key }, [channel.port2]);
      // Timeout after 2s
      setTimeout(() => resolve(null), 2000);
    });
  });
}

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
  // Respond to storage requests from the SW
  if (event.data?.type === "get-storage" && event.ports[0]) {
    // This is handled by the client, not the SW
  }
});
