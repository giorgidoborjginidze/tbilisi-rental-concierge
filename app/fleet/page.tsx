import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { titled } from "@/lib/i18n/metadata";
import { startOfTodayTbilisi } from "@/lib/time";
import { activeContract, contractPhase } from "@/lib/rentals/phase";
import { settlementContract, statusFor } from "@/lib/rentals/terms";
import { rentLabel } from "@/lib/rentals/display";
import { deskHref, fleetRank } from "@/lib/rentals/desk";
import { evaluateFence, shapeFromRow } from "@/lib/geo/fence";
import { isTrackerSilent } from "@/lib/geo/silence";
import { formatDueMoney } from "@/lib/format";
import { badgeClass, PAYMENT_TONE, TONE_BADGE, toneOf } from "@/lib/ui/tone";
import { IconArrowRight } from "../icons";
import { LIVE_CONTRACT } from "@/lib/rentals/live";

export const dynamic = "force-dynamic";

export const generateMetadata = titled("fleet_title");

// The car rental's fleet: every vehicle and where it stands today — who
// drives it, what is owed and how late, whether the tracker still speaks —
// the most urgent first. Each car opens its service desk (payments, GPS,
// messages). A glance list, not a spreadsheet.
export default async function FleetPage() {
  const operator = await requireOperator();
  const locale = await getLocale();
  const today = startOfTodayTbilisi();
  const now = new Date();

  const vehicles = await prisma.asset.findMany({
    where: { operatorId: operator.id, category: "vehicle" },
    include: {
      contracts: { where: LIVE_CONTRACT, orderBy: { endDate: "desc" } },
      gpsDevice: true,
      geofences: { where: { active: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = vehicles.map((vehicle) => {
    const running = activeContract(vehicle.contracts, today) ?? null;
    const money = settlementContract(vehicle.contracts, today, vehicle) ?? null;
    const endedOwing = money != null && contractPhase(money, today) === "ended";
    const status = money?.paidThrough ? statusFor(money, today, vehicle) : null;
    const owes = status != null && status.periodsOwed > 0 && status.amountDue > 0;
    const device = vehicle.gpsDevice;
    const watched = vehicle.geofences.length > 0 && running != null;
    const silent = watched && device?.lastPingAt != null && isTrackerSilent(device.lastPingAt, now);
    const position =
      device?.lastLat != null && device.lastLng != null && !silent
        ? { lat: device.lastLat, lng: device.lastLng }
        : null;
    const outside =
      position != null &&
      vehicle.geofences.some((fence) => {
        const shape = shapeFromRow(fence);
        return shape ? evaluateFence(shape, fence.approachKm, position).zone === "outside" : false;
      });
    return {
      vehicle,
      running,
      money,
      status,
      owes: owes && (endedOwing || running != null),
      endedOwing: endedOwing && owes,
      silent,
      outside,
      rank: fleetRank({
        payState: status?.state ?? null,
        endedOwing: endedOwing && owes,
        outside,
        silent,
        rented: running != null,
      }),
    };
  });
  rows.sort((a, b) => a.rank - b.rank || a.vehicle.name.localeCompare(b.vehicle.name));

  const displayName = (a: { name: string; nameKa: string | null }) =>
    locale === "ka" && a.nameKa ? a.nameKa : a.name;
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

      {rows.length === 0 ? (
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
                      : `${formatDueMoney(status.amountDue, money.currency)} · ${t(locale, "pay_days_overdue")}: ${status.daysOverdue}/${status.graceDays}`}
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
