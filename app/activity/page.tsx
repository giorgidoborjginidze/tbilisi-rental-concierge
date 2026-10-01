import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { titled } from "@/lib/i18n/metadata";
import { tbilisiFormat } from "@/lib/time";
import { firstParam, type QueryValue } from "@/lib/params";

// The workspace's activity: who did what, newest first, by day — the
// owner's view of a team's work (and their own history). Read-only; lines
// are written by the actions themselves (lib/activity/log.ts).
export const dynamic = "force-dynamic";
export const generateMetadata = titled("activity_title");

const PAGE = 100;

/** Where a line leads, when its thing still exists somewhere to open. */
function hrefOf(type: string | null, id: string | null, action: string): string | null {
  if (!id || action.endsWith(".delete")) return null;
  if (type === "asset") return `/assets/${id}/edit`;
  if (type === "unit") return `/units/${id}/edit`;
  if (type === "invoice") return `/invoices/${id}`;
  if (type === "booking") return `/bookings/${id}/edit`;
  return null;
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ who?: QueryValue; before?: QueryValue }>;
}) {
  const operator = await requireOperator();
  const locale = await getLocale();
  const query = await searchParams;
  const who = firstParam(query.who) ?? null;
  const beforeRaw = firstParam(query.before);
  const before = beforeRaw && !Number.isNaN(Date.parse(beforeRaw)) ? new Date(beforeRaw) : null;

  const [lines, people] = await Promise.all([
    prisma.activityLog.findMany({
      where: {
        operatorId: operator.id,
        ...(who ? { actorId: who } : {}),
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE + 1,
    }),
    prisma.activityLog.groupBy({
      by: ["actorId", "actorName"],
      where: { operatorId: operator.id },
      _count: { _all: true },
    }),
  ]);
  const more = lines.length > PAGE;
  const shown = lines.slice(0, PAGE);
  const fmtDay = tbilisiFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  const fmtTime = tbilisiFormat(locale, { hour: "2-digit", minute: "2-digit" });
  const days = new Map<string, typeof shown>();
  for (const line of shown) {
    const key = fmtDay.format(line.createdAt);
    days.set(key, [...(days.get(key) ?? []), line]);
  }
  const actors = people.filter((p) => p.actorId).sort((a, b) => b._count._all - a._count._all);

  return (
    <main style={{ maxWidth: 860 }}>
      <h1>{t(locale, "activity_title")}</h1>
      <p className="page-lead">{t(locale, "activity_lead")}</p>

      {actors.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label={t(locale, "activity_who")} style={{ marginBottom: 14 }}>
          <Link href="/activity" className={`btn-chip${!who ? " btn-chip--active" : ""}`} aria-current={!who ? "true" : undefined}>
            {t(locale, "activity_everyone")}
          </Link>
          {actors.map((actor) => (
            <Link
              key={actor.actorId}
              href={`/activity?who=${actor.actorId}`}
              className={`btn-chip${who === actor.actorId ? " btn-chip--active" : ""}`}
              aria-current={who === actor.actorId ? "true" : undefined}
            >
              {actor.actorName ?? "—"}
            </Link>
          ))}
        </nav>
      )}

      {shown.length === 0 ? (
        <p className="files-empty">{t(locale, "activity_empty")}</p>
      ) : (
        [...days].map(([day, rows]) => (
          <section key={day} className="activity-day">
            <h2>{day}</h2>
            <ul className="activity-list">
              {rows.map((line) => {
                const href = hrefOf(line.targetType, line.targetId, line.action);
                const what = t(locale, `act_${line.action.replace(".", "_")}` as StringKey) || line.action;
                return (
                  <li key={line.id}>
                    <time dateTime={line.createdAt.toISOString()}>{fmtTime.format(line.createdAt)}</time>
                    <span className="activity-list__text">
                      <strong>{line.actorName ?? t(locale, "activity_system")}</strong> {what}
                      {line.label && (
                        <>
                          {": "}
                          {href ? <Link href={href} className="link">{line.label}</Link> : <span>{line.label}</span>}
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      {more && (
        <p style={{ marginTop: 16 }}>
          <Link
            href={`/activity?${new URLSearchParams({ ...(who ? { who } : {}), before: shown[shown.length - 1].createdAt.toISOString() })}`}
            className="btn-secondary"
          >
            {t(locale, "activity_older")}
          </Link>
        </p>
      )}
    </main>
  );
}
