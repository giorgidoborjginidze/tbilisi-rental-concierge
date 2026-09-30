// What the "add asset" form opens with. The query (?category=, ?mode=,
// ?status=) comes from the first-run card and the dashboards; the
// workspace profile fills what the query leaves out — a car rental adds
// cars that are let. Only known values pass: a crafted
// ?category=__proto__ opens the plain form instead of crashing it.
// Pure; client-safe.

import { ASSET_CATEGORIES, ASSET_STATUSES } from "@/lib/types";

export interface NewAssetDefaults {
  category?: string;
  mode?: "long_term" | "daily";
  status?: string;
}

const known = (list: readonly string[], value: string | undefined) =>
  value != null && list.includes(value) ? value : undefined;

export function newAssetDefaults(
  profile: string,
  query: { category?: string; mode?: string; status?: string },
): NewAssetDefaults {
  const category =
    known(ASSET_CATEGORIES, query.category) ?? (profile === "car_rental" ? "vehicle" : undefined);
  const mode = query.mode === "daily" || query.mode === "long_term" ? query.mode : undefined;
  const status =
    known(ASSET_STATUSES, query.status) ??
    (category === "vehicle" && profile === "car_rental"
      ? "rented"
      : mode === "daily"
        ? "vacant"
        : undefined);
  return { category, mode, status };
}
