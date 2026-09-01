import { prisma } from "@/lib/db";
import type { Locale } from "@/lib/i18n/strings";
import { queueMessage } from "@/lib/notify/whatsapp";
import { dayPrice } from "@/lib/assets/daily-price";
import { evaluateSchedule, type PaymentPeriod, type ScheduleStatus } from "./schedule";

// Watches the payment schedule of every active contract and turns it into
// alerts and WhatsApp reminders:
//
//   due day        → a polite reminder to the renter
//   1…grace days   → one nudge per late day, still inside the tolerance
//   past grace     → the renter is told the window has run out, and the
//                    owner is told the repossession right is now live
//
// Everything is deduped on the due date, so re-running the scan is safe.

export interface RentalMonitorResult {
  contracts: number;
  alerts: number;
  messages: number;
}

const iso = (date: Date) => date.toISOString().slice(0, 10);

/** Per-period amount, falling back to the contract's headline rent. */
export function periodAmount(contract: {
  paymentAmount: number | null;
  monthlyRent: number;
}): number {
  return contract.paymentAmount && contract.paymentAmount > 0
    ? contract.paymentAmount
    : contract.monthlyRent;
}

/** The asset's daily-pricing rules, when it has any. */
export interface DailyPricing {
  dailyRate: number | null;
  weekendPct: number | null;
  holidayPct: number | null;
}

/**
 * Prices one day of a daily contract. Weekend and holiday premiums come
 * from the asset, so a public holiday is charged at the holiday rate
 * rather than the base one — which is the whole point of setting them.
 */
export function dailyRateFor(
  base: number,
  pricing?: DailyPricing | null,
): ((day: Date) => number) | undefined {
  if (!pricing) return undefined;
  const weekend = pricing.weekendPct ?? 0;
  const holiday = pricing.holidayPct ?? 0;
  if (weekend === 0 && holiday === 0) return undefined;
  return (day) => dayPrice(day, base, weekend, holiday);
}

export function statusFor(
  contract: {
    startDate: Date;
    endDate: Date;
    paymentPeriod: string;
    paymentAmount: number | null;
    monthlyRent: number;
    graceDays: number;
    paidThrough: Date | null;
  },
  today = new Date(),
  /** Daily-mode assets price each day individually. */
  pricing?: DailyPricing | null,
): ScheduleStatus {
  const period = (contract.paymentPeriod as PaymentPeriod) ?? "monthly";
  const amount = periodAmount(contract);
  return evaluateSchedule({
    startDate: contract.startDate,
    endDate: contract.endDate,
    period,
    amount,
    rateFor: period === "daily" ? dailyRateFor(amount, pricing) : undefined,
    graceDays: contract.graceDays,
    paidThrough: contract.paidThrough,
    today,
  });
}

export async function monitorRentPayments(
  today = new Date(),
  operatorId?: string,
): Promise<RentalMonitorResult> {
  const contracts = await prisma.rentalContract.findMany({
    where: {
      status: "active",
      ...(operatorId ? { asset: { operatorId } } : {}),
    },
    include: {
      asset: {
        include: {
          operator: { select: { id: true, locale: true, notifyPhone: true } },
        },
      },
    },
  });

  const result: RentalMonitorResult = { contracts: 0, alerts: 0, messages: 0 };

  // Dedupe alerts the same way the main scan does: on type + payload key.
  const existing = await prisma.alert.findMany({
    where: {
      type: { in: ["rent_overdue", "repossession_right"] },
      ...(operatorId ? { operatorId } : {}),
    },
    select: { type: true, payload: true },
  });
  const seen = new Set(
    existing.map((alert) => {
      const payload = alert.payload as { key?: string };
      return `${alert.type}|${payload.key ?? ""}`;
    }),
  );

  for (const contract of contracts) {
    // A contract with no paid-through date has never had its schedule
    // tracked — an old lease entered before this existed, say. Announcing
    // that it is a year overdue would be false: nobody recorded the money
    // that was in fact paid. Tracking starts when the owner sets the date.
    if (!contract.paidThrough) continue;

    const status = statusFor(contract, today, contract.asset);
    if (status.state === "not_started" || status.state === "ended" || status.state === "ok") {
      continue;
    }
    result.contracts += 1;

    const operator = contract.asset.operator;
    const locale = (operator.locale === "ka" ? "ka" : "en") as Locale;
    const dueKey = iso(status.nextDueDate);
    const amount = Math.round(status.amountDue).toLocaleString("en-US");
    const vars = {
      asset: contract.asset.name,
      plate: contract.asset.plateNumber ?? "—",
      driver: contract.tenantName ?? "—",
      amount,
      currency: contract.currency,
      date: dueKey,
      days: String(status.daysOverdue),
      grace: String(status.graceDays),
    };

    const push = async (
      type: "rent_overdue" | "repossession_right",
      key: string,
      payload: Record<string, unknown>,
    ) => {
      if (seen.has(`${type}|${key}`)) return;
      await prisma.alert.create({
        data: { operatorId: operator.id, unitId: null, type, payload: { key, ...payload } },
      });
      seen.add(`${type}|${key}`);
      result.alerts += 1;
    };

    const queue = async (
      key: Parameters<typeof queueMessage>[0]["key"],
      dedupeKey: string,
      phone: string | null | undefined,
    ) => {
      const message = await queueMessage({
        operatorId: operator.id,
        locale,
        key,
        dedupeKey,
        phone,
        vars,
        assetId: contract.assetId,
        contractId: contract.id,
      });
      if (message) result.messages += 1;
    };

    if (status.state === "due") {
      await queue(
        "pay_due_driver",
        `pay|${contract.id}|${dueKey}|due`,
        contract.tenantPhone,
      );
      continue;
    }

    const alertPayload = {
      contractId: contract.id,
      assetId: contract.assetId,
      assetName: contract.asset.name,
      plate: contract.asset.plateNumber,
      tenantName: contract.tenantName,
      tenantPhone: contract.tenantPhone,
      dueDate: dueKey,
      daysOverdue: status.daysOverdue,
      graceDays: status.graceDays,
      amountDue: Math.round(status.amountDue),
      currency: contract.currency,
      repossessFrom: iso(status.repossessFrom),
    };

    if (status.state === "grace") {
      await push("rent_overdue", `${contract.id}|${dueKey}`, alertPayload);
      // One nudge per late day — the driver should feel the clock running.
      await queue(
        "pay_overdue_driver",
        `pay|${contract.id}|${dueKey}|late${status.daysOverdue}`,
        contract.tenantPhone,
      );
    } else if (status.state === "repossess") {
      await push("repossession_right", `${contract.id}|${dueKey}`, alertPayload);
      // Said once, not every day: the window has already run out.
      await queue(
        "pay_repossess_driver",
        `pay|${contract.id}|${dueKey}|repossess`,
        contract.tenantPhone,
      );
      await queue(
        "pay_repossess_owner",
        `pay|${contract.id}|${dueKey}|repossess-owner`,
        operator.notifyPhone,
      );
    }
  }

  return result;
}
