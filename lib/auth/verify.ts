// Confirming that an email address belongs to the person who typed it:
// a link (/verify/<token>) sent to the address at sign-up and after an
// email change, and again on request from Settings. Until it is opened,
// alert emails are not sent there (lib/notify/owner.ts) — a mistyped
// address never receives someone's rent alerts.
//
// Without email sending configured (RESEND_API_KEY) nothing is sent and
// Settings does not ask for it.

import { prisma } from "@/lib/db";
import { emailConfigured, escapeHtml, sendEmail } from "@/lib/email";
import { t, type Locale } from "@/lib/i18n/strings";
import { siteUrl } from "@/lib/site";
import { newResetToken, resetTokenId, resetUsable } from "./reset";

export const VERIFY_TTL_MS = 3 * 86_400_000;
/** One link per this long at most, so "send again" cannot be used to flood an inbox. */
export const VERIFY_RESEND_MS = 2 * 60_000;

/** Sends a fresh link (older ones stop working). True when the email went out. */
export async function sendVerificationLink(operatorId: string, email: string, locale: Locale, now = new Date()): Promise<boolean> {
  if (!emailConfigured()) return false;
  const last = await prisma.emailVerification.findFirst({
    where: { operatorId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last && now.getTime() - last.createdAt.getTime() < VERIFY_RESEND_MS) return false;

  await prisma.emailVerification.updateMany({ where: { operatorId, usedAt: null }, data: { usedAt: now } });
  const { token, id } = newResetToken();
  await prisma.emailVerification.create({
    data: { id, operatorId, email, expiresAt: new Date(now.getTime() + VERIFY_TTL_MS), createdAt: now },
  });
  const link = `${siteUrl()}/verify/${token}`;
  const body = t(locale, "email_verify_body");
  const sent = await sendEmail({
    to: email,
    subject: t(locale, "email_verify_subject"),
    text: body.replace("{link}", link),
    html: `<p>${escapeHtml(body).replace("{link}", `<a href="${escapeHtml(link)}">${escapeHtml(link)}</a>`)}</p>`,
  });
  if (!sent) await prisma.emailVerification.delete({ where: { id } }).catch(() => undefined);
  return sent;
}

/**
 * Opens a link: the address is confirmed when the link is live and was
 * sent to the address the account still has. Single use.
 */
export async function confirmEmail(token: string, now = new Date()): Promise<"ok" | "invalid"> {
  const row = await prisma.emailVerification.findUnique({
    where: { id: resetTokenId(token) },
    include: { operator: { select: { id: true, email: true } } },
  });
  if (!resetUsable(row, now) || row.email !== row.operator.email) return "invalid";
  const claimed = await prisma.emailVerification.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
  if (claimed.count === 0) return "invalid";
  await prisma.operator.update({ where: { id: row.operator.id }, data: { emailVerifiedAt: now } });
  return "ok";
}
