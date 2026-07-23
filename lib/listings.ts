// Listing platforms and URL → platform detection. Framework-free so both
// the client form (live preview) and server can use it.
//
// A single pasted listing URL is matched to its platform by hostname; the
// form then stores it in that platform's Asset column (myhomeUrl, etc.),
// so no schema change is needed for the one-field UX.

export type PlatformKey = "myhome" | "ss" | "myauto" | "airbnb" | "booking";

export interface PlatformDef {
  key: PlatformKey;
  label: string;
  /** Asset column this platform's URL is stored in. */
  field: "myhomeUrl" | "ssUrl" | "myautoUrl" | "airbnbUrl" | "bookingUrl";
  /** Hostnames (without www) that identify this platform. */
  hosts: string[];
}

export const PLATFORMS: PlatformDef[] = [
  { key: "myhome", label: "myhome.ge", field: "myhomeUrl", hosts: ["myhome.ge"] },
  { key: "ss", label: "ss.ge", field: "ssUrl", hosts: ["ss.ge"] },
  { key: "myauto", label: "myauto.ge", field: "myautoUrl", hosts: ["myauto.ge"] },
  { key: "airbnb", label: "Airbnb", field: "airbnbUrl", hosts: ["airbnb.com", "airbnb.co.uk"] },
  { key: "booking", label: "Booking.com", field: "bookingUrl", hosts: ["booking.com"] },
];

/** All Asset columns that hold a listing URL. */
export const LISTING_FIELDS = PLATFORMS.map((p) => p.field);

/** Detects a listing platform from a URL, or null if unrecognized. */
export function detectPlatform(url: string): PlatformDef | null {
  const raw = url.trim();
  if (!raw) return null;
  let host: string;
  try {
    host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "");
  return (
    PLATFORMS.find((p) =>
      p.hosts.some((h) => host === h || host.endsWith(`.${h}`)),
    ) ?? null
  );
}
