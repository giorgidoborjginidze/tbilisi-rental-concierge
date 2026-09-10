// The two pure helpers the audit trail is built on, kept apart from the
// database so they can be tested — and reused — without one.

import { createHash } from "node:crypto";

/**
 * Pseudonymous, stable reference to a person: the first 16 hex characters
 * of the SHA-256 of their (lower-cased) email. Two events by the same
 * person line up; the trail on its own names nobody.
 */
export function subjectRef(email: string): string {
  return createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

/**
 * Truncate a source address so it still shows an attack pattern but no
 * longer singles a household out: IPv4 keeps three octets, IPv6 its first
 * three groups. Anything unparseable is dropped rather than guessed at.
 */
export function truncateIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // x-forwarded-for is a list; the client is the first entry.
  const first = raw.split(",")[0]?.trim();
  if (!first) return null;
  if (first.includes(":")) {
    const groups = first.split(":").filter(Boolean).slice(0, 3);
    return groups.length ? `${groups.join(":")}::/48` : null;
  }
  const octets = first.split(".");
  if (octets.length !== 4) return null;
  for (const octet of octets) {
    if (!/^\d{1,3}$/.test(octet) || Number(octet) > 255) return null;
  }
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
}
