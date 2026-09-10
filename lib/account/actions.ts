"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { destroySession, requireOperator } from "@/lib/auth/session";
import { eraseAccount } from "./dsr";
import type { FormState } from "@/lib/units/actions";

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

/**
 * Erase the account and everything in it, at the operator's own request.
 *
 * Typing the account's email is the confirmation step: a misdirected click
 * cannot destroy a portfolio, and the string being asked for is one only
 * the account holder has in front of them. There is no undo and no grace
 * period — an erasure right that keeps a copy "just in case" is not one.
 */
export async function eraseMyAccount(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const operator = await requireOperator();
  const confirmation = String(formData.get("confirm") ?? "")
    .trim()
    .toLowerCase();

  if (confirmation !== operator.email.toLowerCase()) {
    return { error: "error_erase_confirm" };
  }

  await eraseAccount({ id: operator.id, email: operator.email });
  await destroySession();
  redirect("/login?erased=1");
}
