import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { addAssetToRentals, restoreContract } from "@/lib/assets/actions";
import { dayPrice } from "@/lib/assets/daily-price";
import OccupancyCalendar from "./occupancy-calendar";
import HoldingView from "./holding-view";
import { LISTING_PLATFORMS, parseChannelLinks } from "@/lib/types";
import AssetForm from "../../asset-form";
import ContractForm from "../../contract-form";
import KeepOpenFold from "@/app/keep-open-fold";
import ContractList, { type ContractRow } from "../../contract-list";
import { CONTRACT_LABEL_KEYS } from "../../contract-labels";
import ListingControls, { type ListingLink } from "../../listing-controls";
import DoorKey from "../../door-key";
import { assetFormProps } from "../../form-helpers";
import { dayKey, monthStartTbilisi, startOfTodayTbilisi, tbilisiFormat } from "@/lib/time";
import { activeContract as runningContract, assetStatusNow, contractPhase } from "@/lib/rentals/phase";
import { rentLabel } from "@/lib/rentals/display";
import { loadAssetSources } from "@/lib/property/places";
import { contractNightValue, dayFills, emptySources, placeStays } from "@/lib/property/stays";
import { cityLabel, districtLabel } from "@/lib/places";
import { titled } from "@/lib/i18n/metadata";
import { formatMoney } from "@/lib/format";
import { rentalDesk } from "@/lib/rentals/desk";
import { IconAlert, IconArrowLeft, IconArrowRight, IconRestart } from "@/app/icons";
import { SeverityIcon } from "@/app/alert-icon";
import { LIVE_CONTRACT, restorableSince } from "@/lib/rentals/live";
import { periodAmount } from "@/lib/rentals/terms";
import { firstParam, type QueryValue } from "@/lib/params";

export const dynamic = "force-dynamic";

export const generateMetadata = titled("asset_edit_title");

const DAY_MS = 86_400_000;

const STATUS_BADGE: Record<string, string> = {
  rented: "badge--rented",
  str: "badge--str",
  vacant: "badge--vacant",
  personal_use: "badge--personal",
  listed: "badge--listed",
};

const KIND_CLASS: Record<string, string> = {
  airbnb: "cal-cell--airbnb",
  booking: "cal-cell--booking",
  direct: "cal-cell--direct",
  manual: "cal-cell--direct",
  lease: "cal-cell--lease",
  // A day-let contract and a "rented today?" answer are let directly.
  contract: "cal-cell--direct",
  day: "cal-cell--direct",
};

export default async function EditAssetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    added?: QueryValue;
    deleted?: QueryValue;
    restored?: QueryValue;
    add?: QueryValue;
    trade?: QueryValue;
  }>;
}) {
  const operator = await requireOperator();

  const { id } = await params;
  const query = await searchParams;
  const justAdded = firstParam(query.added) === "1";
  const asset = await prisma.asset.findFirst({
    where: { id, operatorId: operator.id },
    include: {
      contracts: {
        where: LIVE_CONTRACT,
        orderBy: { endDate: "desc" },
        include: { _count: { select: { payments: true } } },
      },
      // Today's "rented" answer of a day-let asset (its nights are daily
      // answers, not contracts).
      days: { where: { date: startOfTodayTbilisi(), rented: true }, select: { id: true } },
      unit: { select: { id: true, name: true, nameKa: true, operatorId: true, channelLinks: true } },
    },
  });
  if (!asset) notFound();

  const locale = await getLocale();

  // Crypto, shares and precious metals have their own view: live
  // valuation and the buys and sells.
  if (asset.category === "crypto" || asset.category === "stock" || asset.category === "metal") {
    return (
      <HoldingView
        kind={asset.category}
        asset={{ id: asset.id, name: asset.name, symbol: asset.symbol, coingeckoId: asset.coingeckoId }}
        locale={locale}
        justAdded={justAdded}
        deleteBlocked={firstParam(query.trade) === "blocked"}
      />
    );
  }
  const props = await assetFormProps(locale, operator.id, asset.id);
  const isIncome = asset.category === "income_source";
  const desk = rentalDesk(asset.category, asset.contracts.length);

  const today = startOfTodayTbilisi();
  const activeContract = runningContract(asset.contracts, today);
  // The asset follows its contracts: a lease that ended in August no
  // longer keeps it "rented".
  const ownStatus = assetStatusNow(asset, asset.contracts, today, { rentedToday: asset.days.length > 0 });
  const status = activeContract ? "rented" : asset.unitId ? "str" : ownStatus;
  // The form's status select ignores today's daily "rented" answer: that
  // answer is one night, not the asset's standing status, and saving the
  // form must never turn it into a permanent "rented".
  const formStatus = assetStatusNow(asset, asset.contracts, today);

  const record = asset as unknown as Record<string, string | null>;
  const links: ListingLink[] =
    status === "personal_use"
      ? []
      : (LISTING_PLATFORMS[asset.category] ?? [])
          .filter((platform) => record[platform.field])
          .map((platform) => ({
            platform: platform.key,
            label: platform.label,
            url: record[platform.field]!,
          }));

  const displayName =
    locale === "ka" && asset.nameKa ? asset.nameKa : asset.name;

  // ── Per-asset occupancy calendar: 2 months back through 3 ahead. ──
  // The same nights as the Rentals calendar (lib/property/stays.ts): the
  // contracts, the linked unit's bookings and leases, and the daily
  // answers — which only fill nights no stay holds. Finished contracts are
  // drawn too: a past stay is part of the record.
  const calStart = monthStartTbilisi(-2);
  const calEnd = monthStartTbilisi(4);
  const showCalendar = !isIncome;
  const isDaily = asset.rentalMode === "daily";
  const sources = showCalendar
    ? (await loadAssetSources(operator.id, [asset.id], { start: calStart, end: calEnd })).get(asset.id) ??
      emptySources()
    : emptySources();
  const stays = placeStays(sources);
  const fills = dayFills(sources);
  const dayAmounts = new Map(sources.days.map((day) => [day.date.getTime(), day.amount]));
  const bookingsById = new Map(sources.bookings.map((b) => [b.id, b]));
  const contractsById = new Map(sources.contracts.map((c) => [c.id, c]));
  // What one night of a stay was let for, when known.
  const nightAmount = (stay: (typeof stays)[number], night: Date): number | null => {
    if (stay.record === "booking") {
      const booking = bookingsById.get(stay.id);
      return booking?.amount != null && booking.nights > 0 ? Math.round(booking.amount / booking.nights) : null;
    }
    if (stay.record === "contract" && isDaily) {
      const contract = contractsById.get(stay.id);
      return contract ? Math.round(contractNightValue(contract, night.getTime(), sources)) : null;
    }
    if (stay.record === "day") return dayAmounts.get(night.getTime()) ?? null;
    return null;
  };

  // Daily pricing: base rate + weekend/holiday premiums → per-day price
  // tooltips (rented days show the actual booked/contracted price).
  const hasDailyPricing =
    asset.rentalMode === "daily" && asset.dailyRate != null && asset.dailyRate > 0;
  const weekendPct = asset.weekendPct ?? 0;
  const holidayPct = asset.holidayPct ?? 0;

  const fmtMonth = tbilisiFormat(locale, { month: "short" });
  const fmtDate = tbilisiFormat(locale, {
    day: "numeric", month: "short", year: "numeric",
  });

  const fmtDay = tbilisiFormat(locale, { day: "numeric", month: "short" });

  const months: {
    label: string;
    current: boolean;
    days: { iso: string; cls: string; title: string }[];
  }[] = [];
  if (showCalendar) {
    for (let m = 0; m < 6; m++) {
      const mStart = new Date(Date.UTC(calStart.getUTCFullYear(), calStart.getUTCMonth() + m, 1));
      const mEnd = new Date(Date.UTC(mStart.getUTCFullYear(), mStart.getUTCMonth() + 1, 1));
      const dayCount = Math.round((mEnd.getTime() - mStart.getTime()) / DAY_MS);
      const days = Array.from({ length: dayCount }, (_, i) => {
        const dayStart = new Date(mStart.getTime() + i * DAY_MS);
        const dayEnd = new Date(dayStart.getTime() + DAY_MS);
        const covering = [
          ...stays.filter((s) => s.start < dayEnd && s.end > dayStart),
        ];
        const answered = covering.length === 0
          ? fills.find((s) => s.start < dayEnd && s.end > dayStart)
          : undefined;
        if (answered) covering.push(answered);
        const cls =
          covering.length > 1
            ? "cal-cell--overlap"
            : covering.length === 1
              ? KIND_CLASS[covering[0].kind] ?? KIND_CLASS.direct
              : "";
        const rented = covering.length > 0;
        const amount = rented ? nightAmount(covering[0], dayStart) : null;
        const priceText = rented
          ? amount != null
            ? ` · ${formatMoney(amount)}`
            : ""
          : hasDailyPricing
            ? ` · ${formatMoney(dayPrice(dayStart, asset.dailyRate!, weekendPct, holidayPct))}`
            : "";
        const statusText = rented
          ? t(locale, "status_rented")
          : t(locale, "calendar_vacant");
        return {
          iso: dayKey(dayStart),
          cls,
          title: `${fmtDay.format(dayStart)} — ${statusText}${priceText}`,
        };
      });
      months.push({
        label: fmtMonth.format(mStart),
        current: mStart.getTime() === monthStartTbilisi(0).getTime(),
        days,
      });
    }
  }

  const calendarLabelKeys: StringKey[] = [
    "drag_hint", "drag_hint_daily", "mark_range_title", "mark_save", "mark_not_rented",
    "mark_amount_night", "mark_note", "nights_short",
    "contract_start", "contract_end", "contract_amount_monthly", "contract_amount_daily",
    "contract_tenant", "cancel", "error_required", "error_invalid_number",
    "error_dates", "error_days_taken", "notice_days_held", "notice_days_held_link",
    "tap_hint", "calendar_prev_month", "calendar_next_month",
  ];
  // Monday-first short weekday names for the phone's month view
  // (5 January 2026 was a Monday).
  const fmtWeekday = tbilisiFormat(locale, { weekday: "short" });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    fmtWeekday.format(new Date(Date.UTC(2026, 0, 5 + i, 12))),
  );
  const calendarLabels = Object.fromEntries(
    calendarLabelKeys.map((key) => [key, t(locale, key)]),
  );
  // A car let by the day has a driver, not a guest.
  if (asset.category === "vehicle") calendarLabels.mark_note = t(locale, "mark_note_driver");

  const contractLabels = Object.fromEntries(
    CONTRACT_LABEL_KEYS.map((key) => [key, t(locale, key)]),
  );
  // A car has a driver, not a tenant.
  if (asset.category === "vehicle") {
    contractLabels.contract_tenant = t(locale, "contract_driver");
    contractLabels.tenant_phone = t(locale, "driver_phone");
  }

  // ── Contracts: the live ones (editable), a notice after a delete or an
  // undo, and the ones deleted in the last 30 days (can be brought back). ──
  const deletedParam = firstParam(query.deleted);
  const restoredParam = firstParam(query.restored);
  const deleted = isIncome
    ? []
    : await prisma.rentalContract.findMany({
        where: {
          assetId: asset.id,
          deletedAt: { gte: restorableSince() },
        },
        orderBy: { deletedAt: "desc" },
        include: { _count: { select: { payments: true } } },
      });
  const justDeleted = deletedParam ? deleted.find((c) => c.id === deletedParam) : undefined;
  const justRestored = restoredParam ? asset.contracts.find((c) => c.id === restoredParam) : undefined;
  const contractSummary = (contract: {
    tenantName: string | null;
    tenantPhone: string | null;
    startDate: Date;
    endDate: Date;
    paymentPeriod: string;
    paymentAmount: number | null;
    monthlyRent: number;
    currency: string;
  }) =>
    `${rentLabel(locale, contract)} · ${contract.tenantName ?? "—"}${
      contract.tenantPhone ? ` (${contract.tenantPhone})` : ""
    } · ${fmtDate.format(contract.startDate)} – ${fmtDate.format(contract.endDate)}`;
  const contractRows: ContractRow[] = asset.contracts.map((contract) => ({
    id: contract.id,
    summary: contractSummary(contract),
    phase: `(${t(locale, `cstatus_${contractPhase(contract, today)}` as StringKey)})`,
    payments: contract._count.payments,
    values: {
      tenantName: contract.tenantName ?? "",
      tenantPhone: contract.tenantPhone ?? "",
      paymentPeriod: contract.paymentPeriod,
      amount: String(periodAmount(contract)),
      startDate: dayKey(contract.startDate),
      endDate: dayKey(contract.endDate),
      paidThrough: contract.paidThrough ? dayKey(contract.paidThrough) : "",
      graceDays: String(contract.graceDays),
      deposit: contract.deposit?.toString() ?? "",
      notes: contract.notes ?? "",
      remindersEnabled: contract.remindersEnabled,
    },
  }));
  const restoreButton = (contractId: string, label: string) => (
    <form action={restoreContract}>
      <input type="hidden" name="contractId" value={contractId} />
      <input type="hidden" name="assetId" value={asset.id} />
      <button type="submit" className="btn-chip btn-chip--icon-text">
        <IconRestart size={14} /> {label}
      </button>
    </form>
  );

  const contractsSection = !isIncome && (
    <section id="contracts" style={{ scrollMarginTop: 80 }}>
      <h2>{t(locale, "contracts_title")}</h2>
      {justDeleted && (
        <div className="alert-card alert-card--warn undo-note" role="status">
          <span className="alert-card__notice">
            <SeverityIcon severity="warn" />
            <span>
              {t(locale, "contract_deleted_note").replace("{name}", justDeleted.tenantName ?? "—")}
            </span>
          </span>
          {restoreButton(justDeleted.id, t(locale, "contract_undo"))}
        </div>
      )}
      {justRestored && (
        <p className="alert-card alert-card--good" role="status" style={{ display: "block", fontSize: 13 }}>
          {t(locale, "contract_restored_note").replace("{name}", justRestored.tenantName ?? "—")}
        </p>
      )}
      <ContractList assetId={asset.id} rows={contractRows} labels={contractLabels} />
      {/* Starts open for a first contract (or ?add=contract) and stays
          open after the save, so its "added" line is seen. */}
      <KeepOpenFold
        key={firstParam(query.add) ?? "fold"}
        initialOpen={asset.contracts.length === 0 || firstParam(query.add) === "contract"}
        summary={t(locale, "contract_add")}
      >
        <ContractForm assetId={asset.id} labels={contractLabels} />
      </KeepOpenFold>
      {deleted.length > 0 && (
        <details className="desk-fold" style={{ marginTop: 12 }}>
          <summary>{t(locale, "contract_trash").replace("{n}", String(deleted.length))}</summary>
          <p className="field-hint" style={{ marginTop: 0 }}>{t(locale, "contract_trash_hint")}</p>
          <ul className="space-y-2">
            {deleted.map((contract) => (
              <li key={contract.id} className="alert-card contract-row">
                <div className="contract-row__main">
                  <div className="contract-row__text" style={{ color: "var(--color-text-muted)" }}>
                    {contractSummary(contract)}
                    {contract._count.payments > 0 &&
                      ` · ${t(locale, "contract_payments_kept").replace("{n}", String(contract._count.payments))}`}
                  </div>
                  {restoreButton(contract.id, t(locale, "contract_restore"))}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );

  return (
    <main>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ marginBottom: 0 }}>{displayName}</h1>
        <div className="flex flex-wrap gap-1.5">
          {/* Only what is rented out gets the service desk (a car: payments,
              GPS red lines, messages; a flat: payments and tenant messages). */}
          {desk && (
            // A real button, not a "selected" chip: it is the way into the
            // payment schedule and the messages.
            <Link href={`/assets/${asset.id}/rental`} className="btn-primary btn-compact icon-text">
              {t(locale, "rental_open_service")} <IconArrowRight size={15} />
            </Link>
          )}
          <Link href="/assets" className="btn-chip btn-chip--icon-text">
            <IconArrowLeft size={14} /> {t(locale, "assets_title")}
          </Link>
        </div>
      </div>

      {/* ── Summary: status, listings, door key — same controls as the list ── */}
      <div className="alert-card" style={{ display: "block" }}>
        <div className="flex flex-wrap items-center gap-1.5">
          {isIncome ? (
            <>
              <span className="badge badge--tag">{t(locale, "income_recurring")}</span>
              <span style={{ fontWeight: 600 }}>
                {formatMoney(asset.monthlyIncome ?? 0)} / {t(locale, "per_month_word")}
              </span>
            </>
          ) : (
            <>
              <span className={`badge ${STATUS_BADGE[status] ?? STATUS_BADGE.personal_use}`}>
                {t(locale, `status_${status}` as StringKey)}
              </span>
              {asset.rentalMode === "daily" && (
                <span className="badge badge--str">{t(locale, "mode_daily")}</span>
              )}
              {asset.unit && asset.unit.operatorId === operator.id && (
                <Link href={`/calendar?unit=${asset.unit.id}`} className="link" style={{ fontSize: 13 }}>
                  ({locale === "ka" && asset.unit.nameKa ? asset.unit.nameKa : asset.unit.name})
                </Link>
              )}
              {/* A day-let flat from before units and assets were linked:
                  one click gives it its calendar unit. */}
              {!asset.unitId && asset.category === "real_estate" && asset.rentalMode === "daily" && (
                <form action={addAssetToRentals}>
                  <input type="hidden" name="assetId" value={asset.id} />
                  <button type="submit" className="btn-chip">{t(locale, "units_add_from_asset")}</button>
                </form>
              )}
            </>
          )}
        </div>
        {!isIncome && status !== "str" && (
          <ListingControls
            assetId={asset.id}
            status={status}
            showButtons={!activeContract && status !== "personal_use"}
            links={links}
            labels={{
              rented: t(locale, "mark_rented"),
              vacant: t(locale, "mark_vacant"),
            }}
          />
        )}
        {asset.category === "real_estate" && status !== "personal_use" && (
          <div style={{ marginTop: 8 }}>
          <DoorKey
            assetId={asset.id}
            code={asset.doorCode}
            phone={activeContract?.tenantPhone?.replace(/\D/g, "") || null}
            message={`${displayName}${asset.address ? ` (${asset.address})` : ""} — ${t(locale, "door_key")}:`}
            labels={{
              key: t(locale, "door_key"),
              generate: t(locale, "door_generate"),
            }}
          />
          </div>
        )}
      </div>

      {justAdded && (
        <p className="alert-card alert-card--good" role="status" style={{ display: "block", fontSize: 13 }}>
          {t(locale, "asset_added_note").replace("{name}", displayName)}
        </p>
      )}

      {/* ── Who rents it: first, so a new tenant is one tap away. ── */}
      {contractsSection}

      {/* ── Occupancy calendar: when this asset was rented and when not ── */}
      {showCalendar && (
        <section>
          <h2>{t(locale, "nav_calendar")}</h2>
          {hasDailyPricing && (
            <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: "0 0 10px" }}>
              {t(locale, "price_base")}: <b>{formatMoney(asset.dailyRate!)}</b>
              {" · "}
              {t(locale, "price_weekend")} (+{Math.round(weekendPct)}%):{" "}
              <b>{formatMoney(asset.dailyRate! * (1 + weekendPct / 100))}</b>
              {" · "}
              {t(locale, "price_holiday")} (+{Math.round(holidayPct)}%):{" "}
              <b>{formatMoney(asset.dailyRate! * (1 + holidayPct / 100))}</b>
            </p>
          )}
          <div className="legend">
            {(!isDaily || stays.some((stay) => stay.kind === "lease")) && (
              <span><i style={{ background: "var(--cal-lease)" }} />{t(locale, "calendar_lease")}</span>
            )}
            {asset.unitId && (
              <>
                <span><i style={{ background: "var(--cal-airbnb)" }} />Airbnb</span>
                <span><i style={{ background: "var(--cal-booking)" }} />Booking.com</span>
              </>
            )}
            {(asset.unitId || isDaily) && (
              <span><i style={{ background: "var(--cal-direct)" }} />{t(locale, "calendar_direct_manual")}</span>
            )}
            <span>
              <i style={{ background: "var(--cal-vacant)", border: "1px solid var(--color-border)" }} />
              {t(locale, "calendar_vacant")}
            </span>
            <span className="legend__overlap">
              <i className="cal-swatch--overlap" />
              <IconAlert size={14} />
              {t(locale, "calendar_overlap")}
            </span>
          </div>
          <OccupancyCalendar
            assetId={asset.id}
            months={months}
            defaultRate={
              asset.rentalMode === "daily"
                ? asset.dailyRate
                : asset.contracts[0]
                  ? Math.round(asset.contracts[0].monthlyRent)
                  : null
            }
            isDaily={isDaily}
            labels={calendarLabels}
            weekdays={weekdays}
            todayIso={dayKey(startOfTodayTbilisi())}
          />
        </section>
      )}

      <h2>{t(locale, "asset_edit_title")}</h2>
      <AssetForm
        {...props}
        displayName={displayName}
        asset={{
          id: asset.id,
          name: asset.name,
          nameKa: asset.nameKa ?? "",
          category: asset.category,
          type: asset.type,
          city: cityLabel(locale, asset.city),
          district: districtLabel(locale, asset.district),
          address: asset.address ?? "",
          areaSqm: asset.areaSqm?.toString() ?? "",
          estimatedValue: asset.estimatedValue?.toString() ?? "",
          monthlyIncome: asset.monthlyIncome?.toString() ?? "",
          myhomeUrl: asset.myhomeUrl ?? "",
          ssUrl: asset.ssUrl ?? "",
          myautoUrl: asset.myautoUrl ?? "",
          airbnbUrl: asset.airbnbUrl ?? "",
          bookingUrl: asset.bookingUrl ?? "",
          rentalMode: asset.rentalMode,
          dailyRate: asset.dailyRate?.toString() ?? "",
          weekendPct: asset.weekendPct?.toString() ?? "",
          holidayPct: asset.holidayPct?.toString() ?? "",
          // The form starts from the status as it stands today, so saving
          // it never re-confirms a "rented" left over from an ended lease
          // (nor one night's daily answer).
          status: formStatus,
          unitId: asset.unitId ?? "",
          // Only this workspace's own unit's links are shown (and written).
          icalUrls:
            asset.unit && asset.unit.operatorId === operator.id
              ? parseChannelLinks(asset.unit.channelLinks).icalUrls.join("\n")
              : "",
          plateNumber: asset.plateNumber ?? "",
          notes: asset.notes ?? "",
        }}
      />

    </main>
  );
}
