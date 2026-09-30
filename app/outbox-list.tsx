import Link from "next/link";
import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import { badgeClass, OUTBOX_TONE, toneOf } from "@/lib/ui/tone";
import { waLink } from "@/lib/notify/phone";
import { selfAddressed } from "@/lib/notify/outbox-view";
import { WITHDRAW_REASONS, type WithdrawReason } from "@/lib/rentals/settle";
import { deleteMessage, markMessageSent } from "@/lib/rentals/actions";
import { tbilisiFormat } from "@/lib/time";
import { IconClose, IconExternal } from "./icons";

export interface OutboxItem {
  id: string;
  assetId: string | null;
  toRole: string;
  toPhone: string;
  status: string;
  body: string;
  error: string | null;
  cancelReason: string | null;
  createdAt: Date;
  sentAt: Date | null;
  cancelledAt: Date | null;
  /** Why a queued/failed message no longer applies (computed by the page). */
  stale: WithdrawReason | null;
  /** The asset is a flat, not a car: its renter is a tenant. */
  property: boolean;
  /** The global outbox names the asset and links to its messages. */
  asset?: { name: string; href: string } | null;
}

// One outbox list for the asset's own desk and the workspace-wide
// /alerts?tab=outbox: who it is for, where it stands, the text, and — while
// it has to be sent by hand — the WhatsApp link and "mark sent".
export default function OutboxList({
  locale,
  items,
  autoSend,
}: {
  locale: Locale;
  items: OutboxItem[];
  /** Automatic sending is on (the Cloud API sends queued messages itself). */
  autoSend: boolean;
}) {
  const fmtStamp = tbilisiFormat(locale, {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
  const roleLabel = (role: string) =>
    t(
      locale,
      role === "driver" ? "outbox_to_driver" : role === "tenant" ? "outbox_to_tenant" : "outbox_to_owner",
    );
  const withdrawn = (item: OutboxItem) =>
    item.status === "cancelled" && WITHDRAW_REASONS.includes(item.cancelReason as WithdrawReason)
      ? (item.cancelReason as WithdrawReason)
      : null;

  return (
    <ul className="space-y-2">
      {items.map((message) => {
        const reason = withdrawn(message);
        return (
          <li key={message.id} className="alert-card" style={{ padding: "12px 16px" }}>
            <div style={{ fontSize: 13, minWidth: 0 }}>
              <div className="flex flex-wrap items-center gap-1.5">
                {message.asset && (
                  <Link href={message.asset.href} className="link" style={{ fontWeight: 600 }}>
                    {message.asset.name}
                  </Link>
                )}
                <span className={badgeClass("tag")}>
                  {/* Older rows addressed a flat's tenant as "driver". */}
                  {roleLabel(message.toRole === "driver" && message.property ? "tenant" : message.toRole)}
                </span>
                <span className={badgeClass(toneOf(OUTBOX_TONE, message.status))}>
                  {t(locale, `outbox_status_${message.status}` as StringKey)}
                </span>
                <span style={{ color: "var(--color-text-muted)" }}>
                  +{message.toPhone} ·{" "}
                  {message.status === "sent" && message.sentAt
                    ? `${t(locale, "outbox_sent_at")} ${fmtStamp.format(message.sentAt)}`
                    : fmtStamp.format(message.createdAt)}
                </span>
              </div>
              <p
                style={{
                  margin: "6px 0 0",
                  whiteSpace: "pre-wrap",
                  ...(message.status === "cancelled"
                    ? { color: "var(--color-text-muted)", textDecoration: "line-through" }
                    : {}),
                }}
              >
                {message.body}
              </p>
              {reason && (
                <p style={{ margin: "4px 0 0", color: "var(--color-text-muted)" }}>
                  {t(locale, `withdraw_${reason}` as StringKey)} — {t(locale, "outbox_not_sent")}
                  {reason === "changed" && ` ${t(locale, "outbox_changed_hint")}`}
                </p>
              )}
              {message.stale && (
                <p style={{ margin: "4px 0 0", color: "var(--color-text-muted)" }}>
                  {t(locale, `withdraw_${message.stale}` as StringKey)} — {t(locale, "outbox_stale")}
                </p>
              )}
              {message.error && message.status !== "cancelled" && (
                <p style={{ margin: "4px 0 0", color: "var(--status-danger-text)" }}>
                  {message.error === "interrupted" ? t(locale, "outbox_interrupted") : message.error}
                </p>
              )}
              {autoSend && message.status === "queued" && !message.stale && (
                <p style={{ margin: "4px 0 0", color: "var(--color-text-muted)" }}>
                  {t(locale, "outbox_auto_waiting")}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {/* With automatic sending on, a queued message goes out by
                  itself: a manual link beside it could send it twice. Only
                  a failed one is offered for sending by hand. */}
              {/* Never a link from the owner's WhatsApp to the owner's own
                  number: those notes only go out automatically. */}
              {(message.status === "failed" || (message.status === "queued" && !autoSend)) &&
                !message.stale &&
                !selfAddressed(message, autoSend) && (
                  <>
                    <a
                      href={waLink(message.toPhone, message.body)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-chip btn-chip--wa btn-chip--icon-text"
                    >
                      {t(locale, "outbox_send")} <IconExternal size={14} />
                    </a>
                    <form action={markMessageSent}>
                      <input type="hidden" name="assetId" value={message.assetId ?? ""} />
                      <input type="hidden" name="messageId" value={message.id} />
                      <button type="submit" className="btn-chip">
                        {t(locale, "outbox_mark_sent")}
                      </button>
                    </form>
                  </>
                )}
              <form action={deleteMessage}>
                <input type="hidden" name="assetId" value={message.assetId ?? ""} />
                <input type="hidden" name="messageId" value={message.id} />
                <button
                  type="submit"
                  className="btn-chip btn-chip--icon btn-chip--danger"
                  aria-label={t(locale, "aria_delete_message")}
                  title={t(locale, "aria_delete_message")}
                >
                  <IconClose size={15} />
                </button>
              </form>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
