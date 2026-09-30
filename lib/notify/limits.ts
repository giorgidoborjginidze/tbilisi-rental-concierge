// How much the platform will send, so a WhatsApp number can never be used
// to flood anyone — a renter's phone, or whatever number was typed in as
// the owner's (that number is free text and not verified).
//
//   - any one number (driver, tenant or the owner's own): at most 3
//     messages a day from one account. The owner still sees every event in
//     /alerts; a higher owner allowance would need a confirmed number;
//   - any one number from all accounts together: at most 10 a day — the
//     backstop, so opening many accounts does not multiply the flood. The
//     shared demo (which never sends) does not count toward it, so it can
//     never use up a real owner's messages to their own renter;
//   - a red line: one message of each kind (approaching / crossed) per
//     fence per recipient a day — a car weaving across the line all
//     afternoon is announced once, the alert feed records every crossing;
//   - every text is kept short and on one line (the Cloud API refuses
//     template parameters with line breaks or long runs of spaces).
//
// "A day" is the Tbilisi calendar day. Pure — the counts come from the
// caller (lib/notify/whatsapp.ts queueMessage).

/** Messages one account may send to one number a day. */
export const RECIPIENT_DAILY_LIMIT = 3;
/** Messages one number may receive a day from all accounts together. */
export const PLATFORM_DAILY_LIMIT = 10;
export const FENCE_KIND_DAILY_LIMIT = 1;

/** Longest text the owner may save as a template. */
export const MAX_TEMPLATE_CHARS = 500;
/** Longest text that is ever sent, placeholders filled in. */
export const MAX_MESSAGE_CHARS = 600;

export interface SentToday {
  /** Messages from this account to this number today (queued, sent or failed). */
  toPhone: number;
  /** Messages to this number today from every account except the demo. */
  toPhoneAllAccounts: number;
  /** Red-line messages of this kind about the same fence (geo kinds only). */
  sameFenceKind?: number;
}

/** Why one more message to this recipient today is held back, or null. */
export type LimitReason = "limit" | "limit_fence";

export function dailyLimitReason(sent: SentToday): LimitReason | null {
  if ((sent.sameFenceKind ?? 0) >= FENCE_KIND_DAILY_LIMIT) return "limit_fence";
  if (sent.toPhone >= RECIPIENT_DAILY_LIMIT) return "limit";
  if (sent.toPhoneAllAccounts >= PLATFORM_DAILY_LIMIT) return "limit";
  return null;
}

/** May one more message go to this recipient today? */
export const withinDailyLimits = (sent: SentToday): boolean => dailyLimitReason(sent) === null;

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
