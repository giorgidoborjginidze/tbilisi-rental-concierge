// Password-reset links: /reset/<token>, sent by email (lib/email.ts).
// The token is 32 random bytes; the database keeps only its SHA-256 (the
// PasswordReset row id), so a leaked database holds no usable link. A link
// works once and for RESET_TTL_MS. Pure apart from the random bytes.

import { createHash, randomBytes } from "node:crypto";

export const RESET_TTL_MS = 60 * 60_000;

export const resetTokenId = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export function newResetToken(): { token: string; id: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, id: resetTokenId(token) };
}

export interface ResetRow {
  expiresAt: Date;
  usedAt: Date | null;
}

export function resetUsable(row: ResetRow | null, now: Date): row is ResetRow {
  return row != null && row.usedAt == null && now < row.expiresAt;
}

/** A token as it may appear in a URL: base64url, the length we issue. */
export const plausibleResetToken = (token: string): boolean => /^[A-Za-z0-9_-]{40,60}$/.test(token);

/** Loose shape check; the address is proven only by the email arriving. */
export const validEmail = (email: string): boolean =>
  email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
