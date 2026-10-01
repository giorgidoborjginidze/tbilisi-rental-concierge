"use server";

// Settings → Notifications: this device's push subscription, the email
// switch, and a test notification so the owner sees it work.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { currentSessionId, requirePerson, requireWriter } from "@/lib/auth/session";
import { asLocale, t } from "@/lib/i18n/strings";
import { pushConfig, webPushSender } from "./owner";
import { isPushEndpoint } from "./push-endpoint";

export interface DeviceSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

const KEY = /^[A-Za-z0-9_-]{8,200}={0,2}$/;
/** Devices one workspace keeps; the oldest goes when a new one comes. */
const MAX_DEVICES = 30;

// Every person of a team may get the workspace's notifications, a
// view-only member too: the device is kept under the workspace, tied to
// the person and to this sign-in (prisma/schema.prisma PushSubscription).
export async function savePushSubscription(device: DeviceSubscription): Promise<{ ok: boolean }> {
  const operator = await requirePerson();
  const endpoint = String(device?.endpoint ?? "");
  const p256dh = String(device?.p256dh ?? "");
  const auth = String(device?.auth ?? "");
  if (!isPushEndpoint(endpoint) || !KEY.test(p256dh) || !KEY.test(auth)) return { ok: false };
  const userAgent = String(device?.userAgent ?? "").slice(0, 200) || null;
  const sessionId = await currentSessionId();
  const link = { operatorId: operator.id, userId: operator.userId, sessionId, p256dh, auth, userAgent };
  // A device signed in to another account before now belongs to this one.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, ...link },
    update: link,
  });
  const extra = await prisma.pushSubscription.findMany({
    where: { operatorId: operator.id },
    orderBy: { createdAt: "desc" },
    skip: MAX_DEVICES,
    select: { id: true },
  });
  if (extra.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: extra.map((row) => row.id) } } });
  revalidatePath("/settings");
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const operator = await requirePerson();
  await prisma.pushSubscription.deleteMany({ where: { operatorId: operator.id, endpoint: String(endpoint ?? "") } });
  revalidatePath("/settings");
  return { ok: true };
}

/** One notification to every device of this account; how many took it. */
const lastTest = new Map<string, number>();
const TEST_GAP_MS = 20_000;

export async function sendTestPush(): Promise<{ sent: number }> {
  const operator = await requirePerson();
  const cfg = pushConfig();
  if (!cfg) return { sent: 0 };
  // One test at a time per person.
  const now = Date.now();
  if (now - (lastTest.get(operator.userId) ?? 0) < TEST_GAP_MS) return { sent: 0 };
  lastTest.set(operator.userId, now);
  const locale = asLocale(operator.locale);
  // The person's own devices.
  const targets = await prisma.pushSubscription.findMany({
    where: { operatorId: operator.id, OR: [{ userId: operator.userId }, { userId: null }] },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    targets.map(async (target) => {
      const status = await webPushSender(
        target,
        { tag: "activo-test", title: t(locale, "notify_test_title"), body: t(locale, "notify_test_body"), url: "/settings#notifications" },
        cfg,
      );
      if (status === 404 || status === 410) gone.push(target.id);
      else if (status >= 200 && status < 300) sent += 1;
    }),
  );
  if (gone.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
  return { sent };
}

/** The workspace's email alerts go to the owner's address: the owner decides. */
export async function setNotifyEmail(formData: FormData) {
  const operator = await requireWriter();
  if (operator.companyId) return;
  await prisma.operator.update({
    where: { id: operator.id },
    data: { notifyEmail: formData.get("notifyEmail") === "on" },
  });
  revalidatePath("/settings");
}
