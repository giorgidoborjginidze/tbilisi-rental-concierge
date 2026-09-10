// The iCal URLs are typed in by operators, and the server fetches them.
// That makes the sync a request forwarder: whatever an operator writes,
// our host asks for, from inside our network. On a cloud host that reaches
// the instance metadata service (169.254.169.254) and anything else on the
// private side of the firewall.
//
// So the sync only follows URLs that lead outward: https (http in local
// development), a real hostname, and an address that is not loopback, not
// link-local and not in a private range.
//
// Pure string and arithmetic work — no DNS, no network, fully testable.

export type UrlVerdict = { ok: true; url: URL } | { ok: false; reason: string };

const PRIVATE_V4: [string, number][] = [
  ["10.0.0.0", 8],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, incl. cloud metadata
  ["100.64.0.0", 10], // carrier-grade NAT
  ["192.0.0.0", 24],
  ["192.0.2.0", 24], // documentation
  ["198.18.0.0", 15], // benchmarking
  ["0.0.0.0", 8],
];

const toInt = (ip: string): number | null => {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
};

/** Is this literal IPv4 address inside a range we must not reach? */
export function isPrivateIpv4(ip: string): boolean {
  const value = toInt(ip);
  if (value == null) return false;
  return PRIVATE_V4.some(([base, bits]) => {
    const baseValue = toInt(base);
    if (baseValue == null) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (value & mask) === (baseValue & mask);
  });
}

/** IPv6 loopback, unique-local (fc00::/7) and link-local (fe80::/10). */
export function isPrivateIpv6(host: string): boolean {
  const ip = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (ip === "::1" || ip === "::") return true;
  // IPv4-mapped (::ffff:10.0.0.1) inherits the v4 verdict.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (mapped) return isPrivateIpv4(mapped[1]);
  const head = ip.split(":")[0];
  if (!head) return false;
  const first = parseInt(head.padEnd(4, "0").slice(0, 4), 16);
  if (Number.isNaN(first)) return false;
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10
  return false;
}

const LOCAL_NAMES = new Set(["localhost", "localhost.localdomain", "ip6-localhost"]);

/**
 * Decide whether the sync may fetch this URL.
 *
 * `allowInsecure` exists for local development, where the whole point is a
 * feed served from your own machine; in production it is off and only
 * https is followed.
 */
export function checkFeedUrl(
  raw: string,
  { allowInsecure = process.env.NODE_ENV !== "production" } = {},
): UrlVerdict {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "not a URL" };
  }

  const scheme = url.protocol.toLowerCase();
  if (scheme !== "https:" && !(allowInsecure && scheme === "http:")) {
    return { ok: false, reason: `scheme ${url.protocol} not allowed` };
  }

  const host = url.hostname.toLowerCase();
  if (!host) return { ok: false, reason: "no host" };
  if (!allowInsecure) {
    if (LOCAL_NAMES.has(host) || host.endsWith(".localhost")) {
      return { ok: false, reason: "local host name" };
    }
    // A bare name with no dot is an internal host by definition.
    if (!host.includes(".") && !host.includes(":")) {
      return { ok: false, reason: "non-public host name" };
    }
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && isPrivateIpv4(host)) {
    return { ok: false, reason: "private address" };
  }
  if (host.includes(":") && isPrivateIpv6(host)) {
    return { ok: false, reason: "private address" };
  }
  // Credentials in the URL would be sent onward by the fetcher and end up
  // in the per-feed error text.
  if (url.username || url.password) {
    return { ok: false, reason: "credentials in URL" };
  }

  return { ok: true, url };
}
