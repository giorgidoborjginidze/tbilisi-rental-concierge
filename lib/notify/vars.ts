// The values a WhatsApp text is filled with — pure. Both monitors (rent
// and red lines) build them here, so every message says the same things
// the same way: the car or flat by the name the owner reads (its Georgian
// name in a Georgian message), who is writing and how to reach them, and
// dates written out in the message's language.

import { t, type Locale } from "@/lib/i18n/strings";
import { tbilisiFormat } from "@/lib/time";
import { normalizePhone } from "./phone";
import { MISSING, type TemplateVars } from "./templates";

export interface VarsAsset {
  name: string;
  nameKa?: string | null;
  plateNumber?: string | null;
}

export interface VarsOwner {
  name?: string | null;
  notifyPhone?: string | null;
}

/** "5 ოქტომბერი, 2026" / "5 October 2026" — a stored calendar day. */
export function messageDate(locale: Locale, day: Date): string {
  return tbilisiFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(day);
}

/** The asset as the message's reader should see it. */
export function messageAssetName(locale: Locale, asset: VarsAsset): string {
  return locale === "ka" && asset.nameKa?.trim() ? asset.nameKa.trim() : asset.name;
}

/** "+995599123456", or MISSING when the owner saved no number. */
export function ownerPhone(owner: VarsOwner): string {
  const phone = normalizePhone(owner.notifyPhone);
  return phone ? `+${phone}` : MISSING;
}

export function baseVars(locale: Locale, asset: VarsAsset, owner: VarsOwner, renterName?: string | null): TemplateVars {
  const renter = renterName?.trim() || MISSING;
  return {
    asset: messageAssetName(locale, asset),
    plate: asset.plateNumber?.trim() || MISSING,
    // {driver} is the renter's name — a driver for a car, a tenant for a flat.
    driver: renter,
    tenant: renter,
    owner: owner.name?.trim() || t(locale, "msg_owner_fallback"),
    owner_phone: ownerPhone(owner),
  };
}
