"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";

// Update the operator's display name (Company / Operator Name). Empty
// clears it (the UI then falls back to the email local-part).
export async function updateProfileName(formData: FormData) {
  const operator = await requireOperator();
  const name = String(formData.get("name") ?? "").trim();
  await prisma.operator.update({
    where: { id: operator.id },
    data: { name: name || null },
  });
  revalidatePath("/settings");
}
