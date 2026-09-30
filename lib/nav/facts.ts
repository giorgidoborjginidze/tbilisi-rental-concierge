// The workspace facts the navigation model needs (lib/nav/model.ts), read
// once per request: the top nav, the tab bar and the tour all ask.

import { cache } from "react";
import { prisma } from "@/lib/db";
import { navModel, type NavModel } from "./model";
import { DAY_LET_WITHOUT_UNIT } from "@/lib/property/places";

export const workspaceNav = cache(
  async (operatorId: string, profile: string): Promise<NavModel> => {
    // Places let by the night: units, and day-let flats that only exist
    // under Assets so far (lib/property/places.ts) — both are on the
    // Rentals calendar.
    const [units, looseFlats] = await Promise.all([
      prisma.unit.count({ where: { operatorId } }),
      prisma.asset.count({ where: { operatorId, ...DAY_LET_WITHOUT_UNIT } }),
    ]);
    return navModel({ profile, units: units + looseFlats });
  },
);
