import { prisma } from "@/lib/db";
import { asLocale } from "@/lib/i18n/strings";
import { queueMessage } from "@/lib/notify/whatsapp";
import {
  paymentTemplates,
  templateFamily,
  TEMPLATE_ROLE,
} from "@/lib/notify/templates";
import { dayKey, sameTbilisiDay, startOfTodayTbilisi } from "@/lib/time";
import { activeContractWhere } from "./phase";
import { LIVE_CONTRACT } from "./live";
import { statusFor } from "./terms";
import { formatDue } from "./money";
import { baseVars, messageDate } from "@/lib/notify/vars";
import { sweepStaleMessages, sweepStaleRentAlerts } from "./settle";

// Re-exported so existing callers keep one import for "the rent status".
export {
  dailyRateFor,
  periodAmount,
  statusFor,
  type DailyPricing,
} from "./terms";

// Watches the payment schedule of every running contract and turns it
// into alerts and WhatsApp reminders:
//
//   due day        → a polite reminder to the renter
//   1…grace days   → one nudge per late day, still inside the tolerance
//   past grace     → the renter is told the window has run out, and the
//                    owner is told what the contract now allows
//
// Cars get the vehicle wording (repossession); flats and other property
// get lease wording — no "vehicle", no 112. Everything is deduped on the
// due date, so re-running the scan is safe.

export interface RentalMonitorResult {
  contracts: number;
  alerts: number;
  messages: number;
}

export async function monitorRentPayments(
  now = new Date(),
  operatorId?: string,
): Promise<RentalMonitorResult> {
  const today = startOfTodayTbilisi(now);
  // Running contracts only, by their dates: one that starts tomorrow is
  // watched from tomorrow, and a finished one is no longer chased. A
  // contract with no paid-up-to date has never had its schedule tracked —
  // announcing that it is a year overdue would be false.
  const contracts = await prisma.rentalContract.findMany({
    where: {
      ...activeContractWhere(today),
      ...LIVE_CONTRACT,
      paidThrough: { not: null },
      ...(operatorId ? { asset: { operatorId } } : {}),
    },
    include: {
      asset: {
        include: {
          operator: { select: { id: true, locale: true, notifyPhone: true, name: true, payInstructions: true } },
        },
      },
    },
  });

  const result: RentalMonitorResult = { contracts: 0, alerts: 0, messages: 0 };

  // First withdraw what no longer holds: reminders and alerts about rent
  // that has been paid, about contracts that have ended or were deleted,
  // red-line texts for a vehicle that is back inside.
  await sweepStaleMessages(prisma, today, operatorId, now);
  await sweepStaleRentAlerts(prisma, today, { operatorId }, now);

  // Dedupe alerts the same way the main scan does: on type + payload key.
  const existing = await prisma.alert.findMany({
    where: {
      type: { in: ["rent_overdue", "repossession_right"] },
      ...(operatorId ? { operatorId } : {}),
    },
    select: { id: true, type: true, status: true, payload: true },
  });
  const known = new Map(
    existing.map((alert) => {
      const payload = alert.payload as { key?: string };
      return [`${alert.type}|${payload.key ?? ""}`, alert] as const;
    }),
  );

  for (const contract of contracts) {
    const status = statusFor(contract, today, contract.asset);
    if (status.state === "not_started" || status.state === "ended" || status.state === "ok") {
      continue;
    }
    result.contracts += 1;

    const operator = contract.asset.operator;
    // The account's language (Georgian unless the owner chose English).
    const locale = asLocale(operator.locale);
    const family = templateFamily(contract.asset.category);
    const keys = paymentTemplates(contract.asset.category);
    // The renter hears from us only when the owner wants reminders, and
    // never on the day the contract was typed in: the owner sees the
    // status first and can correct a wrong "paid up to" before anything
    // reaches the tenant.
    const tenantMessages =
      contract.remindersEnabled && !sameTbilisiDay(contract.createdAt, now);
    const dueKey = dayKey(status.nextDueDate);
    // Quoted rounded UP to the tetri: paying exactly what the renter is told
    // must settle exactly the periods it is about.
    const amount = formatDue(status.amountDue);
    // The same figures the owner's screens show (statusFor with the
    // asset's pricing), the car or flat by the name the reader knows, who
    // is writing and how to reach them, and the dates written out.
    const vars = {
      ...baseVars(locale, contract.asset, operator, contract.tenantName),
      amount,
      currency: contract.currency,
      date: messageDate(locale, status.nextDueDate),
      deadline: messageDate(locale, status.graceEndsOn),
      days: String(status.daysOverdue),
      grace: String(status.graceDays),
    };

    const push = async (
      type: "rent_overdue" | "repossession_right",
      key: string,
      payload: Record<string, unknown>,
    ) => {
      const found = known.get(`${type}|${key}`);
      if (!found) {
        const created = await prisma.alert.create({
          data: { operatorId: operator.id, unitId: null, type, payload: { key, ...payload } },
        });
        known.set(`${type}|${key}`, {
          id: created.id,
          type,
          status: "open",
          payload: created.payload,
        });
        result.alerts += 1;
        return;
      }
      const previous = found.payload as { autoResolved?: string };
      if (found.status === "open") {
        // Keep the figures current: the debt and the days late grow.
        await prisma.alert.update({
          where: { id: found.id },
          data: { payload: { key, ...payload } },
        });
      } else if (found.status === "resolved" && previous.autoResolved) {
        // Closed by the system (a payment later undone, a date restated)
        // and late again for the same due date: it comes back. An alert
        // the owner closed by hand stays closed.
        await prisma.alert.update({
          where: { id: found.id },
          data: { status: "open", resolvedAt: null, payload: { key, ...payload } },
        });
        found.status = "open";
        result.alerts += 1;
      }
    };

    const queue = async (
      key: Parameters<typeof queueMessage>[0]["key"],
      dedupeKey: string,
      phone: string | null | undefined,
    ) => {
      if (TEMPLATE_ROLE[key] !== "owner" && !tenantMessages) return;
      const message = await queueMessage({
        operatorId: operator.id,
        locale,
        key,
        dedupeKey,
        phone,
        vars,
        assetId: contract.assetId,
        contractId: contract.id,
        now,
      });
      if (message) result.messages += 1;
    };

    if (status.state === "due") {
      await queue(
        keys.due,
        `pay|${contract.id}|${dueKey}|due`,
        contract.tenantPhone,
      );
      continue;
    }

    const alertPayload = {
      contractId: contract.id,
      assetId: contract.assetId,
      assetName: contract.asset.name,
      category: contract.asset.category,
      family,
      plate: family === "vehicle" ? contract.asset.plateNumber : null,
      tenantName: contract.tenantName,
      tenantPhone: contract.tenantPhone,
      dueDate: dueKey,
      daysOverdue: status.daysOverdue,
      graceDays: status.graceDays,
      // Exact, to the tetri — screens format it themselves.
      amountDue: status.amountDue,
      currency: contract.currency,
      repossessFrom: dayKey(status.repossessFrom),
    };

    if (status.state === "grace") {
      await push("rent_overdue", `${contract.id}|${dueKey}`, alertPayload);
      // One nudge per late day — the renter should feel the clock running.
      await queue(
        keys.overdue,
        `pay|${contract.id}|${dueKey}|late${status.daysOverdue}`,
        contract.tenantPhone,
      );
    } else if (status.state === "repossess") {
      await push("repossession_right", `${contract.id}|${dueKey}`, alertPayload);
      // One alert per late due date: the "rent late" one for the same date
      // has been overtaken by the repossession right.
      const earlier = known.get(`rent_overdue|${contract.id}|${dueKey}`);
      if (earlier && earlier.status === "open") {
        await prisma.alert.update({
          where: { id: earlier.id },
          data: {
            status: "resolved",
            resolvedAt: now,
            payload: { ...(earlier.payload as object), autoResolved: "escalated" },
          },
        });
        earlier.status = "resolved";
      }
      // Said once, not every day: the window has already run out.
      await queue(
        keys.late,
        `pay|${contract.id}|${dueKey}|repossess`,
        contract.tenantPhone,
      );
      await queue(
        keys.lateOwner,
        `pay|${contract.id}|${dueKey}|repossess-owner`,
        operator.notifyPhone,
      );
    }
  }

  return result;
}
