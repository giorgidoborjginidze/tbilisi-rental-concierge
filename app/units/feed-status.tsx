import { t, type Locale, type StringKey } from "@/lib/i18n/strings";
import { tbilisiFormat } from "@/lib/time";
import { FEED_ERRORS, type FeedError } from "@/lib/ical/fetch";
import { isDemoFeedUrl } from "@/lib/ical/sync";

// How each iCal link of a unit last synced: when, how many stays, what was
// cancelled — or, in red, why it failed. Used on /units and the unit edit
// page. Server-rendered; takes the unit's UnitFeed rows.

export interface FeedRow {
  url: string;
  source: string;
  lastAttemptAt: Date | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
  lastStatus: number | null;
  lastCount: number | null;
  lastCancelled: number | null;
}

const SOURCE_NAME: Record<string, string> = { airbnb: "Airbnb", booking: "Booking.com" };
const sourceOf = (url: string) =>
  /airbnb\./i.test(url) ? "airbnb" : /booking\./i.test(url) ? "booking" : "direct";

export function feedSourceName(source: string, url: string): string {
  if (SOURCE_NAME[source]) return SOURCE_NAME[source];
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "iCal";
  }
}

export function feedErrorText(locale: Locale, code: string | null, status: number | null): string {
  const known = FEED_ERRORS.includes(code as FeedError) ? (code as FeedError) : "unreachable";
  return t(locale, `feed_err_${known}` as StringKey).replace("{status}", String(status ?? ""));
}

export default function FeedStatus({
  locale,
  urls,
  feeds,
  compact = false,
}: {
  locale: Locale;
  /** The unit's current links, in the order the owner wrote them. */
  urls: string[];
  feeds: FeedRow[];
  /** One short line per link (the /units table). */
  compact?: boolean;
}) {
  if (urls.length === 0) return null;
  const stamp = tbilisiFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const byUrl = new Map(feeds.map((feed) => [feed.url, feed]));

  return (
    <ul className={`feed-status${compact ? " feed-status--compact" : ""}`}>
      {urls.map((url) => {
        const feed = byUrl.get(url);
        const name = feedSourceName(feed?.source ?? sourceOf(url), url);
        const failed = Boolean(feed?.lastError);
        let text: string;
        if (isDemoFeedUrl(url)) {
          text = t(locale, "feed_demo");
        } else if (!feed || (!feed.lastSyncedAt && !feed.lastError)) {
          text = t(locale, "feed_never");
        } else if (failed) {
          text = t(locale, "feed_failed").replace(
            "{reason}",
            feedErrorText(locale, feed.lastError, feed.lastStatus),
          );
          if (!compact && feed.lastSyncedAt) {
            text += ` · ${t(locale, "feed_last_ok").replace("{when}", stamp.format(feed.lastSyncedAt))}`;
          }
        } else {
          text = t(locale, "feed_last_sync").replace("{when}", stamp.format(feed.lastSyncedAt!));
          if (feed.lastCount != null) {
            text += ` · ${t(locale, "feed_count").replace("{n}", String(feed.lastCount))}`;
          }
          if (feed.lastCancelled) {
            text += ` · ${t(locale, "feed_cancelled").replace("{n}", String(feed.lastCancelled))}`;
          }
        }
        return (
          <li key={url} data-state={failed ? "error" : feed?.lastSyncedAt ? "ok" : "never"}>
            <b>{name}</b> <span>{text}</span>
          </li>
        );
      })}
    </ul>
  );
}
