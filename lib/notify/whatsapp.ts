import { prisma } from "@/lib/db";
import type { Locale } from "@/lib/i18n/strings";
import { sweepStaleMessages } from "@/lib/rentals/settle";
import { startOfTodayTbilisi, tbilisiDayStartInstant } from "@/lib/time";
import { clampMessage, dailyLimitReason, type SentToday } from "./limits";
import { normalizePhone } from "./phone";
import { planStanding } from "@/lib/billing/plans";
import {
  defaultTemplate,
  isFixedTemplate,
  optOutLine,
  render,
  TEMPLATE_ROLE,
  type TemplateKey,
  type TemplateVars,
} from "./templates";

// WhatsApp delivery, in two tiers.
//
// 1. Always: the message is written to the outbox (NotifyMessage) the
//    moment the event fires, with a dedupe key, so an event can never be
//    lost or announced twice.
// 2. When the workspace has WhatsApp Business Cloud API credentials in the
//    environment, queued messages are sent automatically. Without them the
//    outbox shows a one-tap wa.me link instead — which needs no Meta
//    account and works today.
//
// Meta requires pre-approved message templates for business-initiated
// conversations, so WHATSAPP_TEMPLATE_NAME names an approved template with
// a single body parameter; our rendered text goes in as that parameter.

const GRAPH_VERSION = "v21.0";

export interface WhatsAppConfig {
  token: string;
  phoneNumberId: string;
  templateName: string;
  templateLocale: string;
}

/** Credentials from the environment, or null when not configured. */
export function whatsappConfig(): WhatsAppConfig | null {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return null;
  return {
    token,
    phoneNumberId,
    templateName: process.env.WHATSAPP_TEMPLATE_NAME || "activo_alert",
    templateLocale: process.env.WHATSAPP_TEMPLATE_LOCALE || "ka",
  };
}

export { normalizePhone, waLink } from "./phone";

/** The body for one template key: the workspace's edit, or the default. */
export async function resolveTemplate(
  operatorId: string,
  locale: Locale,
  key: TemplateKey,
): Promise<string> {
  // The texts stating the owner's legal right are never replaced.
  if (isFixedTemplate(key)) return defaultTemplate(locale, key);
  const row = await prisma.notifyTemplate.findUnique({
    where: { operatorId_key: { operatorId, key } },
  });
  return row?.body?.trim() || defaultTemplate(locale, key);
}

export interface QueueInput {
  operatorId: string;
  locale: Locale;
  key: TemplateKey;
  /** Stable per-event id, so a re-scan or a repeated ping never re-sends. */
  dedupeKey: string;
  phone: string | null | undefined;
  vars: TemplateVars;
  assetId?: string | null;
  contractId?: string | null;
  /** Red-line messages: the fence, for the once-a-day-per-fence limit. */
  fenceId?: string | null;
  /** Defaults to now; the scan and the tests pass their own clock. */
  now?: Date;
}

const LIVE = ["queued", "sent", "failed"];

/** What this recipient has already been sent today (lib/notify/limits.ts). */
async function sentToday(input: QueueInput, phone: string, now: Date): Promise<SentToday> {
  const since = tbilisiDayStartInstant(now);
  const today = { status: { in: LIVE }, createdAt: { gte: since } };
  const [toPhone, toPhoneAllAccounts] = await Promise.all([
    // This account's own messages to the number: one account's queue never
    // uses up another account's allowance.
    prisma.notifyMessage.count({ where: { toPhone: phone, operatorId: input.operatorId, ...today } }),
    // The backstop across accounts. The demo never sends, so it is left out.
    prisma.notifyMessage.count({ where: { toPhone: phone, operator: { isDemo: false }, ...today } }),
  ]);
  let sameFenceKind: number | undefined;
  if (input.fenceId) {
    const events = await prisma.geoEvent.findMany({
      where: { geofenceId: input.fenceId, createdAt: { gte: since } },
      select: { id: true },
    });
    sameFenceKind = events.length
      ? await prisma.notifyMessage.count({
          where: {
            kind: input.key,
            dedupeKey: { in: events.map((event) => `geo|${event.id}|${roleSuffix(input.key)}`) },
            ...today,
          },
        })
      : 0;
  }
  return { toPhone, toPhoneAllAccounts, sameFenceKind };
}

/** "driver" | "owner" — the last part of a red-line message's dedupe key. */
const roleSuffix = (key: TemplateKey) => (TEMPLATE_ROLE[key] === "owner" ? "owner" : "driver");

/**
 * Put one message in the outbox. Returns the row when a message has
 * (re-)entered the queue, null when it was already there (deduped), when
 * there is no usable phone number, or when a daily limit is reached — then
 * the message is kept as withdrawn with the reason "limit" (this number) or
 * "limit_fence" (this red-line event was already announced today), so the
 * owner sees why it did not go out.
 *
 * A message still waiting keeps its figures current: its text is
 * re-rendered on every call. A message that was withdrawn (the rent was
 * paid, the terms changed) and is now called for again because the
 * situation is back returns to the queue with a freshly rendered body, so
 * it quotes today's amount rather than the one it was first written with.
 */
export async function queueMessage(input: QueueInput) {
  const phone = normalizePhone(input.phone);
  if (!phone) return null;
  const now = input.now ?? new Date();
  const toRenter = TEMPLATE_ROLE[input.key] !== "owner";

  // A renter who asked for no more messages gets none — whatever else the
  // contract says; what still waits for them is withdrawn on the spot.
  if (toRenter && input.contractId) {
    // all-contracts: an opt-out holds even on a deleted contract.
    const contract = await prisma.rentalContract.findUnique({
      where: { id: input.contractId },
      select: { messagesOptOutAt: true },
    });
    if (contract?.messagesOptOutAt) {
      await prisma.notifyMessage.updateMany({
        where: { dedupeKey: input.dedupeKey, status: { in: ["queued", "failed"] } },
        data: { status: "cancelled", cancelReason: "opt_out", cancelledAt: now },
      });
      return null;
    }
  }

  const existing = await prisma.notifyMessage.findUnique({
    where: { dedupeKey: input.dedupeKey },
  });
  if (existing?.status === "sent") return null;
  // Removed by the owner: never queued again by a later check (the owner
  // can put it back from the outbox).
  if (existing?.status === "cancelled" && existing.cancelReason === "owner") return null;

  // Every message to a renter says how to stop them.
  const rendered = render(await resolveTemplate(input.operatorId, input.locale, input.key), input.vars);
  const body = clampMessage(toRenter ? `${rendered} ${optOutLine(input.locale)}` : rendered);

  if (existing && existing.status !== "cancelled") {
    if (existing.body !== body || existing.toPhone !== phone) {
      await prisma.notifyMessage.update({
        where: { id: existing.id },
        data: { body, toPhone: phone },
      });
    }
    return null;
  }

  const limited = dailyLimitReason(await sentToday(input, phone, now));
  const allowed = limited === null;
  if (existing) {
    // Withdrawn earlier: back in the queue only while today's limit allows.
    if (limited) {
      if (existing.cancelReason === limited) return null;
      await prisma.notifyMessage.update({
        where: { id: existing.id },
        data: { toPhone: phone, body, cancelReason: limited, cancelledAt: now },
      });
      return null;
    }
    return prisma.notifyMessage.update({
      where: { id: existing.id },
      data: {
        toPhone: phone,
        body,
        status: "queued",
        cancelReason: null,
        cancelledAt: null,
        error: null,
        createdAt: now,
      },
    });
  }

  const row = await prisma.notifyMessage.create({
    data: {
      operatorId: input.operatorId,
      assetId: input.assetId ?? null,
      contractId: input.contractId ?? null,
      toPhone: phone,
      toRole: TEMPLATE_ROLE[input.key],
      kind: input.key,
      body,
      dedupeKey: input.dedupeKey,
      createdAt: now,
      ...(limited ? { status: "cancelled", cancelReason: limited, cancelledAt: now } : {}),
    },
  });
  return allowed ? row : null;
}

/** Send one body over the Cloud API. Throws on a non-2xx response. */
async function sendViaCloudApi(
  config: WhatsAppConfig,
  toPhone: string,
  body: string,
): Promise<string> {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toPhone,
        type: "template",
        template: {
          name: config.templateName,
          language: { code: config.templateLocale },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: body }],
            },
          ],
        },
      }),
    },
  );

  const payload = (await response.json().catch(() => ({}))) as {
    messages?: { id?: string }[];
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message || `WhatsApp API ${response.status}`);
  }
  return payload.messages?.[0]?.id ?? "";
}

export interface FlushResult {
  sent: number;
  failed: number;
  pending: number;
}

/** A claimed message whose send never reported back within this is given up on. */
const SENDING_TIMEOUT_MS = 10 * 60_000;

/**
 * Whether this workspace's messages go out over the Cloud API: only for a
 * paid plan. Never for the shared public demo (anyone can type a phone
 * number and a text there) nor a trial — their messages get the manual
 * wa.me link (sent, if at all, from the visitor's own WhatsApp).
 */
export async function autoSendFor(operatorId: string): Promise<boolean> {
  if (!whatsappConfig()) return false;
  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: { isDemo: true, accountType: true, plan: true, trialEndsAt: true, paidUntil: true, companyId: true },
  });
  if (!operator || operator.isDemo) return false;
  // A team member's messages go out on the company's plan.
  const account = operator.companyId
    ? await prisma.operator.findUnique({
        where: { id: operator.companyId },
        select: { accountType: true, plan: true, trialEndsAt: true, paidUntil: true },
      })
    : operator;
  if (!account) return false;
  // Sending from the platform's number is for paying accounts: a trial (or
  // an unpaid account) gets the one-tap wa.me link, sent from the owner's
  // own WhatsApp — a fresh sign-up cannot use Activo to message strangers.
  const standing = planStanding(
    {
      accountType: account.accountType === "business" ? "business" : "personal",
      plan: account.plan,
      trialEndsAt: account.trialEndsAt,
      paidUntil: account.paidUntil,
    },
    new Date(),
  );
  return standing === "paid" || standing === "grace";
}

/**
 * Deliver one workspace's queued messages. Always per workspace: one
 * owner's action (a scan, a ping, a retry) never sends another owner's
 * queue. Without credentials (or for the demo) nothing is sent and the
 * messages stay queued for click-to-send — a normal state, not an error.
 */
export async function flushOutbox(operatorId: string): Promise<FlushResult> {
  const config = (await autoSendFor(operatorId)) ? whatsappConfig() : null;
  // A send that was cut off (the function timed out mid-request) may or may
  // not have reached the phone: it is marked failed, never sent again on
  // its own — the owner decides.
  await prisma.notifyMessage.updateMany({
    where: {
      operatorId,
      status: "sending",
      claimedAt: { lt: new Date(Date.now() - SENDING_TIMEOUT_MS) },
    },
    data: { status: "failed", error: "interrupted" },
  });
  // Last check before anything leaves: a reminder about rent that has been
  // paid, or a red-line text for a car that is back inside, is withdrawn.
  await sweepStaleMessages(prisma, startOfTodayTbilisi(), operatorId);
  const queued = await prisma.notifyMessage.findMany({
    where: { status: "queued", operatorId },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  if (!config) return { sent: 0, failed: 0, pending: queued.length };

  const result: FlushResult = { sent: 0, failed: 0, pending: 0 };
  for (const message of queued) {
    // Claim it first: two flushes running at once (the cron and a scan
    // button) must not both send the same message.
    const claimed = await prisma.notifyMessage.updateMany({
      where: { id: message.id, status: "queued" },
      data: { status: "sending", claimedAt: new Date() },
    });
    if (claimed.count === 0) continue;
    try {
      const providerRef = await sendViaCloudApi(config, message.toPhone, clampMessage(message.body));
      await prisma.notifyMessage.update({
        where: { id: message.id },
        data: { status: "sent", sentAt: new Date(), providerRef, error: null },
      });
      result.sent += 1;
    } catch (error) {
      await prisma.notifyMessage.update({
        where: { id: message.id },
        data: {
          status: "failed",
          error: error instanceof Error ? error.message : "send failed",
        },
      });
      result.failed += 1;
    }
  }
  return result;
}
