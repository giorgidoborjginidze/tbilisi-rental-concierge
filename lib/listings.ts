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

/**
 * The link as a web address: https:// added when no scheme was typed;
 * null for anything that is not http(s) — a "javascript://myhome.ge/…"
 * would otherwise pass as a myhome.ge link (its host parses as myhome.ge)
 * and run when opened.
 */
function asWebUrl(url: string): URL | null {
  const raw = url.trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) && raw.includes("://") ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withScheme);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed : null;
  } catch {
    return null;
  }
}

/** Detects a listing platform from a URL, or null if unrecognized. */
export function detectPlatform(url: string): PlatformDef | null {
  const parsed = asWebUrl(url);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  return (
    PLATFORMS.find((p) =>
      p.hosts.some((h) => host === h || host.endsWith(`.${h}`)),
    ) ?? null
  );
}

/**
 * What a listing column may store: the link as a full web address, and only
 * when it is that column's own platform. Anything else is dropped (null).
 */
export function listingUrlFor(field: PlatformDef["field"], url: string | null | undefined): string | null {
  if (!url) return null;
  const parsed = asWebUrl(url);
  return parsed && detectPlatform(url)?.field === field ? parsed.toString() : null;
}

/** Only a web address may be opened from a stored link (older rows included). */
export const isWebUrl = (url: string): boolean => /^https?:\/\//i.test(url.trim());
