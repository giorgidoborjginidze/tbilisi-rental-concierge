// The owner's own notifications: when something needs them now — a double
// booking, late rent, a car past its red line or a tracker gone quiet — a
// notification on every phone or browser they turned it on for (Web Push),
// and one email to the account address (unless turned off in Settings).
//
// Each urgent alert is told once (Alert.ownerNotifiedAt), and only while it
// is fresh (two days): a first run never floods the owner with old ones.
// The demo account never sends. Nothing personal goes to the push service
// beyond the title and the asset's name, encrypted for the device.
//
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY — the public key browsers subscribe with
//   VAPID_PRIVATE_KEY            — its private half (keep secret, never commit)
//   VAPID_SUBJECT                — a contact for the push services,
//                                  "mailto:…" or "https://activo.world"
//
// Without the keys, push is "not configured": Settings hides the button and
// only email is sent (when Resend is configured, lib/email.ts).

import webpush from "web-push";
import { prisma } from "@/lib/db";
import { NEEDS_YOU_TYPES } from "@/lib/alerts/rank";
import { alertHref } from "@/lib/alerts/links";
import { rentalDesk } from "@/lib/rentals/desk";
import { LIVE_CONTRACT } from "@/lib/rentals/live";
import { templateFamily } from "@/lib/notify/templates";
import { emailConfig, escapeHtml, sendEmail, type EmailConfig } from "@/lib/email";
import { asLocale, t, type Locale, type StringKey } from "@/lib/i18n/strings";
import { siteUrl } from "@/lib/site";

/** Only alerts this fresh are told; older ones the owner has seen in the app. */
export const NOTIFY_WITHIN_MS = 2 * 86_400_000;
/** More than this at once: the rest are summed up in one notification. */
export const PUSH_MAX = 4;

export interface PushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export function pushConfig(): PushConfig | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  const subject = process.env.VAPID_SUBJECT?.trim() || "https://activo.world";
  return { publicKey, privateKey, subject };
}

export const pushConfigured = (): boolean => pushConfig() != null;

export interface OwnerNote {
  /** The alert's id: a repeat replaces the earlier notification. */
  tag: string;
  title: string;
  body: string;
  /** Where tapping it leads, a path inside the app. */
  url: string;
}

export interface NoteSource {
  id: string;
  type: string;
  unitId: string | null;
  payload: unknown;
}

export interface NotePlace {
  name: string;
  category: string | null;
  /** The asset's rental desk, for the link. */
  desk: ReturnType<typeof rentalDesk>;
}

const assetIdOf = (payload: unknown): string | null => {
  const id = (payload as { assetId?: unknown } | null)?.assetId;
  return typeof id === "string" && id ? id : null;
};

/** One notification per alert, worded as the alerts page words it. Pure. */
export function ownerNotes(
  locale: Locale,
  alerts: NoteSource[],
  units: ReadonlyMap<string, NotePlace>,
  assets: ReadonlyMap<string, NotePlace>,
): OwnerNote[] {
  return alerts.map((alert) => {
    const assetId = assetIdOf(alert.payload);
    const place = (alert.unitId ? units.get(alert.unitId) : null) ?? (assetId ? assets.get(assetId) : null) ?? null;
    const category =
      (alert.payload as { category?: unknown } | null)?.category ?? (assetId ? assets.get(assetId)?.category : null);
    const key: StringKey =
      alert.type === "repossession_right" && templateFamily(typeof category === "string" ? category : null) === "property"
        ? "alert_repossession_right_property"
        : alert.type === "overlap" && !alert.unitId
          ? "alert_overlap_contract"
          : (`alert_${alert.type}` as StringKey);
    const url = alertHref(alert, (id) => assets.get(id)?.desk ?? null);
    return {
      tag: alert.id,
      title: t(locale, key),
      body: place?.name ?? t(locale, "notify_open_app"),
      url,
    };
  });
}

/** What goes to the devices: each alert, or the first few and a summary. Pure. */
export function pushBatch(locale: Locale, notes: OwnerNote[]): OwnerNote[] {
  if (notes.length <= PUSH_MAX) return notes;
  const shown = notes.slice(0, PUSH_MAX - 1);
  return [
    ...shown,
    {
      tag: "activo-more",
      title: t(locale, "notify_more_title").replace("{n}", String(notes.length - shown.length)),
      body: t(locale, "notify_open_app"),
      url: "/alerts",
    },
  ];
}

/** The email: one line per alert, each with its link. Pure. */
export function ownerDigest(
  locale: Locale,
  notes: OwnerNote[],
  origin: string,
): { subject: string; text: string; html: string } {
  const subject =
    notes.length === 1
      ? `Activo — ${notes[0].title}`
      : `Activo — ${t(locale, "notify_digest_subject").replace("{n}", String(notes.length))}`;
  const intro = t(locale, "notify_digest_intro");
  const off = t(locale, "notify_digest_off");
  const settings = `${origin}/settings#notifications`;
  const text = [
    intro,
    "",
    ...notes.map((note) => `• ${note.title} — ${note.body}\n  ${origin}${note.url}`),
    "",
    `${off} ${settings}`,
  ].join("\n");
  const html = [
    `<p>${escapeHtml(intro)}</p>`,
    "<ul>",
    ...notes.map(
      (note) =>
        `<li><a href="${escapeHtml(origin + note.url)}"><strong>${escapeHtml(note.title)}</strong></a> — ${escapeHtml(note.body)}</li>`,
    ),
    "</ul>",
    `<p style="color:#667">${escapeHtml(off)} <a href="${escapeHtml(settings)}">${escapeHtml(settings)}</a></p>`,
  ].join("\n");
  return { subject, text, html };
}

export interface PushTarget {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Sends one notification; resolves to the push service's HTTP status (0: network error). */
export type PushSender = (target: PushTarget, note: OwnerNote, cfg: PushConfig) => Promise<number>;

export const webPushSender: PushSender = async (target, note, cfg) => {
  try {
    const result = await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(note),
      {
        vapidDetails: { subject: cfg.subject, publicKey: cfg.publicKey, privateKey: cfg.privateKey },
        TTL: 86_400,
        urgency: "high",
        timeout: 8_000,
      },
    );
    return result.statusCode;
  } catch (error) {
    const status = (error as { statusCode?: unknown }).statusCode;
    return typeof status === "number" ? status : 0;
  }
};

export interface NotifyDeps {
  push: PushConfig | null;
  email: EmailConfig | null;
  send: PushSender;
  mail: typeof sendEmail;
  origin: string;
}

const defaultDeps = (): NotifyDeps => ({
  push: pushConfig(),
  email: emailConfig(),
  send: webPushSender,
  mail: sendEmail,
  origin: siteUrl(),
});

export interface NotifyOutcome {
  alerts: number;
  pushed: number;
  emailed: boolean;
}

const NOTHING: NotifyOutcome = { alerts: 0, pushed: 0, emailed: false };

/**
 * Tells one workspace's owner about its fresh urgent alerts, once. Safe to
 * call often: with nothing new it is a single query.
 */
export async function notifyOwner(
  operatorId: string,
  now: Date = new Date(),
  deps: NotifyDeps = defaultDeps(),
): Promise<NotifyOutcome> {
  const fresh = await prisma.alert.findMany({
    where: {
      operatorId,
      status: "open",
      type: { in: [...NEEDS_YOU_TYPES] },
      ownerNotifiedAt: null,
      createdAt: { gte: new Date(now.getTime() - NOTIFY_WITHIN_MS) },
    },
    select: { id: true, type: true, unitId: true, payload: true },
    orderBy: { createdAt: "asc" },
    take: 30,
  });
  if (fresh.length === 0) return NOTHING;

  // Claimed first, so two runs at once never tell the owner twice.
  const claimed = await prisma.alert.updateMany({
    where: { id: { in: fresh.map((a) => a.id) }, ownerNotifiedAt: null },
    data: { ownerNotifiedAt: now },
  });
  if (claimed.count === 0) return NOTHING;

  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: {
      email: true, locale: true, notifyEmail: true, isDemo: true,
      pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
    },
  });
  if (!operator || operator.isDemo) return { ...NOTHING, alerts: fresh.length };
  const locale = asLocale(operator.locale);

  const unitIds = [...new Set(fresh.map((a) => a.unitId).filter((id): id is string => !!id))];
  const assetIds = [...new Set(fresh.map((a) => assetIdOf(a.payload)).filter((id): id is string => !!id))];
  const [unitRows, assetRows] = await Promise.all([
    unitIds.length
      ? prisma.unit.findMany({ where: { id: { in: unitIds }, operatorId }, select: { id: true, name: true, nameKa: true } })
      : [],
    assetIds.length
      ? prisma.asset.findMany({
          where: { id: { in: assetIds }, operatorId },
          select: {
            id: true, name: true, nameKa: true, category: true,
            _count: { select: { contracts: { where: LIVE_CONTRACT } } },
          },
        })
      : [],
  ]);
  const nameOf = (row: { name: string; nameKa: string | null }) =>
    locale === "ka" && row.nameKa ? row.nameKa : row.name;
  const units = new Map<string, NotePlace>(
    unitRows.map((u) => [u.id, { name: nameOf(u), category: null, desk: null }]),
  );
  const assets = new Map<string, NotePlace>(
    assetRows.map((a) => [
      a.id,
      { name: nameOf(a), category: a.category, desk: rentalDesk(a.category, a._count.contracts) },
    ]),
  );
  const notes = ownerNotes(locale, fresh, units, assets);

  let pushed = 0;
  if (deps.push && operator.pushSubscriptions.length > 0) {
    const batch = pushBatch(locale, notes);
    const gone: string[] = [];
    await Promise.all(
      operator.pushSubscriptions.map(async (target) => {
        for (const note of batch) {
          const status = await deps.send(target, note, deps.push!);
          if (status === 404 || status === 410) {
            // The device unsubscribed or the browser was reset.
            gone.push(target.id);
            return;
          }
          if (status >= 200 && status < 300) pushed += 1;
        }
      }),
    );
    if (gone.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
  }

  let emailed = false;
  if (operator.notifyEmail && deps.email) {
    const digest = ownerDigest(locale, notes, deps.origin);
    emailed = await deps.mail({ to: operator.email, ...digest }, deps.email);
  }

  return { alerts: fresh.length, pushed, emailed };
}
