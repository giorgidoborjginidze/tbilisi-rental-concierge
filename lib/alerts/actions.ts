"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireWriter } from "@/lib/auth/session";
import { flushOutbox } from "@/lib/notify/whatsapp";
import { scanAlerts } from "./scan";

export async function setAlertStatus(formData: FormData) {
  const id = String(formData.get("alertId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (id && (status === "dismissed" || status === "resolved")) {
    const operator = await requireWriter();
    await prisma.alert.updateMany({
      where: { id, operatorId: operator.id },
      data: { status, resolvedAt: new Date() },
    });
    revalidatePath("/alerts");
    // Marking done takes you to the completed list, as confirmation.
    if (status === "resolved") redirect("/alerts?view=done");
  }
}

/**
 * Close every open free-window alert at once. Free windows live on the
 * calendar (with a suggested price); the alerts page shows them as one
 * summary card instead of one card per window.
 */
export async function dismissVacancyAlerts() {
  const operator = await requireWriter();
  await prisma.alert.updateMany({
    where: { operatorId: operator.id, status: "open", type: "vacancy_gap" },
    data: { status: "dismissed", resolvedAt: new Date() },
  });
  revalidatePath("/alerts");
  revalidatePath("/");
}

/**
 * "Scan now": the same scan the daily job runs, for this workspace only,
 * then its own outbox is delivered (sent at once when the WhatsApp Cloud
 * API is configured; otherwise the messages wait with a send link).
 */
export async function runAlertScan() {
  const operator = await requireWriter();
  await scanAlerts(new Date(), operator.id);
  await flushOutbox(operator.id).catch(() => undefined);
  revalidatePath("/alerts");
  revalidatePath("/");
}
