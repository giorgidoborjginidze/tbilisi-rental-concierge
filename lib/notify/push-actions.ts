"use server";

// Settings → Notifications: this device's push subscription, the email
// switch, and a test notification so the owner sees it work.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePerson, requireWriter } from "@/lib/auth/session";
import { asLocale, t } from "@/lib/i18n/strings";
import { pushConfig, webPushSender } from "./owner";

export interface DeviceSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

/** Push services hand out https addresses; anything else is refused. */
const validEndpoint = (value: string) => {
  try {
    return new URL(value).protocol === "https:" && value.length <= 1000;
  } catch {
    return false;
  }
};
const KEY = /^[A-Za-z0-9_-]{8,200}={0,2}$/;

// Every person of a team may get the workspace's notifications, a
// view-only member too: the device is kept under the workspace.
export async function savePushSubscription(device: DeviceSubscription): Promise<{ ok: boolean }> {
  const operator = await requirePerson();
  const endpoint = String(device?.endpoint ?? "");
  const p256dh = String(device?.p256dh ?? "");
  const auth = String(device?.auth ?? "");
  if (!validEndpoint(endpoint) || !KEY.test(p256dh) || !KEY.test(auth)) return { ok: false };
  const userAgent = String(device?.userAgent ?? "").slice(0, 200) || null;
  // A device signed in to another account before now belongs to this one.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { operatorId: operator.id, endpoint, p256dh, auth, userAgent },
    update: { operatorId: operator.id, p256dh, auth, userAgent },
  });
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
export async function sendTestPush(): Promise<{ sent: number }> {
  const operator = await requirePerson();
  const cfg = pushConfig();
  if (!cfg) return { sent: 0 };
  const locale = asLocale(operator.locale);
  const targets = await prisma.pushSubscription.findMany({
    where: { operatorId: operator.id },
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
