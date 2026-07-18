// Pluggable notifier. The MVP ships a MockNotifier that logs to the console and
// records a NotificationLog row-equivalent in memory. Real email/push get added
// later behind the same interface. No third-party service, no real emails.

export interface Notification {
  to: string;
  subject: string;
  body: string;
  searchRequestId: string;
  matchIds: string[];
}

export interface Notifier {
  readonly key: string;
  send(n: Notification): Promise<void>;
}

export class MockNotifier implements Notifier {
  readonly key = "mock";
  /** In-process record of everything "sent" — handy for the cron summary/tests. */
  readonly sent: Notification[] = [];

  async send(n: Notification): Promise<void> {
    this.sent.push(n);
    // eslint-disable-next-line no-console
    console.log(
      `[notify:mock] → ${n.to} | ${n.subject} | ${n.matchIds.length} new match(es) for search ${n.searchRequestId}`,
    );
  }
}

/** Compose a short notification for a batch of new matches. */
export function buildNewMatchesNotification(params: {
  to: string;
  searchRequestId: string;
  rawQuery: string;
  matchIds: string[];
  topSummaries: string[];
}): Notification {
  const { to, searchRequestId, rawQuery, matchIds, topSummaries } = params;
  const lines = [
    `We found ${matchIds.length} new listing(s) matching your search:`,
    `"${rawQuery}"`,
    "",
    ...topSummaries.map((s, i) => `${i + 1}. ${s}`),
  ];
  return {
    to,
    subject: `${matchIds.length} new match(es) for your Tbilisi rental search`,
    body: lines.join("\n"),
    searchRequestId,
    matchIds,
  };
}
