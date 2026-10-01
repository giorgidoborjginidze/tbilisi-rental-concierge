"use client";

// A device's notifications belong to the sign-in that turned them on
// (prisma/schema.prisma PushSubscription.sessionId): signing out ends them.
// When the same browser signs in again with notifications still allowed,
// this links the device to the new sign-in, once per visit.

import { useEffect } from "react";
import { savePushSubscription } from "@/lib/notify/push-actions";

/** `tag`: a few characters of this sign-in, so a new sign-in links again. */
export default function PushRelink({ tag }: { tag: string }) {
  const KEY = `activo-push-linked:${tag}`;
  useEffect(() => {
    (async () => {
      try {
        if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
        if (Notification.permission !== "granted" || sessionStorage.getItem(KEY)) return;
        const registration = await navigator.serviceWorker.getRegistration("/sw.js");
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription) return;
        const json = subscription.toJSON();
        const saved = await savePushSubscription({
          endpoint: subscription.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          userAgent: navigator.userAgent,
        });
        if (saved.ok) sessionStorage.setItem(KEY, "1");
      } catch {
        // Nothing to do: Settings → Notifications can turn them on again.
      }
    })();
  }, [KEY]);
  return null;
}
