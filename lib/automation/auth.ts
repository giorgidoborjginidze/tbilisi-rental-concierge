// Who may start the automatic jobs: only a caller holding CRON_SECRET.
// Vercel Cron sends it as `Authorization: Bearer <CRON_SECRET>` by itself
// once the variable is set in the project. Without the variable the route
// refuses everything — it is never open.

import { createHash, timingSafeEqual } from "node:crypto";

export type CronAuth = "ok" | "not_configured" | "unauthorized";

const digest = (value: string) => createHash("sha256").update(value).digest();

export function cronAuthorized(
  authorization: string | null | undefined,
  secret: string | null | undefined,
): CronAuth {
  if (!secret || secret.trim().length < 16) return "not_configured";
  const match = /^Bearer\s+(.+)$/i.exec(authorization ?? "");
  if (!match) return "unauthorized";
  // Compared in constant time (hashes, so the lengths always match).
  return timingSafeEqual(digest(match[1].trim()), digest(secret.trim())) ? "ok" : "unauthorized";
}
