import { prisma } from "@/lib/db";
import type { Locale } from "@/lib/i18n/strings";
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
}

/**
 * Put one message in the outbox. Returns null when it was already there
 * (deduped) or when there is no usable phone number for the recipient.
 */
export async function queueMessage(input: QueueInput) {
  const phone = normalizePhone(input.phone);
  if (!phone) return null;

  const existing = await prisma.notifyMessage.findUnique({
    where: { dedupeKey: input.dedupeKey },
  });
  if (existing) return null;

  const body = render(
    await resolveTemplate(input.operatorId, input.locale, input.key),
    input.vars,
  );

  return prisma.notifyMessage.create({
    data: {
      operatorId: input.operatorId,
      assetId: input.assetId ?? null,
      contractId: input.contractId ?? null,
      toPhone: phone,
      toRole: TEMPLATE_ROLE[input.key],
      kind: input.key,
      body,
      dedupeKey: input.dedupeKey,
    },
  });
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
 * Try to deliver everything queued. Without credentials nothing is sent and
 * the messages stay queued for click-to-send — that is a normal state, not
 * an error.
 */
export async function flushOutbox(operatorId?: string): Promise<FlushResult> {
  const config = whatsappConfig();
  const queued = await prisma.notifyMessage.findMany({
    where: { status: "queued", ...(operatorId ? { operatorId } : {}) },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  if (!config) return { sent: 0, failed: 0, pending: queued.length };

  const result: FlushResult = { sent: 0, failed: 0, pending: 0 };
  for (const message of queued) {
    try {
      const providerRef = await sendViaCloudApi(config, message.toPhone, message.body);
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
