// The workspace facts the navigation model needs (lib/nav/model.ts), read
// once per request: the top nav, the tab bar and the tour all ask.

import { cache } from "react";
import { prisma } from "@/lib/db";
import { navModel, type NavModel } from "./model";

export const workspaceNav = cache(
  async (operatorId: string, profile: string): Promise<NavModel> => {
    const units = await prisma.unit.count({ where: { operatorId } });
    return navModel({ profile, units });
  },
);
