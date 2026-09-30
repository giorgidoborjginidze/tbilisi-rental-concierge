// Fetching an iCal feed the owner pasted — without letting that URL reach
// anything but the public internet.
//
// A feed URL is whatever someone typed, and the server fetches it. Without
// care that is a way to make our server call localhost, the cloud metadata
// address or a private network and learn from the answer what is there
// (SSRF). So:
//
//   * https only, no user:password@, the default port only;
//   * the host is resolved and EVERY address must be public — loopback,
//     private, link-local, carrier-grade NAT, multicast and reserved ranges
//     are refused. The check runs inside the socket's own DNS lookup, so the
//     address checked is the address connected to (no DNS-rebinding gap);
//   * redirects are followed by hand (at most 3), each one checked again;
//   * the body is capped (5 MB) and must be a VCALENDAR;
//   * the owner sees a short code ("gone", "timeout"…), never the raw error.
//
// Server only (node:https, node:dns).

import { normalizeFeedUrl } from "./sync";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import type { IncomingMessage } from "node:http";
import zlib from "node:zlib";

export type FeedError =
  | "invalid_url" // not an https URL we accept
  | "blocked_host" // resolves to a private / loopback / link-local address
  | "unreachable" // DNS failure, refused connection, TLS error
  | "timeout"
  | "gone" // 404 / 410: the link no longer exists (e.g. re-generated)
  | "denied" // 401 / 403
  | "http" // any other non-2xx answer
  | "too_many_redirects"
  | "too_large"
  | "not_ical"; // answered, but not with a calendar (e.g. a login page)

export const FEED_ERRORS: FeedError[] = [
  "invalid_url",
  "blocked_host",
  "unreachable",
  "timeout",
  "gone",
  "denied",
  "http",
  "too_many_redirects",
  "too_large",
  "not_ical",
];

export class FeedFetchError extends Error {
  constructor(
    public readonly code: FeedError,
    public readonly status?: number,
  ) {
    super(status ? `${code} (${status})` : code);
    this.name = "FeedFetchError";
  }
}

export const MAX_FEED_BYTES = 5 * 1024 * 1024;
export const MAX_REDIRECTS = 3;
export const FEED_TIMEOUT_MS = 15_000;

// ── Which addresses are public ─────────────────────────────────────────────

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local (cloud metadata lives here)
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.88.99.0", 24], // 6to4 relay
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["64:ff9b::", 96], // NAT64 — embeds an IPv4 address
  ["100::", 64], // discard
  ["2001::", 23], // IETF special purpose (Teredo, ORCHID…)
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4 — embeds an IPv4 address
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // old site-local
  ["ff00::", 8], // multicast
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

// IPv4-mapped IPv6 addresses (::ffff:127.0.0.1, ::ffff:7f00:1) need no
// rule of their own: BlockList matches them against the IPv4 rules above.

/** Is this IP address on the public internet? Anything unparseable is not. */
export function isPublicAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, "").split("%")[0];
  const family = isIP(bare);
  if (family === 4) return !blocked.check(bare, "ipv4");
  if (family === 6) return !blocked.check(bare, "ipv6");
  return false;
}

// ── Which URLs are accepted ────────────────────────────────────────────────

/**
 * Check a feed URL's shape (no network): https, a host name or public IP,
 * no credentials, the default port. Returns the parsed URL or an error.
 */
export function checkFeedUrl(raw: string): { url: URL } | { error: FeedError } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { error: "invalid_url" };
  }
  if (url.protocol !== "https:") return { error: "invalid_url" };
  if (url.username || url.password) return { error: "invalid_url" };
  if (url.port !== "" && url.port !== "443") return { error: "invalid_url" };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host) return { error: "invalid_url" };
  if (isIP(host)) {
    if (!isPublicAddress(host)) return { error: "blocked_host" };
  } else {
    const lower = host.toLowerCase();
    // Names that never leave the machine or the private network.
    if (
      !lower.includes(".") ||
      lower === "localhost" ||
      lower.endsWith(".localhost") ||
      lower.endsWith(".local") ||
      lower.endsWith(".internal") ||
      lower.endsWith(".lan") ||
      lower.endsWith(".home.arpa")
    ) {
      return { error: "blocked_host" };
    }
  }
  return { url };
}

// ── The fetch itself ───────────────────────────────────────────────────────

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

export type LookupFn = (
  hostname: string,
  options: { all: true },
  callback: (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
) => void;

/**
 * A DNS lookup for the socket that refuses the connection unless every
 * address the name resolves to is public. Node calls it right before it
 * connects, so the address checked is the one used.
 */
export function guardedLookup(resolve: LookupFn = dnsLookup as unknown as LookupFn) {
  return (
    hostname: string,
    options: { all?: boolean; family?: number } | number | undefined,
    callback: LookupCallback,
  ) => {
    const wantAll = typeof options === "object" && options?.all === true;
    resolve(hostname, { all: true }, (error, addresses) => {
      if (error) return callback(error, wantAll ? [] : "");
      if (!addresses.length || addresses.some((entry) => !isPublicAddress(entry.address))) {
        const refused = Object.assign(new Error("blocked_host"), { code: "EBLOCKEDHOST" });
        return callback(refused as NodeJS.ErrnoException, wantAll ? [] : "");
      }
      if (wantAll) return callback(null, addresses);
      callback(null, addresses[0].address, addresses[0].family);
    });
  };
}

/** The slice of https.request the fetcher needs (tests pass a fake). */
export type RequestFn = (
  options: https.RequestOptions,
  onResponse: (response: IncomingMessage) => void,
) => {
  on(event: "error", listener: (error: Error) => void): unknown;
  end(): unknown;
  destroy(error?: Error): unknown;
};

export interface FetchFeedDeps {
  request?: RequestFn;
  resolve?: LookupFn;
  timeoutMs?: number;
  maxBytes?: number;
}

interface RawResponse {
  status: number;
  location: string | null;
  body: string;
}

function decoder(response: IncomingMessage) {
  const encoding = String(response.headers["content-encoding"] ?? "").toLowerCase();
  if (encoding === "gzip" || encoding === "x-gzip") return response.pipe(zlib.createGunzip());
  if (encoding === "deflate") return response.pipe(zlib.createInflate());
  if (encoding === "br") return response.pipe(zlib.createBrotliDecompress());
  return response;
}

function requestOnce(url: URL, deps: Required<FetchFeedDeps>): Promise<RawResponse> {
  return new Promise((resolvePromise, reject) => {
    let settled = false;
    // Filled in below; `fail` may run before either exists.
    const live: { timer?: ReturnType<typeof setTimeout>; req?: ReturnType<RequestFn> } = {};
    const fail = (error: FeedFetchError) => {
      if (settled) return;
      settled = true;
      clearTimeout(live.timer);
      live.req?.destroy();
      reject(error);
    };
    const host = url.hostname.replace(/^\[|\]$/g, "");
    const req = deps.request(
      {
        protocol: "https:",
        hostname: host,
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: {
          "User-Agent": "Activo-iCal/1.0 (+https://activo.world)",
          Accept: "text/calendar, text/plain;q=0.9, */*;q=0.5",
          "Accept-Encoding": "gzip, deflate, br",
        },
        lookup: guardedLookup(deps.resolve) as unknown as https.RequestOptions["lookup"],
      },
      (response) => {
        const status = response.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          settled = true;
          clearTimeout(live.timer);
          response.resume();
          const location = response.headers.location;
          resolvePromise({ status, location: location ? String(location) : null, body: "" });
          return;
        }
        const declared = Number(response.headers["content-length"] ?? 0);
        if (declared > deps.maxBytes) {
          response.resume();
          return fail(new FeedFetchError("too_large"));
        }
        if (status < 200 || status >= 300) {
          response.resume();
          const code: FeedError =
            status === 404 || status === 410 ? "gone" : status === 401 || status === 403 ? "denied" : "http";
          return fail(new FeedFetchError(code, status));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        const stream = decoder(response);
        stream.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > deps.maxBytes) {
            fail(new FeedFetchError("too_large"));
            stream.destroy();
            return;
          }
          chunks.push(chunk);
        });
        stream.on("error", () => fail(new FeedFetchError("unreachable")));
        stream.on("end", () => {
          if (settled) return;
          settled = true;
          clearTimeout(live.timer);
          resolvePromise({ status, location: null, body: Buffer.concat(chunks).toString("utf8") });
        });
      },
    );
    live.req = req;
    live.timer = setTimeout(() => fail(new FeedFetchError("timeout")), deps.timeoutMs);
    req.on("error", (error: Error & { code?: string }) => {
      fail(
        new FeedFetchError(
          error.code === "EBLOCKEDHOST" || error.message === "blocked_host" ? "blocked_host" : "unreachable",
        ),
      );
    });
    req.end();
  });
}

/**
 * Fetch a feed's text through the guard. Throws FeedFetchError with a code
 * the owner can be shown; never the raw network error or the URL.
 */
export async function fetchFeed(raw: string, deps: FetchFeedDeps = {}): Promise<string> {
  const settings: Required<FetchFeedDeps> = {
    request: deps.request ?? (https.request as unknown as RequestFn),
    resolve: deps.resolve ?? (dnsLookup as unknown as LookupFn),
    timeoutMs: deps.timeoutMs ?? FEED_TIMEOUT_MS,
    maxBytes: deps.maxBytes ?? MAX_FEED_BYTES,
  };
  let current = normalizeFeedUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const checked = checkFeedUrl(current);
    if ("error" in checked) throw new FeedFetchError(checked.error);
    const response = await requestOnce(checked.url, settings);
    if (response.status >= 300 && response.status < 400) {
      if (!response.location) throw new FeedFetchError("http", response.status);
      // Relative redirects resolve against the current address; the next
      // hop is checked like the first.
      try {
        current = new URL(response.location, checked.url).toString();
      } catch {
        throw new FeedFetchError("invalid_url");
      }
      continue;
    }
    if (!/BEGIN:VCALENDAR/i.test(response.body)) throw new FeedFetchError("not_ical");
    return response.body;
  }
  throw new FeedFetchError("too_many_redirects");
}

/** The code to store and show for any error a sync hit. */
export function feedErrorOf(error: unknown): { code: FeedError; status: number | null } {
  if (error instanceof FeedFetchError) return { code: error.code, status: error.status ?? null };
  return { code: "unreachable", status: null };
}
