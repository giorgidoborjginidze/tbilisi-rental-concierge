// Activo's own administrators (the founder): who may enter market data on
// /admin/market. Listed by sign-in email in ADMIN_EMAILS (comma-separated),
// so it is set in Vercel, not in the database where a bug could grant it.

import { notFound } from "next/navigation";
import { requireOperator, type SessionOperator } from "./session";

export function isAdminEmail(email: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  if (!email) return false;
  const list = (env.ADMIN_EMAILS ?? "").split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

/** The signed-in admin; anyone else sees a plain 404 (the page does not exist for them). */
export async function requireAdmin(): Promise<SessionOperator> {
  const operator = await requireOperator();
  if (operator.isDemo || !isAdminEmail(operator.email)) notFound();
  return operator;
}
