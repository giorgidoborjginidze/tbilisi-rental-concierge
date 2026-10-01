"use server";

import { randomInt } from "node:crypto";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity/log";
import type { Prisma } from "@/app/generated/prisma/client";
import { asCurrency } from "@/lib/fx/convert";
import { requireWriter } from "@/lib/auth/session";
import { ASSET_CATEGORIES, ASSET_STATUSES } from "@/lib/types";
import { COINS } from "@/lib/crypto/prices";
import { POPULAR_STOCKS } from "@/lib/stocks/prices";
import { METALS } from "@/lib/metals/prices";
import type { FormState } from "@/lib/units/actions";
import type { SessionOperator } from "@/lib/auth/session";
import type { StringKey } from "@/lib/i18n/strings";
import { startOfTodayTbilisi } from "@/lib/time";
import { submittedValues } from "@/lib/forms";
import { activeContract, contractPhase } from "@/lib/rentals/phase";
import { LIVE_CONTRACT, CONTRACT_UNDO_MS } from "@/lib/rentals/live";
import {
  restoreDeletedContract,
  settlePaidRent,
  sweepStaleRentAlerts,
  withdrawAsset,
  withdrawContract,
} from "@/lib/rentals/settle";
import {
  stampedFlag,
  ledgerAfterEdit,
  parseContractInput,
  startingPaidThrough,
  type ContractInput,
} from "@/lib/rentals/contract-input";
import { parseTradeInput, toUsdTrade } from "@/lib/assets/trade-input";
import { usdGelOn } from "@/lib/prices/usd-gel-on";
import { cityKey, districtKey } from "@/lib/places";
import { checkFeedUrl } from "@/lib/ical/fetch";
import { normalizeFeedUrl } from "@/lib/ical/sync";
import { parseChannelLinks } from "@/lib/types";
import { benchmarkMonth } from "@/lib/pricing/nightly";
import {
  createUnitForAsset,
  icalLinksAdded,
  shouldCreateUnit,
  unitFeedsAfterSave,
  unitHoldsNothing,
} from "@/lib/property/link";

const str = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

/** An error that hands back what was typed, so the form shows it again. */
const failWith =
  (formData: FormData) =>
  (error: StringKey, detail?: string): FormState => ({
    error,
    ...(detail ? { detail } : {}),
    values: submittedValues(formData),
  });

// Categories tracked as holdings (quantity + buy price + live value) rather
// than the generic property/income form.
const HOLDING_CATEGORIES = ["crypto", "stock", "metal"] as const;

// What can carry a rental contract from the add form's "tenant & rent" step.
const CONTRACT_CATEGORIES = ["real_estate", "vehicle", "other"];

/**
 * A new holding, with its first purchase when the owner typed one (quantity
 * and price on the same screen — no empty "0 BTC" page to fill in after).
 */
async function createHolding(
  operator: SessionOperator,
  category: "crypto" | "stock" | "metal",
  formData: FormData,
  fail: ReturnType<typeof failWith>,
): Promise<FormState> {
  const symbol = str(formData, "symbol").toUpperCase();
  if (!symbol) return fail("error_required");

  const trade = parseTradeInput((key) => str(formData, key), {
    metal: category === "metal",
    today: startOfTodayTbilisi(),
    optional: true,
  });
  if ("error" in trade) return fail(trade.error);
  // Bought in lari: stored in USD at the NBG rate of that day.
  if (trade.value?.priceCurrency === "GEL") {
    const usd = toUsdTrade(trade.value, (await usdGelOn(trade.value.tradedAt))?.rate ?? null);
    if (!usd) return fail("error_rate_unavailable");
    trade.value = usd;
  }

  const { getBillingContext } = await import("@/lib/billing/context");
  if (!(await getBillingContext(operator)).canAddAsset) {
    return fail("error_limit_assets");
  }

  let name: string;
  let type: string;
  let coingeckoId: string | null = null;

  if (category === "crypto") {
    const known = COINS[symbol];
    coingeckoId = known?.id || str(formData, "coingeckoId").toLowerCase() || null;
    name = known?.name || str(formData, "name") || symbol;
    type = "coin";
  } else if (category === "stock") {
    name = POPULAR_STOCKS[symbol] || str(formData, "name") || symbol;
    type = "share";
  } else {
    name = METALS[symbol]?.name || str(formData, "name") || symbol;
    type = METALS[symbol]?.type || "gold";
  }

  const asset = await prisma.asset.create({
    data: {
      operatorId: operator.id,
      name,
      category,
      type,
      symbol,
      coingeckoId,
      currency: "USD",
      status: "personal_use",
      ...(trade.value
        ? {
            trades: {
              create: {
                side: "buy",
                quantity: trade.value.quantity,
                unitPrice: trade.value.unitPrice,
                tradedAt: trade.value.tradedAt,
              },
            },
          }
        : {}),
    },
  });
  revalidatePath("/assets");
  revalidatePath("/");
  redirect(`/assets/${asset.id}/edit?added=1`);
}

/** The district's average night — the starting base rate of a unit made for an asset. */
/** The district's average night, in the asset's currency. */
async function districtNightRate(district: string | null, currency: string | null | undefined): Promise<number | null> {
  if (!district) return null;
  const { benchmarkAdrIn, getMarketDataSource } = await import("@/lib/market/source");
  return benchmarkAdrIn(getMarketDataSource(), district, benchmarkMonth(startOfTodayTbilisi()), currency);
}

const optionalNumber = (formData: FormData, key: string): number | null => {
  const raw = str(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : NaN;
};

/** iCal links as typed in a textarea: one per line, normalised, deduped. */
const feedLines = (raw: string): string[] => [
  ...new Set(raw.split("\n").map(normalizeFeedUrl).filter(Boolean)),
];

export async function saveAsset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const operator = await requireWriter();
  const fail = failWith(formData);

  const assetId = str(formData, "assetId") || null;
  const name = str(formData, "name");
  const category = str(formData, "category");
  const type = str(formData, "type");
  const status = str(formData, "status");

  if (!(ASSET_CATEGORIES as readonly string[]).includes(category)) {
    return fail("error_required");
  }

  // New crypto/stock/metal go through the holdings path (redirects on success).
  if (
    !assetId &&
    (HOLDING_CATEGORIES as readonly string[]).includes(category)
  ) {
    return createHolding(
      operator,
      category as "crypto" | "stock" | "metal",
      formData,
      fail,
    );
  }

  if (!name) return fail("error_required");
  if (!(ASSET_STATUSES as readonly string[]).includes(status)) {
    return fail("error_required");
  }

  const areaSqm = optionalNumber(formData, "areaSqm");
  const estimatedValue = optionalNumber(formData, "estimatedValue");
  const monthlyIncome = optionalNumber(formData, "monthlyIncome");
  const dailyRate = optionalNumber(formData, "dailyRate");
  const weekendPct = optionalNumber(formData, "weekendPct");
  const holidayPct = optionalNumber(formData, "holidayPct");
  if (
    Number.isNaN(areaSqm) ||
    Number.isNaN(estimatedValue) ||
    Number.isNaN(monthlyIncome) ||
    Number.isNaN(dailyRate) ||
    Number.isNaN(weekendPct) ||
    Number.isNaN(holidayPct)
  ) {
    return fail("error_invalid_number");
  }

  const owned = assetId
    ? await prisma.asset.findFirst({ where: { id: assetId, operatorId: operator.id } })
    : null;
  if (assetId && !owned) return fail("error_required");

  // Only a flat has a calendar unit. A form without the unit picker (a car,
  // an income stream) keeps whatever link is stored.
  const unitField = category === "real_estate" && formData.has("unitId");
  const unitId = unitField ? str(formData, "unitId") || null : owned?.unitId ?? null;
  // Only one of this workspace's own units can be linked — otherwise the
  // asset's calendar would show another account's bookings — and only one
  // no other asset holds.
  if (unitId && unitId !== owned?.unitId) {
    const unit = await prisma.unit.findFirst({
      where: {
        id: unitId,
        operatorId: operator.id,
        OR: [{ asset: null }, ...(assetId ? [{ asset: { id: assetId } }] : [])],
      },
      select: { id: true },
    });
    if (!unit) return fail("error_required");
  }

  // iCal links typed on the asset live on its unit (the calendar side of
  // the same flat). The textarea is prefilled with the links of the unit
  // the asset was linked to when the page was drawn (icalUnitId, icalShown):
  // only that unit's list is replaced by what is typed.
  const icalField = category === "real_estate" && formData.has("icalUrls");
  const icalUrls = icalField ? feedLines(str(formData, "icalUrls")) : [];
  const icalShown = icalField ? feedLines(str(formData, "icalShown")) : [];
  const icalShownFor = str(formData, "icalUnitId") || null;
  for (const url of icalUrls) {
    if ("error" in checkFeedUrl(url)) {
      return fail("error_ical_url", url.length > 80 ? `${url.slice(0, 77)}…` : url);
    }
  }

  // The "tenant & rent" step of a new rented asset: the contract is made in
  // the same save, so the asset never shows "rented" with no rent.
  let contractInput: ContractInput | null = null;
  if (
    !assetId &&
    status === "rented" &&
    CONTRACT_CATEGORIES.includes(category) &&
    str(formData, "tenantStep") === "1" &&
    (str(formData, "amount") || str(formData, "tenantName"))
  ) {
    const parsed = parseContractInput((key) => str(formData, key), (key) => formData.has(key));
    if ("error" in parsed) return fail(parsed.error);
    contractInput = parsed.value;
  }

  const rentalMode = str(formData, "rentalMode") === "daily" ? "daily" : "long_term";
  const data = {
    name,
    nameKa: str(formData, "nameKa") || null,
    category,
    type: type || "other",
    // Stored by key ("ვაკე" → "Vake") so the market rent is found.
    city: cityKey(str(formData, "city")),
    district: districtKey(str(formData, "district")),
    address: str(formData, "address") || null,
    areaSqm,
    estimatedValue,
    monthlyIncome,
    currency: str(formData, "currency") ? asCurrency(str(formData, "currency")) : owned?.currency || "GEL",
    status,
    unitId,
    rentalMode,
    dailyRate,
    weekendPct,
    holidayPct,
    myhomeUrl: str(formData, "myhomeUrl") || null,
    ssUrl: str(formData, "ssUrl") || null,
    myautoUrl: str(formData, "myautoUrl") || null,
    airbnbUrl: str(formData, "airbnbUrl") || null,
    bookingUrl: str(formData, "bookingUrl") || null,
    notes: str(formData, "notes") || null,
    // A car's state plate (quoted in the red-line messages); the GPS
    // settings on its desk write the same field.
    ...(category === "vehicle" && formData.has("plateNumber")
      ? { plateNumber: str(formData, "plateNumber").toUpperCase() || null }
      : {}),
  };

  // A flat joins the calendar (gets its unit) only at a change that puts
  // it there: created let by the day or with links, moved into daily mode,
  // or given new iCal links — never again after the owner unlinked it.
  let makeUnit = shouldCreateUnit({
    category,
    rentalMode,
    pickedUnitId: unitId,
    previous: owned ? { rentalMode: owned.rentalMode, unitId: owned.unitId } : null,
    addedIcal: icalLinksAdded(icalUrls, icalShown).length,
  });
  const { getBillingContext } = await import("@/lib/billing/context");
  const billing = await getBillingContext(operator);
  if (makeUnit && !billing.canAddUnit) {
    // Over the unit limit: calendar links cannot be kept without a unit;
    // a plain day-let flat still shows in the calendar as it is.
    if (icalUrls.length > 0) return fail("error_limit_units");
    makeUnit = false;
  }

  let savedId: string;
  if (owned) {
    await prisma.asset.update({
      where: { id: owned.id },
      // A status the owner changes by hand is stamped, so it outranks a
      // stale "rented" left behind by a finished contract.
      data: { ...data, ...(owned.status !== status ? { statusSetAt: new Date() } : {}) },
    });
    savedId = owned.id;
    // Daily contracts are priced day by day with the asset's weekend and
    // holiday premiums. New premiums must not re-price money already
    // received: each tracked daily contract opens a new ledger balance at
    // its current position, so a later delete replays only payments made
    // under the new prices (as a change of terms does in saveSchedule).
    const premiumsChanged =
      (owned.weekendPct ?? 0) !== (weekendPct ?? 0) ||
      (owned.holidayPct ?? 0) !== (holidayPct ?? 0);
    if (premiumsChanged) {
      const daily = await prisma.rentalContract.findMany({
        where: { assetId: owned.id, paymentPeriod: "daily", paidThrough: { not: null }, ...LIVE_CONTRACT },
        select: { id: true, paidThrough: true, creditBalance: true },
      });
      const openedAt = new Date();
      for (const contract of daily) {
        await prisma.rentalContract.update({
          where: { id: contract.id },
          data: {
            openingPaidThrough: contract.paidThrough,
            openingCredit: contract.creditBalance,
            openingAt: openedAt,
          },
        });
        // Reminders still waiting quote the old day prices.
        await settlePaidRent(prisma, contract.id, contract.paidThrough, openedAt, {
          cause: "changed",
          withdrawOwed: true,
        });
      }
    }
  } else {
    // A linked pair counts once, as a unit; anything else is an asset.
    if (!makeUnit && !unitId && !billing.canAddAsset) {
      return fail("error_limit_assets");
    }
    const created = await prisma.asset.create({
      data: { ...data, operatorId: operator.id, statusSetAt: new Date() },
      select: { id: true },
    });
    savedId = created.id;
  }

  if (makeUnit) {
    await createUnitForAsset(
      prisma,
      operator.id,
      { ...(owned ?? {}), ...data, id: savedId },
      icalUrls,
      await districtNightRate(data.district, data.currency ?? owned?.currency),
    );
  } else if (unitId && icalField) {
    const unit = await prisma.unit.findFirst({
      where: { id: unitId, operatorId: operator.id },
      select: { channelLinks: true },
    });
    const feeds = unit
      ? unitFeedsAfterSave({
          unitId,
          shownFor: icalShownFor,
          shown: icalShown,
          typed: icalUrls,
          current: parseChannelLinks(unit.channelLinks).icalUrls,
        })
      : null;
    if (feeds) await setUnitFeeds(unitId, feeds);
  }

  if (contractInput) {
    await createContract({ id: savedId, currency: data.currency, status }, contractInput);
  }
  await logActivity(operator, owned ? "asset.update" : "asset.create", { id: savedId, label: data.name });
  if (contractInput) {
    await logActivity(operator, "contract.create", { id: savedId, label: `${data.name} — ${contractInput.tenantName ?? ""}` });
  }

  revalidatePath("/assets");
  revalidatePath(`/assets/${savedId}/edit`);
  revalidatePath("/units");
  revalidatePath("/calendar");
  revalidatePath("/");
  if (!owned) {
    // A new car goes straight to its rent (its service desk's payments),
    // where the next step — the contract, then the tracker — is at hand;
    // anything else to its own page, saying it was added.
    redirect(
      category === "vehicle"
        ? `/assets/${savedId}/rental?tab=payments&added=1`
        : `/assets/${savedId}/edit?added=1`,
    );
  }
  redirect("/assets");
}

/** The iCal links of a linked unit, as typed on its asset. */
async function setUnitFeeds(unitId: string, icalUrls: string[]) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { channelLinks: true },
  });
  if (!unit) return;
  const links = parseChannelLinks(unit.channelLinks);
  await prisma.unit.update({
    where: { id: unitId },
    data: { channelLinks: { ...links, icalUrls } },
  });
  // Status rows of removed links go now, not at the next sync.
  await prisma.unitFeed.deleteMany({ where: { unitId, url: { notIn: icalUrls } } });
}

// ── Rental contracts ────────────────────────────────────────────────────

/** Write a new contract on an asset (the asset belongs to the caller). */
async function createContract(
  asset: { id: string; currency: string; status: string },
  input: ContractInput,
): Promise<string> {
  const today = startOfTodayTbilisi();
  const paidThrough = startingPaidThrough(input, today);
  // Stored for compatibility only — every reader derives it from dates.
  const phase = contractPhase(input, today);
  const created = await prisma.rentalContract.create({
    data: {
      assetId: asset.id,
      tenantName: input.tenantName,
      tenantPhone: input.tenantPhone,
      startDate: input.startDate,
      endDate: input.endDate,
      paymentAmount: input.amount,
      monthlyRent: input.monthlyRent,
      deposit: input.deposit,
      currency: input.currency ?? asset.currency,
      status: phase,
      paymentPeriod: input.paymentPeriod,
      graceDays: input.graceDays,
      paidThrough,
      creditBalance: 0,
      // The quick forms have no checkbox: reminders stay on.
      remindersEnabled: input.remindersEnabled ?? true,
      waConsentAt: stampedFlag(input.waConsent, null, new Date()),
      messagesOptOutAt: stampedFlag(input.messagesOptOut, null, new Date()),
      // The ledger's opening balance: payments recorded from now on are
      // replayed on top of it if one of them is ever deleted.
      openingPaidThrough: paidThrough,
      openingCredit: 0,
      openingAt: new Date(),
      notes: input.notes,
    },
    select: { id: true },
  });
  // A running contract means the asset is rented.
  if (phase === "active" && asset.status !== "rented") {
    await prisma.asset.update({ where: { id: asset.id }, data: { status: "rented" } });
  }
  return created.id;
}

const refreshContract = (assetId: string) => {
  revalidatePath("/");
  revalidatePath("/assets");
  revalidatePath("/alerts");
  revalidatePath("/fleet");
  revalidatePath("/calendar");
  revalidatePath(`/assets/${assetId}/edit`);
  revalidatePath(`/assets/${assetId}/rental`);
};

/**
 * Add a rental contract. The owner types the rent PER PAYMENT PERIOD
 * (60 a day, 350 a week, 1,200 a month); that is what the schedule
 * charges, and monthlyRent keeps its monthly equivalent for every monthly
 * figure. "Paid up to" says how far the rent is already paid, so a lease
 * that has been running since March is not announced as seven months late
 * the moment it is typed in.
 */
export async function saveContract(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const fail = failWith(formData);
  const assetId = str(formData, "assetId");
  if (!assetId) return fail("error_required");
  const parsed = parseContractInput((key) => str(formData, key), (key) => formData.has(key));
  if ("error" in parsed) return fail(parsed.error);

  const operator = await requireWriter();
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, operatorId: operator.id },
    select: { id: true, currency: true, status: true },
  });
  if (!asset) return fail("error_required");

  const id = await createContract(asset, parsed.value);
  await logActivity(operator, "contract.create", { id, label: parsed.value.tenantName });
  refreshContract(assetId);
  return { ok: true, id };
}

/**
 * Edit a contract in place — a new phone number, a lease extended, the
 * rent raised — instead of deleting it (and its payment history) and
 * typing it again. What the change does to the rent ledger is
 * ledgerAfterEdit's rule; reminders still waiting were written under the
 * old terms and are withdrawn, and the next check writes fresh ones.
 */
export async function updateContract(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const fail = failWith(formData);
  const contractId = str(formData, "contractId");
  const assetId = str(formData, "assetId");
  if (!contractId || !assetId) return fail("error_required");
  const parsed = parseContractInput((key) => str(formData, key), (key) => formData.has(key));
  if ("error" in parsed) return fail(parsed.error);
  const input = parsed.value;

  const operator = await requireWriter();
  const contract = await prisma.rentalContract.findFirst({
    where: { id: contractId, assetId, asset: { operatorId: operator.id }, ...LIVE_CONTRACT },
    include: { asset: { select: { id: true, status: true } } },
  });
  if (!contract) return fail("error_required");

  const now = new Date();
  const today = startOfTodayTbilisi(now);
  const ledger = ledgerAfterEdit(
    contract,
    input,
    formData.has("paidThroughWas") ? str(formData, "paidThroughWas") : null,
    now,
  );
  const remindersEnabled = input.remindersEnabled ?? contract.remindersEnabled;
  const phase = contractPhase(input, today);

  await prisma.rentalContract.updateMany({
    where: { id: contractId, ...LIVE_CONTRACT },
    data: {
      tenantName: input.tenantName,
      tenantPhone: input.tenantPhone,
      startDate: input.startDate,
      endDate: input.endDate,
      paymentPeriod: input.paymentPeriod,
      paymentAmount: input.amount,
      monthlyRent: input.monthlyRent,
      graceDays: input.graceDays,
      deposit: input.deposit,
      notes: input.notes,
      remindersEnabled,
      waConsentAt: stampedFlag(input.waConsent, contract.waConsentAt, now),
      messagesOptOutAt: stampedFlag(input.messagesOptOut, contract.messagesOptOutAt, now),
      // The currency changes only while no payment is recorded in the old one.
      ...(input.currency && (await prisma.rentPayment.count({ where: { contractId } })) === 0
        ? { currency: input.currency }
        : {}),
      status: phase,
      ...(ledger ?? {}),
    },
  });
  // The renter objected just now: nothing more goes to them, starting with
  // what is already waiting in the outbox.
  if (input.messagesOptOut && !contract.messagesOptOutAt) {
    await prisma.notifyMessage.updateMany({
      where: { contractId, toRole: { not: "owner" }, status: { in: ["queued", "failed"] } },
      data: { status: "cancelled", cancelReason: "opt_out", cancelledAt: now },
    });
  }

  const changed =
    ledger != null ||
    input.graceDays !== contract.graceDays ||
    remindersEnabled !== contract.remindersEnabled ||
    input.tenantPhone !== contract.tenantPhone ||
    input.tenantName !== contract.tenantName ||
    input.startDate.getTime() !== contract.startDate.getTime() ||
    input.endDate.getTime() !== contract.endDate.getTime();
  if (changed) {
    await settlePaidRent(prisma, contractId, ledger ? ledger.paidThrough : contract.paidThrough, now, {
      cause: "changed",
      withdrawOwed: true,
    });
    await sweepStaleRentAlerts(prisma, today, { contractId }, now);
  }
  // A contract moved onto today makes the asset rented.
  if (phase === "active" && contract.asset.status !== "rented") {
    await prisma.asset.update({ where: { id: assetId }, data: { status: "rented" } });
  }

  await logActivity(operator, "contract.update", { id: contractId, label: input.tenantName ?? contract.tenantName });
  refreshContract(assetId);
  return { ok: true, id: contractId };
}

/**
 * Delete a contract — softly. It disappears from every screen, total,
 * alert and reminder at once (LIVE_CONTRACT), but the row and its payment
 * history stay for 30 days, so the owner can bring it back (restoreContract)
 * from the notice the page shows next, or from its "deleted" list.
 */
export async function deleteContract(formData: FormData) {
  const operator = await requireWriter();
  const contractId = str(formData, "contractId");
  const assetId = str(formData, "assetId");
  if (!contractId || !assetId) return;
  const contract = await prisma.rentalContract.findFirst({
    where: { id: contractId, assetId, asset: { operatorId: operator.id }, ...LIVE_CONTRACT },
    include: {
      asset: {
        select: {
          status: true,
          contracts: { where: { ...LIVE_CONTRACT, id: { not: contractId } } },
        },
      },
    },
  });
  if (contract) {
    const now = new Date();
    await prisma.rentalContract.update({ where: { id: contractId }, data: { deletedAt: now } });
    await logActivity(operator, "contract.delete", { id: contractId, label: contract.tenantName });
    // Nothing more may go out about it, and its alerts (late rent,
    // repossession right, expiry) are closed — stamped with `now`, so an
    // undo brings back exactly these.
    await withdrawContract(prisma, contractId, "contract_deleted", now);
    // The asset was "rented" by this running contract alone: not any more.
    const today = startOfTodayTbilisi(now);
    if (
      contract.asset.status === "rented" &&
      contractPhase(contract, today) === "active" &&
      !activeContract(contract.asset.contracts, today)
    ) {
      await prisma.asset.update({ where: { id: assetId }, data: { status: "vacant" } });
    }
    refreshContract(assetId);
  }
  redirect(`/assets/${assetId}/edit?deleted=${encodeURIComponent(contractId)}#contracts`);
}

/** Undo a contract deletion (within 30 days). */
export async function restoreContract(formData: FormData) {
  const operator = await requireWriter();
  const contractId = str(formData, "contractId");
  const assetId = str(formData, "assetId");
  if (!contractId || !assetId) return;
  const contract = await prisma.rentalContract.findFirst({
    where: { id: contractId, assetId, asset: { operatorId: operator.id }, deletedAt: { not: null } },
    include: { asset: { select: { status: true } } },
  });
  const now = new Date();
  if (contract?.deletedAt && now.getTime() - contract.deletedAt.getTime() <= CONTRACT_UNDO_MS) {
    await prisma.rentalContract.update({ where: { id: contractId }, data: { deletedAt: null } });
    await restoreDeletedContract(prisma, contractId, contract.deletedAt);
    await logActivity(operator, "contract.restore", { id: contractId, label: contract.tenantName });
    if (contractPhase(contract, startOfTodayTbilisi(now)) === "active" && contract.asset.status !== "rented") {
      await prisma.asset.update({ where: { id: assetId }, data: { status: "rented" } });
    }
    refreshContract(assetId);
  }
  redirect(`/assets/${assetId}/edit?restored=${encodeURIComponent(contractId)}#contracts`);
}

/**
 * Put a real-estate asset that has no unit yet on the Rentals calendar:
 * create its unit and link it (the button on /units and on the asset
 * page, for flats added before units and assets were linked).
 */
export async function addAssetToRentals(formData: FormData) {
  const operator = await requireWriter();
  const assetId = str(formData, "assetId");
  const asset = assetId
    ? await prisma.asset.findFirst({
        where: { id: assetId, operatorId: operator.id, category: "real_estate", unitId: null },
      })
    : null;
  if (!asset) return;
  const { getBillingContext } = await import("@/lib/billing/context");
  if (!(await getBillingContext(operator)).canAddUnit) {
    redirect("/billing?limit=units");
  }
  await createUnitForAsset(prisma, operator.id, asset, [], await districtNightRate(asset.district, asset.currency));
  revalidatePath("/units");
  revalidatePath("/calendar");
  revalidatePath("/assets");
  revalidatePath(`/assets/${asset.id}/edit`);
  revalidatePath("/");
}

// Generate a fresh 6-digit door code for an asset (daily rentals /
// tenant handovers); sent to the tenant via a WhatsApp deep link.
export async function generateDoorCode(formData: FormData) {
  const operator = await requireWriter();
  const assetId = str(formData, "assetId");
  if (assetId) {
    await prisma.asset.updateMany({
      where: { id: assetId, operatorId: operator.id },
      data: {
        doorCode: String(randomInt(0, 1_000_000)).padStart(6, "0"),
        doorCodeGeneratedAt: new Date(),
      },
    });
    revalidatePath("/assets");
  }
}

// Quick status flip used by the per-asset listing buttons (rented/vacant).
export async function setAssetStatus(formData: FormData) {
  const operator = await requireWriter();
  const assetId = str(formData, "assetId");
  const status = str(formData, "status");
  if (assetId && (status === "rented" || status === "vacant")) {
    await prisma.asset.updateMany({
      where: { id: assetId, operatorId: operator.id },
      data: { status, statusSetAt: new Date() },
    });
    revalidatePath("/assets");
    revalidatePath("/");
  }
}

export async function deleteAsset(formData: FormData) {
  const operator = await requireWriter();
  const assetId = str(formData, "assetId");
  if (assetId) {
    const owned = await prisma.asset.findFirst({
      where: { id: assetId, operatorId: operator.id },
      select: { id: true, unitId: true, name: true },
    });
    if (owned) await logActivity(operator, "asset.delete", { id: owned.id, label: owned.name });
    // Nothing more goes out about it, and its open alerts close.
    if (owned) await withdrawAsset(prisma, operator.id, owned.id);
    // The calendar unit made for it goes too while it holds nothing of its
    // own (no stays, leases or channel links); one with history stays.
    const dropUnit = owned?.unitId ? await unitHoldsNothing(prisma, owned.unitId) : false;
    await prisma.asset.deleteMany({
      where: { id: assetId, operatorId: operator.id },
    });
    if (dropUnit && owned?.unitId) {
      await prisma.unit.deleteMany({ where: { id: owned.unitId, operatorId: operator.id } });
      revalidatePath("/units");
      revalidatePath("/calendar");
    }
    revalidatePath("/assets");
  }
  redirect("/assets");
}

/**
 * Deleting a holding (crypto, stock, metal) with an undo: the asset and
 * its trades are deleted, and what it took to put them back comes back to
 * the page as the undo fields (ConfirmAction → the app's undo toast). A
 * holding has nothing else of its own — no contracts, tracker or calendar —
 * so the snapshot is the whole of it, plus which income rows pointed at it.
 */
const HOLDING_LIST: string[] = [...HOLDING_CATEGORIES];

export async function deleteHolding(formData: FormData) {
  const operator = await requireWriter();
  const assetId = str(formData, "assetId");
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, operatorId: operator.id, category: { in: HOLDING_LIST } },
    include: { trades: true, incomes: { select: { id: true } } },
  });
  if (!asset) return null;
  const { trades, incomes, ...row } = asset;
  await prisma.asset.deleteMany({ where: { id: asset.id, operatorId: operator.id } });
  await logActivity(operator, "asset.delete", { id: asset.id, label: asset.name });
  revalidatePath("/assets");
  revalidatePath("/invest");
  revalidatePath("/");
  return {
    undo: { snapshot: JSON.stringify({ asset: row, trades, incomeIds: incomes.map((income) => income.id) }) },
  };
}

/** The undo of deleteHolding: the same asset, id and trades, back in this workspace. */
export async function restoreHolding(formData: FormData) {
  const operator = await requireWriter();
  let parsed: {
    asset: Record<string, unknown> & { id: string; category: string };
    trades: { id: string; side: string; quantity: number; unitPrice: number; tradedAt: string; createdAt: string }[];
    incomeIds: string[];
  };
  try {
    parsed = JSON.parse(str(formData, "snapshot"));
  } catch {
    return null;
  }
  const { asset, trades, incomeIds } = parsed;
  // Only a holding comes back this way, only into the signed-in workspace,
  // and only if its id is free again (a second click changes nothing).
  if (!asset?.id || !HOLDING_LIST.includes(asset.category)) return null;
  if (await prisma.asset.findUnique({ where: { id: asset.id }, select: { id: true } })) return null;
  const sides = ["buy", "sell"];
  await prisma.$transaction(async (tx) => {
    await tx.asset.create({
      data: {
        ...(asset as unknown as Prisma.AssetUncheckedCreateInput),
        operatorId: operator.id,
        unitId: null,
      },
    });
    if (trades.length > 0) {
      await tx.cryptoTrade.createMany({
        data: trades
          .filter((trade) => sides.includes(trade.side))
          .map((trade) => ({
            id: trade.id,
            assetId: asset.id,
            side: trade.side,
            quantity: Number(trade.quantity),
            unitPrice: Number(trade.unitPrice),
            tradedAt: new Date(trade.tradedAt),
            createdAt: new Date(trade.createdAt),
          })),
      });
    }
    if (incomeIds.length > 0) {
      await tx.incomeRecord.updateMany({
        where: { id: { in: incomeIds }, operatorId: operator.id, assetId: null },
        data: { assetId: asset.id },
      });
    }
  });
  revalidatePath("/assets");
  revalidatePath("/invest");
  revalidatePath("/");
  return { ok: true };
}

export async function addIncome(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const operator = await requireWriter();
  const fail = failWith(formData);

  const dateRaw = str(formData, "date");
  const amount = Number(str(formData, "amount"));
  if (!dateRaw) return fail("error_required");
  if (!Number.isFinite(amount) || amount <= 0) {
    return fail("error_invalid_number");
  }

  const date = new Date(`${dateRaw}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return fail("error_required");
  // The income can only be tied to one of this workspace's own assets.
  const assetId = str(formData, "incomeAssetId") || null;
  if (assetId) {
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, operatorId: operator.id },
      select: { id: true },
    });
    if (!asset) return fail("error_required");
  }

  await prisma.incomeRecord.create({
    data: {
      operatorId: operator.id,
      source: str(formData, "source") || "other",
      description: str(formData, "description") || null,
      date,
      amount,
      currency: asCurrency(str(formData, "currency")),
      assetId,
    },
  });

  revalidatePath("/assets");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteIncome(formData: FormData): Promise<{ undo: Record<string, string> } | null> {
  const operator = await requireWriter();
  const incomeId = str(formData, "incomeId");
  if (!incomeId) return null;
  const row = await prisma.incomeRecord.findFirst({ where: { id: incomeId, operatorId: operator.id } });
  if (!row) return null;
  await prisma.incomeRecord.delete({ where: { id: row.id } });
  revalidatePath("/assets");
  revalidatePath("/");
  // What the undo puts back.
  return {
    undo: {
      assetId: row.assetId ?? "",
      source: row.source,
      description: row.description ?? "",
      date: row.date.toISOString(),
      amount: String(row.amount),
      currency: row.currency,
      createdAt: row.createdAt.toISOString(),
    },
  };
}

/** Undo of a deleted income entry: the same entry again. */
export async function restoreIncome(formData: FormData): Promise<void> {
  const operator = await requireWriter();
  const amount = Number(str(formData, "amount"));
  const date = new Date(str(formData, "date"));
  const createdAt = new Date(str(formData, "createdAt"));
  if (!(amount > 0) || Number.isNaN(date.getTime())) return;
  const assetId = str(formData, "assetId");
  const asset = assetId
    ? await prisma.asset.findFirst({ where: { id: assetId, operatorId: operator.id }, select: { id: true } })
    : null;
  await prisma.incomeRecord.create({
    data: {
      operatorId: operator.id,
      assetId: asset?.id ?? null,
      source: str(formData, "source") || "other",
      description: str(formData, "description") || null,
      date,
      amount,
      currency: asCurrency(str(formData, "currency")),
      ...(Number.isNaN(createdAt.getTime()) || createdAt > new Date() ? {} : { createdAt }),
    },
  });
  revalidatePath("/assets");
  revalidatePath("/");
}
