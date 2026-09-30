import { prisma } from "@/lib/db";
import type { Locale } from "@/lib/i18n/strings";
import { sweepStaleMessages } from "@/lib/rentals/settle";
import { startOfTodayTbilisi, tbilisiDayStartInstant } from "@/lib/time";
import { clampMessage, withinDailyLimits, type SentToday } from "./limits";
import { normalizePhone } from "./phone";
import {
  defaultTemplate,
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
  const [toPhone, toPhoneForAsset] = await Promise.all([
    prisma.notifyMessage.count({ where: { toPhone: phone, ...today } }),
    input.assetId
      ? prisma.notifyMessage.count({ where: { toPhone: phone, assetId: input.assetId, ...today } })
      : Promise.resolve(0),
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
  return { toPhone, toPhoneForAsset, sameFenceKind };
}

/** "driver" | "owner" — the last part of a red-line message's dedupe key. */
const roleSuffix = (key: TemplateKey) => (TEMPLATE_ROLE[key] === "owner" ? "owner" : "driver");

/**
 * Put one message in the outbox. Returns the row when a message has
 * (re-)entered the queue, null when it was already there (deduped), when
 * there is no usable phone number, or when the daily limit for this
 * recipient is reached — then the message is kept as withdrawn with the
 * reason "limit", so the owner sees why it did not go out.
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

  const existing = await prisma.notifyMessage.findUnique({
    where: { dedupeKey: input.dedupeKey },
  });
  if (existing?.status === "sent") return null;

  const body = clampMessage(
    render(await resolveTemplate(input.operatorId, input.locale, input.key), input.vars),
  );

  if (existing && existing.status !== "cancelled") {
    if (existing.body !== body || existing.toPhone !== phone) {
      await prisma.notifyMessage.update({
        where: { id: existing.id },
        data: { body, toPhone: phone },
      });
    }
    return null;
  }

  const allowed = withinDailyLimits(TEMPLATE_ROLE[input.key], await sentToday(input, phone, now));
  if (existing) {
    // Withdrawn earlier: back in the queue only while today's limit allows.
    if (!allowed) {
      if (existing.cancelReason === "limit") return null;
      await prisma.notifyMessage.update({
        where: { id: existing.id },
        data: { toPhone: phone, body, cancelReason: "limit", cancelledAt: now },
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
      ...(allowed ? {} : { status: "cancelled", cancelReason: "limit", cancelledAt: now }),
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

/**
 * Deliver one workspace's queued messages. Always per workspace: one
 * owner's action (a scan, a ping, a retry) never sends another owner's
 * queue. Without credentials nothing is sent and the messages stay queued
 * for click-to-send — that is a normal state, not an error.
 */
/** A claimed message whose send never reported back within this is given up on. */
const SENDING_TIMEOUT_MS = 10 * 60_000;

export async function flushOutbox(operatorId: string): Promise<FlushResult> {
  const config = whatsappConfig();
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
