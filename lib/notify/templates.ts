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
};

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
  date?: string;
  days?: string;
  grace?: string;
  fence?: string;
}

const ka: Record<TemplateKey, string> = {
  geo_approach_driver:
    "თქვენ უახლოვდებით შეთანხმებულ წითელ ხაზებს, მისი გადაკვეთის შემთხვევაში გამქირავებელს უფლება აქვს მანქანის ნომერი გადასცეს 112-ს",
  geo_approach_owner:
    "თქვენი მანქანა ნომრით: {plate} უახლოვდება წითელ ხაზებს, დაუკავშირდით მძღოლს",
  geo_breach_driver:
    "გამქირავებელმა შესაძლოა მანქანის ნომერი გადასცა 112-ს, „შესაძლო ქურდობის ბრალდებით“. დაუყოვნებლივ დაუბრუნდით კონტრაქტით გათვალისწინებულ წითელი ხაზების ფარგლებს",
  geo_breach_owner:
    "თქვენმა მანქანამ სახელმწიფო ნომრით: {plate}, გადაკვეთა წითელი ხაზები. დაუკავშირდით მძღოლს ან შეატყობინეთ 112-ს",
  pay_due_driver:
    "შეხსენება: {asset} — გადასახდელია {amount} {currency}, ვადა {date}. მადლობა თანამშრომლობისთვის.",
  pay_overdue_driver:
    "{asset} — გადახდა დაგვიანებულია {days} დღით. კონტრაქტით დაშვებულია მაქსიმუმ {grace} დღე. გთხოვთ დაფაროთ {amount} {currency} ვადის ამოწურვამდე.",
  pay_repossess_driver:
    "{asset} — გადახდა დაგვიანებულია {days} დღით და კონტრაქტით გათვალისწინებული {grace}-დღიანი ვადა ამოიწურა. გამქირავებელს წარმოეშვა ავტომობილის დაბრუნების მოთხოვნის უფლება. დაუყოვნებლივ დაუკავშირდით გამქირავებელს.",
  pay_repossess_owner:
    "{asset} ({plate}) — მძღოლს {driver} გადახდა დაგვიანებული აქვს {days} დღით, დავალიანება {amount} {currency}. კონტრაქტით უკვე გაქვთ ავტომობილის დაბრუნების მოთხოვნის უფლება.",
  // Property: formal to the tenant, informal to the owner.
  lease_due_tenant:
    "შეხსენება: {asset} — ქირის გადახდის ვადაა {date}, გადასახდელია {amount} {currency}. გმადლობთ.",
  lease_overdue_tenant:
    "{asset} — ქირის გადახდა დაგვიანებულია {days} დღით. ხელშეკრულება {grace} დღით დაგვიანებას უშვებს. გთხოვთ, ამ ვადაში დაფაროთ {amount} {currency}.",
  lease_late_tenant:
    "{asset} — ქირის გადახდა დაგვიანებულია {days} დღით და ხელშეკრულებით დაშვებული {grace}-დღიანი ვადა ამოიწურა. დავალიანება: {amount} {currency}. გთხოვთ, დაუყოვნებლივ დაუკავშირდეთ გამქირავებელს — ხელშეკრულების პირობებით მას უფლება აქვს, მოითხოვოს დავალიანების დაფარვა ან ხელშეკრულების შეწყვეტა.",
  lease_late_owner:
    "{asset} — დამქირავებელს ({tenant}) ქირა {days} დღით აქვს დაგვიანებული, დავალიანება {amount} {currency}. შეღავათიანი ვადა ამოიწურა: ხელშეკრულების პირობებით შეგიძლია მოითხოვო დავალიანების დაფარვა ან ხელშეკრულების შეწყვეტა.",
};

const en: Record<TemplateKey, string> = {
  geo_approach_driver:
    "You are approaching the agreed red lines. If you cross them, the owner has the right to pass the vehicle's plate to 112.",
  geo_approach_owner:
    "Your vehicle, plate {plate}, is approaching the red lines — contact the driver.",
  geo_breach_driver:
    "The owner may have passed the vehicle's plate to 112 on a suspected-theft report. Return inside the red lines set out in the contract immediately.",
  geo_breach_owner:
    "Your vehicle, state plate {plate}, has crossed the red lines. Contact the driver or report it to 112.",
  pay_due_driver:
    "Reminder: {asset} — {amount} {currency} is due on {date}. Thank you.",
  pay_overdue_driver:
    "{asset} — your payment is {days} day(s) late. The contract allows {grace} days. Please settle {amount} {currency} before that runs out.",
  pay_repossess_driver:
    "{asset} — your payment is {days} day(s) late and the {grace}-day window in the contract has run out. The owner is now entitled to require the vehicle back. Contact the owner immediately.",
  pay_repossess_owner:
    "{asset} ({plate}) — {driver} is {days} day(s) late, {amount} {currency} outstanding. Under the contract you are now entitled to require the vehicle back.",
  lease_due_tenant:
    "Reminder: {asset} — rent of {amount} {currency} is due on {date}. Thank you.",
  lease_overdue_tenant:
    "{asset} — your rent is {days} day(s) late. The lease allows {grace} days. Please pay {amount} {currency} within that time.",
  lease_late_tenant:
    "{asset} — your rent is {days} day(s) late and the {grace}-day window in the lease has run out. Outstanding: {amount} {currency}. Please contact the landlord immediately — under the lease, the landlord may demand payment or ask to end the tenancy.",
  lease_late_owner:
    "{asset} — the tenant ({tenant}) is {days} day(s) late with the rent, {amount} {currency} outstanding. The grace period has run out: under the lease you may demand payment or start ending the tenancy.",
};

export const DEFAULT_TEMPLATES: Record<Locale, Record<TemplateKey, string>> = {
  en,
  ka,
};

export function defaultTemplate(locale: Locale, key: TemplateKey): string {
  return (DEFAULT_TEMPLATES[locale] ?? en)[key];
}

/** Substitute {placeholders}; unknown ones are left untouched, not blanked. */
export function render(body: string, vars: TemplateVars): string {
  return body.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name as keyof TemplateVars];
    return value == null || value === "" ? match : value;
  });
}
