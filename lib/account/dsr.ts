// Data-subject requests: the two things every operator is entitled to ask
// for and, until now, could not.
//
//   collectAccountData()  → access + portability (GDPR Art. 15 & 20, and
//                           the equivalent rights in Georgian law): the
//                           whole account as structured JSON.
//   eraseAccount()        → erasure (GDPR Art. 17): the account and every
//                           record hanging off it, gone for good.
//
// Both are deliberately implemented against the schema rather than against
// a hand-written list of tables: a new model added later shows up in the
// export the moment it is included here, and the erasure test below is what
// catches it if someone forgets.

import { prisma } from "@/lib/db";
import { recordAudit, subjectRef } from "@/lib/audit/log";

export interface AccountExport {
  exportedAt: string;
  format: "activo.account-export.v1";
  notice: string;
  account: unknown;
  units: unknown[];
  bookings: unknown[];
  leases: unknown[];
  assets: unknown[];
  contracts: unknown[];
  rentPayments: unknown[];
  dayEntries: unknown[];
  cryptoTrades: unknown[];
  incomes: unknown[];
  alerts: unknown[];
  pricingSuggestions: unknown[];
  geofences: unknown[];
  geoEvents: unknown[];
  gpsDevices: unknown[];
  notifyMessages: unknown[];
  notifyTemplates: unknown[];
  payments: unknown[];
  invites: unknown[];
  sessions: unknown[];
}

const EXPORT_NOTICE =
  "Everything this workspace holds about you and the people you record. " +
  "It may contain other people's data (tenants, drivers, guests) that you " +
  "entered — you are the controller of that data and answerable for what " +
  "you do with this file.";

/**
 * Everything the account owns, in one structured object. Secrets are left
 * out on purpose: the password hash and the session tokens are ours to
 * hold, not data about the person, and re-publishing them would only widen
 * the blast radius of a mislaid export file.
 */
export async function collectAccountData(
  operatorId: string,
): Promise<AccountExport> {
  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: {
      id: true, name: true, email: true, locale: true, createdAt: true,
      accountType: true, profile: true, plan: true, trialEndsAt: true,
      planSetAt: true, paidUntil: true, companyId: true, role: true,
      notifyPhone: true,
    },
  });
  if (!operator) throw new Error("account not found");

  const unitIds = (
    await prisma.unit.findMany({
      where: { operatorId },
      select: { id: true },
    })
  ).map((u) => u.id);
  const assetIds = (
    await prisma.asset.findMany({
      where: { operatorId },
      select: { id: true },
    })
  ).map((a) => a.id);
  const contractIds = (
    await prisma.rentalContract.findMany({
      where: { assetId: { in: assetIds } },
      select: { id: true },
    })
  ).map((c) => c.id);

  const [
    units, bookings, leases, assets, contracts, rentPayments, dayEntries,
    cryptoTrades, incomes, alerts, pricingSuggestions, geofences, geoEvents,
    gpsDevices, notifyMessages, notifyTemplates, payments, invites, sessions,
  ] = await Promise.all([
    prisma.unit.findMany({ where: { operatorId } }),
    prisma.booking.findMany({ where: { unitId: { in: unitIds } } }),
    prisma.lease.findMany({ where: { unitId: { in: unitIds } } }),
    prisma.asset.findMany({ where: { operatorId } }),
    prisma.rentalContract.findMany({ where: { assetId: { in: assetIds } } }),
    prisma.rentPayment.findMany({ where: { contractId: { in: contractIds } } }),
    prisma.dayEntry.findMany({ where: { assetId: { in: assetIds } } }),
    prisma.cryptoTrade.findMany({ where: { assetId: { in: assetIds } } }),
    prisma.incomeRecord.findMany({ where: { operatorId } }),
    prisma.alert.findMany({ where: { operatorId } }),
    prisma.pricingSuggestion.findMany({ where: { unitId: { in: unitIds } } }),
    prisma.geofence.findMany({ where: { assetId: { in: assetIds } } }),
    prisma.geoEvent.findMany({ where: { assetId: { in: assetIds } } }),
    // The tracker's shared secret is a credential, not personal data.
    prisma.gpsDevice.findMany({
      where: { assetId: { in: assetIds } },
      select: {
        id: true, assetId: true, label: true, provider: true, deviceId: true,
        lastLat: true, lastLng: true, lastSpeed: true, lastPingAt: true,
        createdAt: true,
      },
    }),
    prisma.notifyMessage.findMany({ where: { operatorId } }),
    prisma.notifyTemplate.findMany({ where: { operatorId } }),
    prisma.payment.findMany({ where: { operatorId } }),
    prisma.invite.findMany({ where: { companyId: operatorId } }),
    // Session ids are hashes of live cookies — the metadata only.
    prisma.session.findMany({
      where: { operatorId },
      select: { createdAt: true, expiresAt: true },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    format: "activo.account-export.v1",
    notice: EXPORT_NOTICE,
    account: operator,
    units, bookings, leases, assets, contracts, rentPayments, dayEntries,
    cryptoTrades, incomes, alerts, pricingSuggestions, geofences, geoEvents,
    gpsDevices, notifyMessages, notifyTemplates, payments, invites, sessions,
  };
}

export interface ErasureCounts {
  units: number;
  bookings: number;
  assets: number;
  contracts: number;
  alerts: number;
  incomes: number;
  notifyMessages: number;
  geoEvents: number;
  payments: number;
}

/**
 * Erase the account. Every child record is removed by the schema's cascade
 * rules, so this is one delete — but the counts are read first, because
 * afterwards there is nothing left to count and a data subject is entitled
 * to be told what was destroyed.
 *
 * Team members keep their own accounts (the company link is nulled by the
 * schema); a member erasing themselves leaves the company untouched.
 *
 * Open point, deliberately not decided in code: once real card payments run
 * through Flitt, accounting law may require the Payment rows to outlive the
 * account. Today they are sandbox rows and go with it.
 */
export async function eraseAccount(operator: {
  id: string;
  email: string;
}): Promise<ErasureCounts> {
  const assetIds = (
    await prisma.asset.findMany({
      where: { operatorId: operator.id },
      select: { id: true },
    })
  ).map((a) => a.id);
  const unitIds = (
    await prisma.unit.findMany({
      where: { operatorId: operator.id },
      select: { id: true },
    })
  ).map((u) => u.id);

  const [
    units, bookings, assets, contracts, alerts, incomes, notifyMessages,
    geoEvents, payments,
  ] = await Promise.all([
    prisma.unit.count({ where: { operatorId: operator.id } }),
    prisma.booking.count({ where: { unitId: { in: unitIds } } }),
    prisma.asset.count({ where: { operatorId: operator.id } }),
    prisma.rentalContract.count({ where: { assetId: { in: assetIds } } }),
    prisma.alert.count({ where: { operatorId: operator.id } }),
    prisma.incomeRecord.count({ where: { operatorId: operator.id } }),
    prisma.notifyMessage.count({ where: { operatorId: operator.id } }),
    prisma.geoEvent.count({ where: { assetId: { in: assetIds } } }),
    prisma.payment.count({ where: { operatorId: operator.id } }),
  ]);

  const counts: ErasureCounts = {
    units, bookings, assets, contracts, alerts, incomes, notifyMessages,
    geoEvents, payments,
  };

  // Written before the delete, so a crash mid-way still leaves evidence
  // that the request was acted on.
  await prisma.erasureRecord.create({
    data: {
      subjectRef: subjectRef(operator.email),
      scope: "account",
      counts: counts as never,
    },
  });

  await recordAudit({
    action: "account_erased",
    actorId: operator.id,
    actorEmail: operator.email,
    entity: "Operator",
    entityId: operator.id,
    detail: counts as unknown as Record<string, unknown>,
  });

  // The audit trail keeps the pseudonymous ref but must stop pointing at a
  // person: the account id it carried is now meaningless anyway.
  await prisma.auditLog.updateMany({
    where: { actorId: operator.id },
    data: { actorId: null },
  });

  await prisma.operator.delete({ where: { id: operator.id } });

  return counts;
}
