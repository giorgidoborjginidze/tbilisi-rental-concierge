import { prisma } from "@/lib/db";

// The wording of a late-rent alert follows the asset: a flat's lease is not
// a vehicle to take back. New alerts carry the asset's category in their
// payload; older ones do not, so it is looked up by payload.assetId.

interface CategoryPayload {
  assetId?: string;
  category?: string;
}

/** Returns a resolver: the category an alert's payload is about, or null. */
export async function alertCategories(
  operatorId: string,
  alerts: { payload: unknown }[],
): Promise<(payload: unknown) => string | null> {
  const missing = [
    ...new Set(
      alerts
        .map((alert) => alert.payload as CategoryPayload | null)
        .filter((payload) => payload && !payload.category && payload.assetId)
        .map((payload) => payload!.assetId!),
    ),
  ];
  const looked = missing.length
    ? new Map(
        (
          await prisma.asset.findMany({
            where: { id: { in: missing }, operatorId },
            select: { id: true, category: true },
          })
        ).map((asset) => [asset.id, asset.category]),
      )
    : new Map<string, string>();
  return (payload) => {
    const value = payload as CategoryPayload | null;
    if (value?.category) return value.category;
    return value?.assetId ? looked.get(value.assetId) ?? null : null;
  };
}
