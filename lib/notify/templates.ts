import type { Locale } from "@/lib/i18n/strings";

// Notification bodies for car rentals: the geofence warnings and the
// payment-schedule reminders.
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
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

/** Who a template is addressed to — decides which phone number is used. */
export const TEMPLATE_ROLE: Record<TemplateKey, "driver" | "owner"> = {
  geo_approach_driver: "driver",
  geo_approach_owner: "owner",
  geo_breach_driver: "driver",
  geo_breach_owner: "owner",
  pay_due_driver: "driver",
  pay_overdue_driver: "driver",
  pay_repossess_driver: "driver",
  pay_repossess_owner: "owner",
};

export interface TemplateVars {
  plate?: string;
  asset?: string;
  driver?: string;
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
