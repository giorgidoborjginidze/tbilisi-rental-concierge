// One navigation model for every surface — the desktop top nav, the phone's
// tab bar, the account menu and the guided tour — derived from one rule:
// a section appears only when the workspace has it. Pure and client-safe.
//
//  · Rentals (calendar, units, analytics) — a hotel, or any workspace that
//    has units. Its landing page is the calendar.
//  · Fleet (who is late, the cars' service desks) — a car rental.
//  · Neither — personal and brokerage workspaces without units work in
//    Assets and Invest.
//
// The phone keeps the owner's layout: five icon-only seats, Assets raised in
// the centre. Only what each seat opens follows the workspace, so no seat
// ever leads to a page that is empty for this workspace.

import type { StringKey } from "@/lib/i18n/strings";

export type NavIcon =
  | "home"
  | "grid"
  | "calendar"
  | "building"
  | "bell"
  | "car"
  | "invest"
  | "menu";

export interface NavEntry {
  key: string;
  href: string;
  labelKey: StringKey;
  icon: NavIcon;
}

export interface TabSeat extends NavEntry {
  /** The raised centre seat (Assets). */
  center?: boolean;
  /** Opens the account menu instead of a page. */
  action?: "menu";
}

export type PrimaryModule = "rentals" | "fleet" | null;

/** The workspace types (Operator.profile), changeable in Settings. */
export const WORKSPACE_PROFILES = ["personal", "hotel", "brokerage", "car_rental"] as const;

export interface NavFacts {
  /** Operator.profile: "personal" | "hotel" | "brokerage" | "car_rental". */
  profile: string;
  /** Units (rentable rooms/flats with calendars) in the workspace. */
  units: number;
  /** Cars with a contract (the fleet list has something to show). */
  vehicles?: number;
  /** Rental contracts of any asset (invoices are worth a way in). */
  contracts?: number;
}

export interface NavModel {
  primary: PrimaryModule;
  /** Desktop top nav — never more than five entries. */
  top: NavEntry[];
  /** Phone tab bar — exactly five seats, Assets in the centre. */
  tabs: TabSeat[];
  /** Account menu, phone only: the top-nav entries the tab bar lacks. */
  menuMobile: NavEntry[];
  /** Account menu, every width: a section the top nav has no seat for. */
  menuAlways: NavEntry[];
}

const HOME: NavEntry = { key: "home", href: "/", labelKey: "nav_dashboard", icon: "home" };
const RENTALS: NavEntry = { key: "rentals", href: "/calendar", labelKey: "nav_rentals", icon: "calendar" };
const CALENDAR: NavEntry = { key: "calendar", href: "/calendar", labelKey: "nav_calendar", icon: "calendar" };
const UNITS: NavEntry = { key: "units", href: "/units", labelKey: "nav_units", icon: "building" };
const FLEET: NavEntry = { key: "fleet", href: "/fleet", labelKey: "nav_fleet", icon: "car" };
const ASSETS: NavEntry = { key: "assets", href: "/assets", labelKey: "nav_assets", icon: "grid" };
const INVEST: NavEntry = { key: "invest", href: "/invest", labelKey: "nav_invest", icon: "invest" };
const ALERTS: NavEntry = { key: "alerts", href: "/alerts", labelKey: "nav_alerts", icon: "bell" };
const INVOICES: NavEntry = { key: "invoices", href: "/invoices", labelKey: "invoices_title", icon: "grid" };
const MENU: TabSeat = { key: "menu", href: "#menu", labelKey: "aria_menu", icon: "menu", action: "menu" };

const CENTER: TabSeat = { ...ASSETS, center: true };

/** The section a workspace works in, besides Assets. */
export function primaryModule(facts: NavFacts): PrimaryModule {
  if (facts.profile === "car_rental") return "fleet";
  if (facts.profile === "hotel") return "rentals";
  return facts.units > 0 ? "rentals" : null;
}

export function navModel(facts: NavFacts): NavModel {
  const primary = primaryModule(facts);
  const moduleEntry = primary === "rentals" ? RENTALS : primary === "fleet" ? FLEET : null;
  const top = [HOME, ...(moduleEntry ? [moduleEntry] : []), ASSETS, INVEST, ALERTS];

  const tabs: TabSeat[] =
    primary === "rentals"
      ? [HOME, CALENDAR, CENTER, UNITS, ALERTS]
      : primary === "fleet"
        ? [HOME, FLEET, CENTER, INVEST, ALERTS]
        : [HOME, INVEST, CENTER, ALERTS, MENU];

  // A car rental that also lets flats keeps its calendar, one tap into
  // the account menu (the top nav's five seats are taken).
  // A hotel or a personal workspace that lets cars reaches the fleet list
  // the same way.
  const menuAlways = [
    ...(primary === "fleet" && facts.units > 0 ? [RENTALS] : []),
    ...(primary !== "fleet" && (facts.vehicles ?? 0) > 0 ? [FLEET] : []),
    // Anyone who rents something out bills for it.
    ...((facts.contracts ?? 0) > 0 ? [INVOICES] : []),
  ];

  const tabHrefs = new Set(tabs.map((seat) => seat.href));
  const menuMobile = [...top, ...menuAlways].filter((entry) => !tabHrefs.has(entry.href));

  return { primary, top, tabs, menuMobile, menuAlways };
}

/**
 * The guided tour's stops for this workspace, by step id (tour strings
 * tour_<id>_t / tour_<id>_b). Six at most, and only on pages the workspace
 * has — a car rental is never walked through the hotel calendar.
 */
export function tourStops(primary: PrimaryModule): string[] {
  if (primary === "rentals") return ["s1", "s5", "s7", "s8", "alerts", "s2"];
  if (primary === "fleet") return ["s1", "s3", "s5", "fleet", "alerts", "s2"];
  return ["s1", "s3", "s5", "s9", "alerts", "s2"];
}
