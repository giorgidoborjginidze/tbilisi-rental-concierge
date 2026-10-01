// The workspace facts the navigation model needs (lib/nav/model.ts), read
// once per request: the top nav, the tab bar and the tour all ask.

import { cache } from "react";
import { prisma } from "@/lib/db";
import { navModel, type NavModel } from "./model";
import { DAY_LET_WITHOUT_UNIT } from "@/lib/property/places";
import { NEEDS_YOU_TYPES } from "@/lib/alerts/rank";
import { owingEndingIds } from "@/lib/alerts/owing";

export const workspaceNav = cache(
  async (operatorId: string, profile: string): Promise<NavModel> => {
    // Places let by the night: units, and day-let flats that only exist
    // under Assets so far (lib/property/places.ts) — both are on the
    // Rentals calendar.
    const [units, looseFlats, rentedCars, contracts] = await Promise.all([
      prisma.unit.count({ where: { operatorId } }),
      prisma.asset.count({ where: { operatorId, ...DAY_LET_WITHOUT_UNIT } }),
      // Cars on a contract: the fleet list is worth a way in.
      prisma.asset.count({
        where: { operatorId, category: "vehicle", contracts: { some: { deletedAt: null } } },
      }),
      prisma.rentalContract.count({ where: { deletedAt: null, asset: { operatorId } } }),
    ]);
    return navModel({ profile, units: units + looseFlats, vehicles: rentedCars, contracts });
  },
);

/**
 * The bell's badge: how many open alerts need the owner now (urgent ones
 * and late rent — lib/alerts/rank.ts — plus a finished contract that still
 * owes rent, lib/alerts/owing.ts), or a dot when only advice waits.
 * Read once per request by the top nav and the tab bar.
 */
export const alertBadge = cache(
  async (operatorId: string): Promise<number | "dot" | null> => {
    const [needs, advice, endings] = await Promise.all([
      prisma.alert.count({
        where: { operatorId, status: "open", type: { in: [...NEEDS_YOU_TYPES] } },
      }),
      prisma.alert.count({
        where: { operatorId, status: "open", type: { notIn: [...NEEDS_YOU_TYPES, "contract_ended"] } },
      }),
      prisma.alert.findMany({
        where: { operatorId, status: "open", type: "contract_ended" },
        select: { id: true, type: true, payload: true },
        take: 200,
      }),
    ]);
    const owing = endings.length > 0 ? (await owingEndingIds(operatorId, endings)).size : 0;
    const total = needs + owing;
    return total > 0 ? total : advice + endings.length - owing > 0 ? "dot" : null;
  },
);
