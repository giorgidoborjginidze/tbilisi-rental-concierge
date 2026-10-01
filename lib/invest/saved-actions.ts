"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireWriter } from "@/lib/auth/session";
import { getBillingContext } from "@/lib/billing/context";
import { cleanScenario, MAX_SAVED } from "./saved";

export type SaveResult = { id: string } | { error: "error_required" | "calc_limit" | "wor_locked" };

/** Keeps a PRO scenario (a new one, or over an existing one with `id`). */
export async function saveScenario(input: { id?: string | null; name: string; data: unknown }): Promise<SaveResult> {
  const operator = await requireWriter();
  if (!(await getBillingContext(operator)).plan.analysis) return { error: "wor_locked" };
  const name = String(input?.name ?? "").trim().slice(0, 80);
  if (!name) return { error: "error_required" };
  const data = cleanScenario(input?.data);
  const json = JSON.parse(JSON.stringify(data));
  if (input?.id) {
    const updated = await prisma.savedCalc.updateMany({
      where: { id: String(input.id), operatorId: operator.id },
      data: { name, data: json },
    });
    if (updated.count > 0) {
      revalidatePath("/invest/pro");
      return { id: String(input.id) };
    }
  }
  if ((await prisma.savedCalc.count({ where: { operatorId: operator.id } })) >= MAX_SAVED) return { error: "calc_limit" };
  const row = await prisma.savedCalc.create({ data: { operatorId: operator.id, kind: "pro", name, data: json }, select: { id: true } });
  revalidatePath("/invest/pro");
  return { id: row.id };
}

export async function deleteScenario(formData: FormData): Promise<{ undo: Record<string, string> } | null> {
  const operator = await requireWriter();
  const row = await prisma.savedCalc.findFirst({ where: { id: String(formData.get("id") ?? ""), operatorId: operator.id } });
  if (!row) return null;
  await prisma.savedCalc.delete({ where: { id: row.id } });
  revalidatePath("/invest/pro");
  return { undo: { name: row.name, data: JSON.stringify(row.data) } };
}

export async function restoreScenario(formData: FormData): Promise<void> {
  let data: unknown = null;
  try {
    data = JSON.parse(String(formData.get("data") ?? "null"));
  } catch {
    return;
  }
  await saveScenario({ name: String(formData.get("name") ?? ""), data });
}
