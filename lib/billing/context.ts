// Server-side billing context: which plan applies to an operator right
// now, company-wide usage counts, and whether adding more is allowed.

import { prisma } from "@/lib/db";
import {
  effectivePlan,
  trialDaysLeft,
  underLimit,
  type AccountType,
  type PlanDef,
} from "./plans";

export interface BillingOperator {
  id: string;
  accountType: string;
  plan: string | null;
  trialEndsAt: Date | null;
  companyId: string | null;
  role: string;
}

export interface BillingContext {
  plan: PlanDef;
  trialDaysLeft: number;
  /** The billing account the limits are counted against. */
  companyId: string;
  isOwner: boolean;
  /** All operator ids whose records count toward the limits. */
  scopeIds: string[];
  assetCount: number;
  unitCount: number;
  memberCount: number;
  canAddAsset: boolean;
  canAddUnit: boolean;
}

/**
 * Members inherit the company's billing state; personal accounts are
 * their own company of one.
 */
export async function getBillingContext(
  operator: BillingOperator,
): Promise<BillingContext> {
  const owner =
    operator.companyId != null
      ? await prisma.operator.findUnique({ where: { id: operator.companyId } })
      : null;
  const account = owner ?? operator;

  const members = await prisma.operator.findMany({
    where: { companyId: account.id },
    select: { id: true },
  });
  const scopeIds = [account.id, ...members.map((m) => m.id)];

  const now = new Date();
  const plan = effectivePlan(
    {
      accountType: (account.accountType as AccountType) ?? "personal",
      plan: account.plan,
      trialEndsAt: account.trialEndsAt,
    },
    now,
  );

  const [assetCount, unitCount] = await Promise.all([
    prisma.asset.count({ where: { operatorId: { in: scopeIds } } }),
    prisma.unit.count({ where: { operatorId: { in: scopeIds } } }),
  ]);

  return {
    plan,
    trialDaysLeft: trialDaysLeft(account.trialEndsAt, now),
    companyId: account.id,
    isOwner: operator.companyId == null,
    scopeIds,
    assetCount,
    unitCount,
    memberCount: scopeIds.length,
    canAddAsset: underLimit(assetCount, plan.maxAssets),
    canAddUnit: underLimit(unitCount, plan.maxUnits),
  };
}
