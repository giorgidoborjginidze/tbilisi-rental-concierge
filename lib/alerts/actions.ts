"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { scanAlerts } from "./scan";

export async function setAlertStatus(formData: FormData) {
  const id = String(formData.get("alertId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (id && (status === "dismissed" || status === "resolved")) {
    const operator = await requireOperator();
    await prisma.alert.updateMany({
      where: { id, operatorId: operator.id },
      data: { status, resolvedAt: new Date() },
    });
    revalidatePath("/alerts");
    // Marking done takes you to the completed list, as confirmation.
    if (status === "resolved") redirect("/alerts?view=done");
  }
}

export async function runAlertScan() {
  const operator = await requireOperator();
  await scanAlerts(new Date(), operator.id);
  revalidatePath("/alerts");
}
