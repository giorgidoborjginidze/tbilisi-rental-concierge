// Which rental service desk an asset gets — pure, client-safe.
//
// The desk (/assets/<id>/rental) exists only for what is actually rented
// out: a vehicle gets the full desk (payments, GPS tracker and red lines,
// messages to the driver); real estate gets payments and tenant reminders
// in property wording — no plate, tracker or red lines. Crypto, stocks,
// metals and income streams are never rented, so they get no desk, no
// link and no chip. Equipment ("other") gets the property desk only once
// a contract has been added to it (its payments must stay recordable).

export type RentalDesk = "vehicle" | "property";

export function rentalDesk(category: string, contractCount = 0): RentalDesk | null {
  if (category === "vehicle") return "vehicle";
  if (category === "real_estate") return "property";
  if (category === "other" && contractCount > 0) return "property";
  return null;
}

/** The vehicle desk's in-page tabs, in order. */
export const DESK_TABS = ["overview", "payments", "gps", "messages"] as const;
export type DeskTab = (typeof DESK_TABS)[number];

/**
 * The tab a vehicle's desk opens on: the one asked for (?tab=), else the
 * payments while the car is out on a contract or a finished one still owes
 * money — that is what the owner opens a rented car for — else the
 * overview.
 */
export function deskTab(requested: string | null | undefined, owesOrRented: boolean): DeskTab {
  if (requested && (DESK_TABS as readonly string[]).includes(requested)) return requested as DeskTab;
  return owesOrRented ? "payments" : "overview";
}

/** The desk tab an alert about an asset leads to. */
export function alertDeskTab(type: string): DeskTab {
  switch (type) {
    case "geofence_breach":
    case "tracker_silent":
      return "gps";
    case "rent_overdue":
    case "repossession_right":
    case "contract_ended":
    case "overlap":
      return "payments";
    default:
      return "overview";
  }
}

/** The desk's address, on a tab for vehicles (the property desk has one page). */
export function deskHref(assetId: string, desk: RentalDesk, tab?: DeskTab): string {
  const base = `/assets/${assetId}/rental`;
  return desk === "vehicle" && tab ? `${base}?tab=${tab}` : base;
}

/** What the fleet list sorts a car by: the most urgent first. */
export interface FleetFacts {
  /** Payment state of the contract the car's money follows (null: none/untracked). */
  payState: string | null;
  /** That contract has ended with rent still owed. */
  endedOwing: boolean;
  /** Last seen outside an active red line. */
  outside: boolean;
  /** The tracker has gone quiet while the car is watched. */
  silent: boolean;
  /** Out on a contract today. */
  rented: boolean;
}

export function fleetRank(car: FleetFacts): number {
  if (car.payState === "repossess" || car.outside) return 0;
  if (car.endedOwing || car.payState === "grace") return 1;
  if (car.payState === "due" || car.silent) return 2;
  if (car.rented) return 3;
  return 4;
}
