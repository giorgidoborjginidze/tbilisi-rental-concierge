// How much the platform will send, so a WhatsApp number can never be used
// to flood anyone — a renter's phone, or whatever number was typed in as
// the owner's.
//
//   - a renter's number (driver / tenant): at most 3 messages a day, from
//     every account on the platform together;
//   - the owner's own number: at most 3 a day about any one asset and 20 a
//     day in all, so a fleet owner still hears about every car;
//   - a red line: one message of each kind (approaching / crossed) per
//     fence per recipient a day — a car weaving across the line all
//     afternoon is announced once, the alert feed records every crossing;
//   - every text is kept short and on one line (the Cloud API refuses
//     template parameters with line breaks or long runs of spaces).
//
// "A day" is the Tbilisi calendar day. Pure — the counts come from the
// caller (lib/notify/whatsapp.ts queueMessage).

import type { TemplateRole } from "./templates";

export const RENTER_DAILY_LIMIT = 3;
export const OWNER_ASSET_DAILY_LIMIT = 3;
export const OWNER_DAILY_LIMIT = 20;
export const FENCE_KIND_DAILY_LIMIT = 1;

/** Longest text the owner may save as a template. */
export const MAX_TEMPLATE_CHARS = 500;
/** Longest text that is ever sent, placeholders filled in. */
export const MAX_MESSAGE_CHARS = 600;

export interface SentToday {
  /** Messages to this number today (queued, sent or failed). */
  toPhone: number;
  /** Of those, about the same asset. */
  toPhoneForAsset: number;
  /** Red-line messages of this kind about the same fence (geo kinds only). */
  sameFenceKind?: number;
}

/** May one more message go to this recipient today? */
export function withinDailyLimits(role: TemplateRole, sent: SentToday): boolean {
  if ((sent.sameFenceKind ?? 0) >= FENCE_KIND_DAILY_LIMIT) return false;
  if (role === "owner") {
    return sent.toPhoneForAsset < OWNER_ASSET_DAILY_LIMIT && sent.toPhone < OWNER_DAILY_LIMIT;
  }
  return sent.toPhone < RENTER_DAILY_LIMIT;
}

/**
 * One line, no runs of spaces, at most MAX_MESSAGE_CHARS characters
 * (cut at a word where possible, with an ellipsis).
 */
export function clampMessage(text: string, max: number = MAX_MESSAGE_CHARS): string {
  const line = text
    .replace(/[\t\r\n\u2028\u2029]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
  const chars = [...line];
  if (chars.length <= max) return line;
  const cut = chars.slice(0, max - 1).join("");
  const atWord = cut.lastIndexOf(" ");
  return `${(atWord > max * 0.6 ? cut.slice(0, atWord) : cut).trimEnd()}…`;
}
