"use client";

// Settings → Notifications, this device's part: turn phone/browser
// notifications on or off and send a test one. The service worker
// (public/sw.js) shows them; lib/notify/owner.ts decides when.

import { useEffect, useState, useTransition } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/lib/notify/push-actions";

type DeviceState = "checking" | "unsupported" | "ios_install" | "denied" | "off" | "on";

/** The VAPID public key (base64url) as the bytes PushManager wants. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

export default function PushDevice({
  publicKey,
  labels,
}: {
  publicKey: string;
  labels: Record<string, string>;
}) {
  const [state, setState] = useState<DeviceState>("checking");
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        // An iPhone only offers notifications to the app added to its home screen.
        if (!cancelled) setState(isIos() && !isStandalone() ? "ios_install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const current = await registration.pushManager.getSubscription();
        if (!cancelled) setState(current ? "on" : "off");
      } catch {
        if (!cancelled) setState("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const turnOn = () =>
    start(async () => {
      setNote(null);
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
        const json = subscription.toJSON();
        const saved = await savePushSubscription({
          endpoint: subscription.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          userAgent: navigator.userAgent,
        });
        setState(saved.ok ? "on" : "off");
        if (!saved.ok) setNote(labels.notify_push_failed);
      } catch {
        setNote(labels.notify_push_failed);
      }
    });

  const turnOff = () =>
    start(async () => {
      setNote(null);
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe().catch(() => false);
      }
      setState("off");
    });

  const test = () =>
    start(async () => {
      const { sent } = await sendTestPush();
      setNote(sent > 0 ? labels.notify_test_sent : labels.notify_push_failed);
    });

  const hint =
    state === "unsupported"
      ? labels.notify_push_unsupported
      : state === "ios_install"
        ? labels.notify_push_ios
        : state === "denied"
          ? labels.notify_push_denied
          : state === "on"
            ? labels.notify_push_on
            : labels.notify_push_hint;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span style={{ color: "var(--color-text-muted)" }}>
        {labels.notify_push}
        <span className="field-hint" style={{ display: "block", margin: "2px 0 0" }}>
          {hint}
        </span>
        {note && (
          <span role="status" className="field-hint" style={{ display: "block", margin: "2px 0 0" }}>
            {note}
          </span>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {state === "on" && (
          <>
            <button type="button" className="btn-chip" onClick={test} disabled={pending}>
              {labels.notify_test}
            </button>
            <button type="button" className="btn-secondary" onClick={turnOff} disabled={pending}>
              {labels.notify_push_off}
            </button>
          </>
        )}
        {state === "off" && (
          <button type="button" className="btn-secondary" onClick={turnOn} disabled={pending}>
            {labels.notify_push_turn_on}
          </button>
        )}
      </span>
    </div>
  );
}
