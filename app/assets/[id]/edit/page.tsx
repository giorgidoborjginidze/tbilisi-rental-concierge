import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { deleteContract } from "@/lib/assets/actions";
import { dayPrice } from "@/lib/assets/daily-price";
import OccupancyCalendar from "./occupancy-calendar";
import { LISTING_PLATFORMS } from "@/lib/types";
import AssetForm from "../../asset-form";
import ContractForm from "../../contract-form";
import ListingControls, { type ListingLink } from "../../listing-controls";
import DoorKey from "../../door-key";
import { assetFormProps } from "../../form-helpers";

export const dynamic = "force-dynamic";

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
};

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const operator = await requireOperator();

  const { id } = await params;
  const asset = await prisma.asset.findFirst({
    where: { id, operatorId: operator.id },
    include: {
      contracts: { orderBy: { endDate: "desc" } },
      unit: { select: { id: true, name: true } },
    },
  });
  if (!asset) notFound();

  const locale = await getLocale();
  const props = await assetFormProps(locale, operator.id, asset.id);
  const isIncome = asset.category === "income_source";

  const now = new Date();
  const activeContract = asset.contracts.find(
    (c) => c.status !== "ended" && c.startDate <= now && c.endDate >= now,
  );
  const status = activeContract ? "rented" : asset.unitId ? "str" : asset.status;

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
  // Days are colored by rental contracts (lease) and, when the asset is
  // linked to an STR unit, by that unit's bookings per source.
  const calStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  const calEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 4, 1));
  const showCalendar = !isIncome;
  const bookings = showCalendar && asset.unitId
    ? await prisma.booking.findMany({
        where: {
          unitId: asset.unitId,
          status: { not: "cancelled" },
          checkIn: { lt: calEnd },
          checkOut: { gt: calStart },
        },
        select: { source: true, checkIn: true, checkOut: true, amount: true, nights: true },
      })
    : [];
  const stays = [
    ...asset.contracts
      .filter((c) => c.status !== "ended")
      .map((c) => ({
        kind: "lease",
        start: c.startDate,
        end: c.endDate,
        // For daily-mode assets the contract amount IS the day price.
        dayAmount: asset.rentalMode === "daily" ? c.monthlyRent : null,
      })),
    ...bookings.map((b) => ({
      kind: b.source,
      start: b.checkIn,
      end: b.checkOut,
      dayAmount:
        b.amount != null && b.nights > 0 ? Math.round(b.amount / b.nights) : null,
    })),
  ];

  // Daily pricing: base rate + weekend/holiday premiums → per-day price
  // tooltips (rented days show the actual booked/contracted price).
  const hasDailyPricing =
    asset.rentalMode === "daily" && asset.dailyRate != null && asset.dailyRate > 0;
  const weekendPct = asset.weekendPct ?? 0;
  const holidayPct = asset.holidayPct ?? 0;

  const intl = locale === "ka" ? "ka-GE" : "en-GB";
  const fmtMonth = new Intl.DateTimeFormat(intl, { month: "short", year: "2-digit" });
  const fmtDate = new Intl.DateTimeFormat(intl, {
    day: "numeric", month: "short", year: "numeric",
  });

  const fmtDay = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short" });
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
        const covering = stays.filter((s) => s.start < dayEnd && s.end > dayStart);
        const cls =
          covering.length > 1
            ? "cal-cell--overlap"
            : covering.length === 1
              ? KIND_CLASS[covering[0].kind] ?? KIND_CLASS.direct
              : "";
        const rented = covering.length > 0;
        const priceText = rented
          ? covering[0].dayAmount != null
            ? ` · ${covering[0].dayAmount} GEL`
            : ""
          : hasDailyPricing
            ? ` · ${dayPrice(dayStart, asset.dailyRate!, weekendPct, holidayPct)} GEL`
            : "";
        const statusText = rented
          ? t(locale, "status_rented")
          : t(locale, "calendar_vacant");
        return {
          iso: dayStart.toISOString().slice(0, 10),
          cls,
          title: `${fmtDay.format(dayStart)} — ${statusText}${priceText}`,
        };
      });
      months.push({
        label: fmtMonth.format(mStart),
        current: fmtMonth.format(mStart) === fmtMonth.format(now),
        days,
      });
    }
  }

  const calendarLabelKeys: StringKey[] = [
    "drag_hint", "mark_range_title", "mark_save", "nights_short",
    "contract_start", "contract_end", "contract_rent", "daily_rate",
    "contract_tenant", "cancel", "error_required", "error_invalid_number",
    "error_dates",
  ];
  const calendarLabels = Object.fromEntries(
    calendarLabelKeys.map((key) => [key, t(locale, key)]),
  );

  const contractLabelKeys: StringKey[] = [
    "contract_add", "contract_tenant", "tenant_phone", "contract_start", "contract_end",
    "contract_rent", "contract_deposit", "asset_notes", "error_required",
    "error_invalid_number", "error_dates", "error_email_taken",
  ];
  const contractLabels = Object.fromEntries(
    contractLabelKeys.map((key) => [key, t(locale, key)]),
  );

  return (
    <main>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 style={{ marginBottom: 0 }}>{displayName}</h1>
        <Link href="/assets" className="btn-chip">← {t(locale, "assets_title")}</Link>
      </div>

      {/* ── Summary: status, listings, door key — same controls as the list ── */}
      <div className="alert-card" style={{ display: "block" }}>
        <div className="flex flex-wrap items-center gap-1.5">
          {isIncome ? (
            <>
              <span className="badge badge--rented">{t(locale, "income_recurring")}</span>
              <span style={{ fontWeight: 600 }}>
                {Math.round(asset.monthlyIncome ?? 0).toLocaleString("en-US")} GEL /{" "}
                {t(locale, "per_month_word")}
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
              {asset.unit && (
                <Link href={`/calendar?unit=${asset.unit.id}`} className="link" style={{ fontSize: 13 }}>
                  ({asset.unit.name})
                </Link>
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

      {/* ── Occupancy calendar: when this asset was rented and when not ── */}
      {showCalendar && (
        <section>
          <h2>{t(locale, "nav_calendar")}</h2>
          {hasDailyPricing && (
            <p style={{ color: "var(--color-text-muted)", fontSize: 13, margin: "0 0 10px" }}>
              {t(locale, "price_base")}: <b>{Math.round(asset.dailyRate!)} GEL</b>
              {" · "}
              {t(locale, "price_weekend")} (+{Math.round(weekendPct)}%):{" "}
              <b>{Math.round(asset.dailyRate! * (1 + weekendPct / 100))} GEL</b>
              {" · "}
              {t(locale, "price_holiday")} (+{Math.round(holidayPct)}%):{" "}
              <b>{Math.round(asset.dailyRate! * (1 + holidayPct / 100))} GEL</b>
            </p>
          )}
          <div className="legend">
            <span><i style={{ background: "var(--cal-lease)" }} />{t(locale, "calendar_lease")}</span>
            {asset.unitId && (
              <>
                <span><i style={{ background: "var(--cal-airbnb)" }} />Airbnb</span>
                <span><i style={{ background: "var(--cal-booking)" }} />Booking.com</span>
                <span><i style={{ background: "var(--cal-direct)" }} />{t(locale, "calendar_direct_manual")}</span>
              </>
            )}
            <span>
              <i style={{ background: "var(--cal-vacant)", border: "1px solid var(--color-border)" }} />
              {t(locale, "calendar_vacant")}
            </span>
          </div>
          <OccupancyCalendar
            assetId={asset.id}
            months={months}
            defaultRate={
              asset.rentalMode === "daily"
                ? asset.dailyRate
                : asset.contracts[0]?.monthlyRent ?? null
            }
            isDaily={asset.rentalMode === "daily"}
            labels={calendarLabels}
          />
        </section>
      )}

      <h2>{t(locale, "asset_edit_title")}</h2>
      <AssetForm
        {...props}
        asset={{
          id: asset.id,
          name: asset.name,
          nameKa: asset.nameKa ?? "",
          category: asset.category,
          type: asset.type,
          city: asset.city ?? "",
          district: asset.district ?? "",
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
          status: asset.status,
          unitId: asset.unitId ?? "",
          notes: asset.notes ?? "",
        }}
      />

      {!isIncome && (
        <section>
          <h2>{t(locale, "contracts_title")}</h2>
          {asset.contracts.length > 0 && (
            <ul className="mb-4 space-y-2">
              {asset.contracts.map((contract) => (
                <li
                  key={contract.id}
                  className="alert-card"
                  style={{ padding: "12px 18px", alignItems: "center" }}
                >
                  <div>
                    <span className="font-medium">
                      {contract.monthlyRent} {contract.currency}
                    </span>{" "}
                    · {contract.tenantName ?? "—"}
                    {contract.tenantPhone ? ` (${contract.tenantPhone})` : ""} · {fmtDate.format(contract.startDate)}{" "}
                    – {fmtDate.format(contract.endDate)}{" "}
                    <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                      ({t(locale, `cstatus_${contract.status}` as StringKey)})
                    </span>
                  </div>
                  <form action={deleteContract}>
                    <input type="hidden" name="contractId" value={contract.id} />
                    <input type="hidden" name="assetId" value={asset.id} />
                    <button type="submit" className="btn-chip" aria-label="delete contract">
                      ✕
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <ContractForm assetId={asset.id} labels={contractLabels} />
        </section>
      )}
    </main>
  );
}
