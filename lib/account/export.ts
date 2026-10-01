// Everything a workspace holds about its own business, as one JSON file —
// the owner's copy of their data (Privacy policy: access and portability).
// Secrets are left out: no password hash, sessions, reset links, tracker
// keys or payment-gateway references.

import { prisma } from "@/lib/db";

export async function exportWorkspace(operatorId: string) {
  const [operator, assets, units, alerts, incomes, templates, messages, payments] = await Promise.all([
    prisma.operator.findUnique({
      where: { id: operatorId },
      select: {
        email: true, name: true, accountType: true, profile: true, locale: true,
        plan: true, trialEndsAt: true, paidUntil: true, notifyPhone: true,
        payInstructions: true, createdAt: true,
      },
    }),
    prisma.asset.findMany({
      where: { operatorId },
      include: {
        // all-contracts: the export holds every stored row, deleted contracts too.
        contracts: { include: { payments: true } },
        trades: true,
        days: true,
        geofences: { include: { events: true } },
        gpsDevice: { select: { deviceId: true, label: true, provider: true, lastPingAt: true, lastLat: true, lastLng: true } },
      },
    }),
    prisma.unit.findMany({
      where: { operatorId },
      include: { bookings: true, leases: true, feeds: { select: { url: true, source: true, lastSyncedAt: true } } },
    }),
    prisma.alert.findMany({ where: { operatorId } }),
    prisma.incomeRecord.findMany({ where: { operatorId } }),
    prisma.notifyTemplate.findMany({ where: { operatorId }, select: { key: true, body: true } }),
    prisma.notifyMessage.findMany({
      where: { operatorId },
      select: {
        toPhone: true, toRole: true, kind: true, body: true, status: true,
        createdAt: true, sentAt: true, cancelledAt: true, cancelReason: true, assetId: true, contractId: true,
      },
    }),
    prisma.payment.findMany({
      where: { operatorId },
      select: { plan: true, amountMinor: true, currency: true, status: true, createdAt: true, paidAt: true },
    }),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    format: "activo-export-1",
    account: operator,
    assets,
    units,
    incomes,
    alerts,
    messageTemplates: templates,
    messages,
    billingPayments: payments,
  };
}
