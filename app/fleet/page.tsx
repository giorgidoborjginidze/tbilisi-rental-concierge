import Link from "next/link";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { titled } from "@/lib/i18n/metadata";
import { startOfTodayTbilisi } from "@/lib/time";
import { rentLabel } from "@/lib/rentals/display";
import { deskHref } from "@/lib/rentals/desk";
import { asFleetSort, loadFleetRows, sortFleet, type FleetSort } from "@/lib/fleet/rows";
import { firstParam, type QueryValue } from "@/lib/params";
import { tbilisiFormat } from "@/lib/time";
import { checkTrackerSilenceSoon } from "@/lib/geo/silence-check";
import { formatDueMoney } from "@/lib/format";
import { badgeClass, PAYMENT_TONE, TONE_BADGE, toneOf } from "@/lib/ui/tone";
import { IconArrowRight } from "../icons";

export const dynamic = "force-dynamic";

export const generateMetadata = titled("fleet_title");

// The car rental's fleet: every vehicle and where it stands today — who
// drives it, what is owed and how late, whether the tracker still speaks —
// the most urgent first. Each car opens its service desk (payments, GPS,
// messages). A glance list by default; the table view lays the same rows
// out in columns to sort, and exports them as a spreadsheet.
export default async function FleetPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: QueryValue; sort?: QueryValue }>;
}) {
  const operator = await requireOperator();
  const locale = await getLocale();
  const today = startOfTodayTbilisi();
  const now = new Date();
  await checkTrackerSilenceSoon(operator.id, now);

  const query = await searchParams;
  const view = firstParam(query.view) === "table" ? "table" : "list";
  const sort = asFleetSort(firstParam(query.sort));
  const rows = await loadFleetRows(operator.id, today, now);
  const tableRows = sortFleet(rows, sort);

  const displayName = (a: { name: string; nameKa: string | null }) =>
    locale === "ka" && a.nameKa ? a.nameKa : a.name;
  const fmtDay = tbilisiFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const fmtTime = tbilisiFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  // A column heading that sorts the table by it (a second tap goes back to "most urgent").
  const sortHead = (key: FleetSort, label: StringKey, num = false) => (
    <th scope="col" className={num ? "num" : undefined} aria-sort={sort === key ? (key === "owed" ? "descending" : "ascending") : undefined}>
      <Link href={`/fleet?view=table${sort === key ? "" : `&sort=${key}`}`} className="fleet-sort" scroll={false}>
        {t(locale, label)}
        {sort === key ? (key === "owed" ? " ↓" : " ↑") : ""}
      </Link>
    </th>
  );
  const rented = rows.filter((row) => row.running).length;
  // Late means money: past its due date (grace or repossession) or a
  // finished rental still owing. A car outside its red line is counted on
  // its own — it may be fully paid.
  const late = rows.filter(
    (row) => row.endedOwing || row.status?.state === "grace" || row.status?.state === "repossess",
  ).length;
  const outsideCount = rows.filter((row) => row.outside).length;

  return (
    <main>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ marginBottom: 0 }}>{t(locale, "fleet_title")}</h1>
        <Link href="/assets/new?category=vehicle" className="btn-primary">
          {t(locale, "fleet_add")}
        </Link>
      </div>
      <p className="page-lead">
        {t(locale, "fleet_intro")}
        {rows.length > 0 && (
          <>
            <br />
            <b>
              {t(locale, "fleet_rented_count")
                .replace("{n}", String(rented))
                .replace("{total}", String(rows.length))}
            </b>
            {late > 0 && (
              <>
                {" · "}
                <b style={{ color: "var(--status-danger-text)" }}>
                  {t(locale, "fleet_late_count").replace("{n}", String(late))}
                </b>
              </>
            )}
            {outsideCount > 0 && (
              <>
                {" · "}
                <b style={{ color: "var(--status-danger-text)" }}>
                  {t(locale, "fleet_outside_count").replace("{n}", String(outsideCount))}
                </b>
              </>
            )}
          </>
        )}
      </p>

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2" style={{ margin: "4px 0 12px" }}>
          <nav className="flex flex-wrap gap-2" aria-label={t(locale, "fleet_view")}>
            {(["list", "table"] as const).map((key) => (
              <Link
                key={key}
                href={key === "table" ? `/fleet?view=table${sort !== "urgent" ? `&sort=${sort}` : ""}` : "/fleet"}
                className={`btn-chip${view === key ? " btn-chip--active" : ""}`}
                aria-current={view === key ? "true" : undefined}
              >
                {t(locale, key === "table" ? "fleet_view_table" : "fleet_view_list")}
              </Link>
            ))}
          </nav>
          <a href={`/fleet/export?sort=${sort}`} className="btn-chip" download>
            {t(locale, "fleet_export")}
          </a>
        </div>
      )}

      {rows.length > 0 && view === "table" ? (
        <>
        {/* The order, for phones too (the stacked table has no headings to tap). */}
        <nav className="flex flex-wrap items-center gap-2" aria-label={t(locale, "fleet_sort")} style={{ marginBottom: 10 }}>
          <span className="cell-sub">{t(locale, "fleet_sort")}:</span>
          {(["urgent", "name", "owed", "end", "ping"] as const).map((key) => (
            <Link
              key={key}
              href={`/fleet?view=table${key === "urgent" ? "" : `&sort=${key}`}`}
              className={`btn-chip${sort === key ? " btn-chip--active" : ""}`}
              aria-current={sort === key ? "true" : undefined}
              scroll={false}
            >
              {t(locale, `fleet_sort_${key}`)}
            </Link>
          ))}
        </nav>
        <div className="card card--stack fleet-table">
          <table>
            <thead>
              <tr>
                {sortHead("name", "fleet_col_car")}
                <th scope="col">{t(locale, "fleet_col_driver")}</th>
                <th scope="col">{t(locale, "fleet_col_rent")}</th>
                {sortHead("end", "fleet_col_end")}
                <th scope="col">{t(locale, "fleet_col_paid")}</th>
                {sortHead("owed", "fleet_col_owed", true)}
                {sortHead("ping", "fleet_col_tracker")}
              </tr>
            </thead>
            <tbody>
              {tableRows.map(({ vehicle, running, money, status, owes, endedOwing, silent, outside, lastPingAt }) => (
                <tr key={vehicle.id}>
                  <td data-label={t(locale, "fleet_col_car")}>
                    <Link href={deskHref(vehicle.id, "vehicle")} className="link">{displayName(vehicle)}</Link>
                    {vehicle.plateNumber && <div className="cell-sub">{vehicle.plateNumber}</div>}
                  </td>
                  <td data-label={t(locale, "fleet_col_driver")}>
                    {running ? running.tenantName ?? "—" : <span className="cell-sub">{t(locale, "fleet_free")}</span>}
                    {running?.tenantPhone && <div className="cell-sub">{running.tenantPhone}</div>}
                  </td>
                  <td data-label={t(locale, "fleet_col_rent")}>{running ? rentLabel(locale, running) : "—"}</td>
                  <td data-label={t(locale, "fleet_col_end")}>{running ? fmtDay.format(running.endDate) : "—"}</td>
                  <td data-label={t(locale, "fleet_col_paid")}>
                    {status && money ? (
                      <span className={badgeClass(toneOf(PAYMENT_TONE, status.state))}>
                        {fmtDay.format(status.paidThrough)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="num" data-label={t(locale, "fleet_col_owed")}>
                    {owes && status && money ? (
                      <Link
                        href={deskHref(vehicle.id, "vehicle", "payments")}
                        className={`badge badge--link ${TONE_BADGE[endedOwing || status.state === "repossess" ? "danger" : "warn"]}`}
                      >
                        {formatDueMoney(status.amountDue, money.currency)}
                        {status.daysOverdue > 0 ? ` · ${t(locale, "fleet_days_late").replace("{n}", String(status.daysOverdue))}` : ""}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td data-label={t(locale, "fleet_col_tracker")}>
                    {outside ? (
                      <Link href={deskHref(vehicle.id, "vehicle", "gps")} className="badge badge--link badge--danger">
                        {t(locale, "fence_status_outside")}
                      </Link>
                    ) : silent ? (
                      <Link href={deskHref(vehicle.id, "vehicle", "gps")} className="badge badge--link badge--warn">
                        {t(locale, "fence_status_unknown")}
                      </Link>
                    ) : lastPingAt ? (
                      <span className="cell-sub">{fmtTime.format(lastPingAt)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : rows.length === 0 ? (
        <div className="alert-card alert-card--info" style={{ alignItems: "center" }}>
          <div className="alert-card__detail" style={{ marginTop: 0 }}>
            {t(locale, "fleet_empty")}
          </div>
          <Link href="/assets/new?category=vehicle" className="btn-primary btn-compact">
            {t(locale, "fleet_add")}
          </Link>
        </div>
      ) : (
        <ul className="fleet-list" data-tour="fleet">
          {rows.map(({ vehicle, running, money, status, owes, endedOwing, silent, outside }) => (
            <li key={vehicle.id} className="card fleet-row">
              <div className="fleet-row__main">
                <Link href={deskHref(vehicle.id, "vehicle")} className="link fleet-row__name">
                  {displayName(vehicle)}
                </Link>
                {vehicle.plateNumber && <span className="desk-plate">{vehicle.plateNumber}</span>}
                <div className="fleet-row__sub">
                  {running
                    ? `${running.tenantName ?? "—"} · ${rentLabel(locale, running)}`
                    : t(locale, "fleet_free")}
                </div>
              </div>
              <div className="fleet-row__badges">
                {owes && status && money ? (
                  <Link
                    href={deskHref(vehicle.id, "vehicle", "payments")}
                    className={`badge badge--link ${
                      TONE_BADGE[endedOwing || status.state === "repossess" ? "danger" : "warn"]
                    }`}
                  >
                    {endedOwing
                      ? `${t(locale, "alert_unpaid")}: ${formatDueMoney(status.amountDue, money.currency)}`
                      : t(locale, "fleet_late_badge")
                          .replace("{amount}", formatDueMoney(status.amountDue, money.currency))
                          .replace("{days}", String(status.daysOverdue))
                          .replace("{grace}", String(status.graceDays))}
                  </Link>
                ) : status && running ? (
                  <span className={badgeClass(toneOf(PAYMENT_TONE, status.state))}>
                    {t(locale, `pstate_${status.state}` as StringKey)}
                  </span>
                ) : null}
                {outside && (
                  <Link
                    href={deskHref(vehicle.id, "vehicle", "gps")}
                    className="badge badge--link badge--danger"
                  >
                    {t(locale, "fence_status_outside")}
                  </Link>
                )}
                {silent && (
                  <Link
                    href={deskHref(vehicle.id, "vehicle", "gps")}
                    className="badge badge--link badge--warn"
                  >
                    {t(locale, "fence_status_unknown")}
                  </Link>
                )}
              </div>
              <Link
                href={deskHref(vehicle.id, "vehicle")}
                className="btn-chip btn-chip--icon"
                aria-label={`${t(locale, "desk_open")}: ${displayName(vehicle)}`}
                title={t(locale, "desk_open")}
              >
                <IconArrowRight size={16} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
