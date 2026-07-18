"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { scanAlerts } from "./scan";

export async function setAlertStatus(formData: FormData) {
  const id = String(formData.get("alertId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (id && (status === "dismissed" || status === "resolved")) {
    await prisma.alert.update({ where: { id }, data: { status } });
    revalidatePath("/alerts");
  }
}

export async function runAlertScan() {
  await scanAlerts();
  revalidatePath("/alerts");
}
