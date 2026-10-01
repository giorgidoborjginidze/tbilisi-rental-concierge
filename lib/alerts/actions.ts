"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireWriter } from "@/lib/auth/session";
import { flushOutbox } from "@/lib/notify/whatsapp";
import { scanAlerts } from "./scan";

/** At most this many alerts are closed or reopened by one tap. */
const MAX_IDS = 400;
const ID = /^[a-z0-9]{8,40}$/i;
/** A group's key on /alerts (lib/alerts/groups.ts): "u-…", "a-…" or "x-…". */
const GROUP = /^[uax]-[a-z0-9]{8,40}$/i;

const idsOf = (formData: FormData) =>
  [...new Set(formData.getAll("alertId").map(String))].filter((id) => ID.test(id)).slice(0, MAX_IDS);

const groupOf = (formData: FormData) => {
  const group = String(formData.get("group") ?? "");
  return GROUP.test(group) ? group : null;
};

/** Back to the active list, on the group the owner was working in. */
const activeList = (query: string, group: string | null) =>
  `/alerts${query ? `?${query}` : ""}${group ? `${query ? "&" : "?"}g=${group}#g-${group}` : ""}`;

/**
 * "Done" (resolved) or "Hide" (dismissed) — one alert, or every alert of a
 * group at once. The owner stays on the active list, where the next one
 * waits, with an undo for what was just closed.
 */
export async function setAlertStatus(formData: FormData) {
  const ids = idsOf(formData);
  const status = String(formData.get("status") ?? "");
  if (ids.length === 0 || (status !== "dismissed" && status !== "resolved")) return;
  const operator = await requireWriter();
  await prisma.alert.updateMany({
    where: { id: { in: ids }, operatorId: operator.id, status: "open" },
    data: { status, resolvedAt: new Date() },
  });
  // The bell's count lives in the layout.
  revalidatePath("/", "layout");
  redirect(activeList(`closed=${ids.join(",")}`, groupOf(formData)));
}

/** Undo: the alerts just closed are open again. */
export async function reopenAlerts(formData: FormData) {
  const ids = idsOf(formData);
  if (ids.length === 0) return;
  const operator = await requireWriter();
  await prisma.alert.updateMany({
    where: { id: { in: ids }, operatorId: operator.id, status: { in: ["resolved", "dismissed"] } },
    data: { status: "open", resolvedAt: null },
  });
  revalidatePath("/", "layout");
  redirect(activeList("", groupOf(formData)));
}

/**
 * "Scan now": the same scan the daily job runs, for this workspace only,
 * then its own outbox is delivered (sent at once when the WhatsApp Cloud
 * API is configured; otherwise the messages wait with a send link).
 */
export async function runAlertScan() {
  const operator = await requireWriter();
  const result = await scanAlerts(new Date(), operator.id);
  await flushOutbox(operator.id).catch(() => undefined);
  revalidatePath("/", "layout");
  // The page says the check just ran (and what it found), instead of the
  // "never ran" line about the daily schedule.
  redirect(`/alerts?scanned=${result.created}`);
}
