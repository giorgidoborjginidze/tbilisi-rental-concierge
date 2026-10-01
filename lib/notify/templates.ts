import type { Locale } from "@/lib/i18n/strings";

// Notification bodies: the geofence warnings and the payment-schedule
// reminders. Cars and property get different wording — a flat tenant is
// never told about "the vehicle", red lines or 112. The property texts
// speak of late rent and of the landlord's rights under the lease.
//
// These are DEFAULTS. Every one of them is editable per workspace
// (NotifyTemplate rows), because the owner — not the platform — is the one
// who decides what to promise the driver and who is answerable for the
// wording. Activo cannot itself report anything to 112; the geofence texts
// therefore speak about the owner's contractual *right* to hand the plate
// over, not about the platform having done it.
//
// Placeholders are {name} pairs, substituted by render().

export const TEMPLATE_KEYS = [
  "geo_approach_driver",
  "geo_approach_owner",
  "geo_breach_driver",
  "geo_breach_owner",
  "pay_due_driver",
  "pay_overdue_driver",
  "pay_repossess_driver",
  "pay_repossess_owner",
  "lease_due_tenant",
  "lease_overdue_tenant",
  "lease_late_tenant",
  "lease_late_owner",
  "gps_silent_owner",
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export type TemplateRole = "driver" | "tenant" | "owner";

/** Who a template is addressed to — decides which phone number is used. */
export const TEMPLATE_ROLE: Record<TemplateKey, TemplateRole> = {
  geo_approach_driver: "driver",
  geo_approach_owner: "owner",
  geo_breach_driver: "driver",
  geo_breach_owner: "owner",
  pay_due_driver: "driver",
  pay_overdue_driver: "driver",
  pay_repossess_driver: "driver",
  pay_repossess_owner: "owner",
  lease_due_tenant: "tenant",
  lease_overdue_tenant: "tenant",
  lease_late_tenant: "tenant",
  lease_late_owner: "owner",
  gps_silent_owner: "owner",
};

/**
 * Texts that state the owner's legal right towards the driver (the plate
 * to 112): fixed wording, not editable per workspace — what a driver is
 * told about the police is not something to improvise. The owner's own
 * texts stay editable.
 */
export const FIXED_TEMPLATE_KEYS: readonly TemplateKey[] = ["geo_approach_driver", "geo_breach_driver"];

export const isFixedTemplate = (key: string): boolean =>
  (FIXED_TEMPLATE_KEYS as readonly string[]).includes(key);

/**
 * An edited text to a driver or tenant may not bring in the police: "112"
 * stays in the fixed red-line texts only.
 */
export const mentionsPolice = (body: string): boolean => /(^|\D)112(\D|$)/.test(body);

/**
 * The line every message to a driver or tenant ends with: how to stop
 * them. The owner records the objection on the contract (no more messages).
 */
export function optOutLine(locale: Locale): string {
  return locale === "ka"
    ? "(შეტყობინებები აღარ გსურთ? აცნობეთ გამქირავებელს.)"
    : "(Don't want these messages? Tell the owner.)";
}

/** Which wording an asset gets: vehicles keep the car texts. */
export type TemplateFamily = "vehicle" | "property";

export function templateFamily(category: string | null | undefined): TemplateFamily {
  return category === "vehicle" ? "vehicle" : "property";
}

/** The four payment-schedule messages, per family. */
export interface PaymentTemplateKeys {
  due: TemplateKey;
  overdue: TemplateKey;
  late: TemplateKey;
  lateOwner: TemplateKey;
}

export const PAYMENT_TEMPLATES: Record<TemplateFamily, PaymentTemplateKeys> = {
  vehicle: {
    due: "pay_due_driver",
    overdue: "pay_overdue_driver",
    late: "pay_repossess_driver",
    lateOwner: "pay_repossess_owner",
  },
  property: {
    due: "lease_due_tenant",
    overdue: "lease_overdue_tenant",
    late: "lease_late_tenant",
    lateOwner: "lease_late_owner",
  },
};

export function paymentTemplates(category: string | null | undefined): PaymentTemplateKeys {
  return PAYMENT_TEMPLATES[templateFamily(category)];
}

/** Templates that apply to an asset of this category (the editor's list). */
export function templateKeysFor(category: string | null | undefined): TemplateKey[] {
  return templateFamily(category) === "vehicle"
    ? TEMPLATE_KEYS.filter((key) => !key.startsWith("lease_"))
    : TEMPLATE_KEYS.filter((key) => key.startsWith("lease_"));
}

export interface TemplateVars {
  plate?: string;
  asset?: string;
  driver?: string;
  /** The renter's name in property wording (same person as {driver}). */
  tenant?: string;
  amount?: string;
  currency?: string;
  /** The due date, written out in the message's language. */
  date?: string;
  days?: string;
  grace?: string;
  /** The last day the delay is still tolerated (the grace window's end). */
  deadline?: string;
  fence?: string;
  /** Who is writing: the owner's name (or "the owner" when not given). */
  owner?: string;
  /** The owner's WhatsApp number, so the renter can answer. */
  owner_phone?: string;
  /** How to pay (the owner's payment instructions, Settings → messages). */
  pay_to?: string;
  /** When a tracker last spoke, written out. */
  since?: string;
}

/** What a placeholder holds when its value is not known. */
export const MISSING = "—";

// Driver and tenant texts are formal (თქვენ); the owner's own texts are
// informal (შენ), like the app. Every renter-facing text says who is
// writing ({owner}, and {owner_phone} when the owner has saved a number),
// which car or flat it is about, and by when — so it cannot be mistaken
// for spam. [Bracketed parts] disappear when a value inside them is not
// known (a car without a plate, an owner without a saved number).
const ka: Record<TemplateKey, string> = {
  geo_approach_driver:
    "{asset}[ ({plate})]: თქვენ უახლოვდებით ხელშეკრულებით შეთანხმებულ წითელ ხაზებს. მათი გადაკვეთის შემთხვევაში გამქირავებელს უფლება აქვს, მანქანის ნომერი 112-ს გადასცეს. — {owner}[, {owner_phone}]",
  geo_approach_owner:
    "{asset}[ ({plate})] უახლოვდება წითელ ხაზს[ „{fence}“]. დაუკავშირდი მძღოლს[ ({driver})].",
  geo_breach_driver:
    "{asset}[ ({plate})]: მანქანამ გადაკვეთა ხელშეკრულებით შეთანხმებული წითელი ხაზები. ამ შემთხვევაში გამქირავებელს უფლება აქვს, მანქანის ნომერი 112-ს გადასცეს „შესაძლო ქურდობის“ შეტყობინებით. დაუყოვნებლივ დაბრუნდით ხაზების ფარგლებში და დაუკავშირდით გამქირავებელს. — {owner}[, {owner_phone}]",
  geo_breach_owner:
    "{asset}[ ({plate})] გადაკვეთა წითელი ხაზი[ „{fence}“]. დაუკავშირდი მძღოლს[ ({driver})] ან შეატყობინე 112-ს.",
  pay_due_driver:
    "შეხსენება: {asset}[ ({plate})] — გადასახდელია {amount} {currency}, გადახდის დღე: {date}.[ გადახდა: {pay_to}.] გმადლობთ. — {owner}[, {owner_phone}]",
  pay_overdue_driver:
    "{asset}[ ({plate})] — გადახდა {days} დღით დაგვიანებულია. ხელშეკრულება {grace} დღით დაგვიანებას უშვებს, ბოლო დღე: {deadline}. გთხოვთ, ამ დრომდე დაფაროთ {amount} {currency}.[ გადახდა: {pay_to}.] — {owner}[, {owner_phone}]",
  pay_repossess_driver:
    "{asset}[ ({plate})] — გადახდა {days} დღით დაგვიანებულია და ხელშეკრულებით დაშვებული {grace}-დღიანი ვადა ამოიწურა. დავალიანება: {amount} {currency}. გამქირავებელს უფლება აქვს, მოითხოვოს ავტომობილის დაბრუნება. დაუყოვნებლივ დაუკავშირდით გამქირავებელს[: {owner_phone}]. — {owner}",
  pay_repossess_owner:
    "{asset}[ ({plate})] — მძღოლს[ ({driver})] გადახდა {days} დღით აქვს დაგვიანებული, დავალიანება {amount} {currency}. ხელშეკრულებით უკვე გაქვს ავტომობილის დაბრუნების მოთხოვნის უფლება.",
  lease_due_tenant:
    "შეხსენება: {asset} — ქირის გადახდის დღეა {date}, გადასახდელია {amount} {currency}.[ გადახდა: {pay_to}.] გმადლობთ. — {owner}[, {owner_phone}]",
  lease_overdue_tenant:
    "{asset} — ქირის გადახდა {days} დღით დაგვიანებულია. ხელშეკრულება {grace} დღით დაგვიანებას უშვებს, ბოლო დღე: {deadline}. გთხოვთ, ამ დრომდე დაფაროთ {amount} {currency}.[ გადახდა: {pay_to}.] — {owner}[, {owner_phone}]",
  lease_late_tenant:
    "{asset} — ქირის გადახდა {days} დღით დაგვიანებულია და ხელშეკრულებით დაშვებული {grace}-დღიანი ვადა ამოიწურა. დავალიანება: {amount} {currency}. გთხოვთ, დაუყოვნებლივ დაუკავშირდეთ გამქირავებელს[: {owner_phone}] — ხელშეკრულების პირობებით მას უფლება აქვს, მოითხოვოს დავალიანების დაფარვა ან ხელშეკრულების შეწყვეტა. — {owner}",
  gps_silent_owner:
    "{asset}[ ({plate})]: ტრეკერი დადუმდა — ბოლო სიგნალი: {since}. შეამოწმე, ხომ არ გამოირთო ან არ მოხსნეს: მისი ბოლო მდებარეობა აღარ ნიშნავს, რომ მანქანა ხაზების ფარგლებშია.",
  lease_late_owner:
    "{asset} — დამქირავებელს[ ({tenant})] ქირა {days} დღით აქვს დაგვიანებული, დავალიანება {amount} {currency}. შეღავათიანი ვადა ამოიწურა: ხელშეკრულების პირობებით შეგიძლია მოითხოვო დავალიანების დაფარვა ან ხელშეკრულების შეწყვეტა.",
};

const en: Record<TemplateKey, string> = {
  geo_approach_driver:
    "{asset}[ ({plate})]: you are approaching the red lines agreed in the contract. If you cross them, the owner has the right to pass the vehicle's plate to 112. — {owner}[, {owner_phone}]",
  geo_approach_owner:
    "{asset}[ ({plate})] is approaching the red line[ “{fence}”]. Contact the driver[ ({driver})].",
  geo_breach_driver:
    "{asset}[ ({plate})]: the vehicle has crossed the red lines agreed in the contract. In that case the owner has the right to pass its plate to 112 as a suspected theft. Return inside the lines immediately and contact the owner. — {owner}[, {owner_phone}]",
  geo_breach_owner:
    "{asset}[ ({plate})] has crossed the red line[ “{fence}”]. Contact the driver[ ({driver})] or report it to 112.",
  pay_due_driver:
    "Reminder: {asset}[ ({plate})] — {amount} {currency} is due on {date}.[ Pay to: {pay_to}.] Thank you. — {owner}[, {owner_phone}]",
  pay_overdue_driver:
    "{asset}[ ({plate})] — your payment is {days} day(s) late. The contract allows {grace} days; the last day is {deadline}. Please pay {amount} {currency} by then.[ Pay to: {pay_to}.] — {owner}[, {owner_phone}]",
  pay_repossess_driver:
    "{asset}[ ({plate})] — your payment is {days} day(s) late and the {grace}-day window in the contract has run out. Outstanding: {amount} {currency}. The owner is now entitled to require the vehicle back. Contact the owner immediately[: {owner_phone}]. — {owner}",
  pay_repossess_owner:
    "{asset}[ ({plate})] — the driver[ ({driver})] is {days} day(s) late, {amount} {currency} outstanding. Under the contract you are now entitled to require the vehicle back.",
  lease_due_tenant:
    "Reminder: {asset} — rent of {amount} {currency} is due on {date}.[ Pay to: {pay_to}.] Thank you. — {owner}[, {owner_phone}]",
  lease_overdue_tenant:
    "{asset} — your rent is {days} day(s) late. The lease allows {grace} days; the last day is {deadline}. Please pay {amount} {currency} by then.[ Pay to: {pay_to}.] — {owner}[, {owner_phone}]",
  lease_late_tenant:
    "{asset} — your rent is {days} day(s) late and the {grace}-day window in the lease has run out. Outstanding: {amount} {currency}. Please contact the landlord immediately[: {owner_phone}] — under the lease, the landlord may demand payment or ask to end the tenancy. — {owner}",
  gps_silent_owner:
    "{asset}[ ({plate})]: the tracker has gone silent — last signal: {since}. Check that it was not unplugged or removed: its last position no longer says the car is inside the lines.",
  lease_late_owner:
    "{asset} — the tenant[ ({tenant})] is {days} day(s) late with the rent, {amount} {currency} outstanding. The grace period has run out: under the lease you may demand payment or start ending the tenancy.",
};

export const DEFAULT_TEMPLATES: Record<Locale, Record<TemplateKey, string>> = {
  en,
  ka,
};

export function defaultTemplate(locale: Locale, key: TemplateKey): string {
  return (DEFAULT_TEMPLATES[locale] ?? en)[key];
}

const known = (vars: TemplateVars, name: string) => {
  const value = vars[name as keyof TemplateVars];
  return value != null && value !== "" && value !== MISSING;
};

/**
 * Substitute {placeholders}. A [bracketed part] holding a placeholder is
 * kept (without its brackets) only when every value in it is known, and
 * dropped otherwise — "Prius[ ({plate})]" reads "Prius (AA-001-AA)" or just
 * "Prius". Brackets with no placeholder inside are left as typed. Outside
 * brackets, an unknown or empty placeholder stays visible, never blanked.
 */
export function render(body: string, vars: TemplateVars): string {
  const withOptional = body.replace(/\[([^\[\]]*\{\w+\}[^\[\]]*)\]/g, (_match, inner: string) => {
    const names = [...inner.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    return names.every((name) => known(vars, name)) ? inner : "";
  });
  return withOptional.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name as keyof TemplateVars];
    return value == null || value === "" ? match : value;
  });
}
