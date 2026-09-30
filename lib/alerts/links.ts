// Where an alert leads: the exact place it is about — the unit's calendar
// on the alert's month, the price table, the car's desk tab, the contract
// on the asset's page. Pure, client-safe.

import { alertDeskTab, deskHref, type RentalDesk } from "@/lib/rentals/desk";
import { alertDay } from "./rank";

export interface LinkableAlert {
  type: string;
  unitId: string | null;
  payload: unknown;
}

const assetIdOf = (payload: unknown): string | null => {
  const id = (payload as { assetId?: unknown } | null)?.assetId;
  return typeof id === "string" && id ? id : null;
};

/** The unit's calendar, opened on the month the alert is about. */
export function calendarHref(unitId: string, day: string | null): string {
  return day ? `/calendar?unit=${unitId}&month=${day.slice(0, 7)}` : `/calendar?unit=${unitId}`;
}

export function alertHref(
  alert: LinkableAlert,
  deskOf: (assetId: string) => RentalDesk | null,
): string {
  const assetId = assetIdOf(alert.payload);
  if (alert.unitId) {
    // The night price table, from the unit's own row.
    if (alert.type === "underpriced") return `/pricing?unit=${alert.unitId}`;
    return calendarHref(alert.unitId, alertDay(alert.payload));
  }
  if (assetId) {
    // Two contracts over the same days: the fix is a contract's end date.
    if (alert.type === "overlap") return `/assets/${assetId}/edit#contracts`;
    const desk = deskOf(assetId);
    return desk ? deskHref(assetId, desk, alertDeskTab(alert.type)) : `/assets/${assetId}/edit`;
  }
  return "/alerts";
}
