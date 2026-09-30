import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { gzipSync } from "node:zlib";
import type { IncomingMessage } from "node:http";
import type { RequestOptions } from "node:https";
import type { LookupAddress } from "node:dns";
import { describe, expect, it } from "vitest";
import {
  checkFeedUrl,
  FeedFetchError,
  fetchFeed,
  guardedLookup,
  isPublicAddress,
  type LookupFn,
  type RequestFn,
} from "./fetch";

const ICAL = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n";

describe("isPublicAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // cloud metadata
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::a00:1",
    "2002:7f00:1::",
    "not-an-ip",
  ])("refuses %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["54.230.10.20", "104.16.1.1", "8.8.8.8", "2606:4700::1111", "2a03:2880:f10c::1"])(
    "accepts %s",
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );
});

describe("checkFeedUrl", () => {
  it("accepts ordinary channel feeds", () => {
    expect("url" in checkFeedUrl("https://www.airbnb.com/calendar/ical/1234.ics?s=abc")).toBe(true);
    expect("url" in checkFeedUrl("https://ical.booking.com/v1/export?t=xyz")).toBe(true);
    expect("url" in checkFeedUrl("  https://pms.example.com:443/feed.ics  ")).toBe(true);
  });

  it.each([
    ["http://www.airbnb.com/calendar/ical/1.ics", "invalid_url"],
    ["ftp://example.com/feed.ics", "invalid_url"],
    ["file:///etc/passwd", "invalid_url"],
    ["https://user:pass@example.com/feed.ics", "invalid_url"],
    ["https://example.com:8443/feed.ics", "invalid_url"],
    ["not a url", "invalid_url"],
    ["https://localhost/feed.ics", "blocked_host"],
    ["https://metadata.google.internal/computeMetadata", "blocked_host"],
    ["https://printer.local/feed.ics", "blocked_host"],
    ["https://intranet/feed.ics", "blocked_host"],
    ["https://127.0.0.1/feed.ics", "blocked_host"],
    ["https://169.254.169.254/latest/meta-data", "blocked_host"],
    ["https://[::1]/feed.ics", "blocked_host"],
    ["https://2130706433/feed.ics", "blocked_host"], // 127.0.0.1 as one number
  ])("refuses %s", (url, error) => {
    expect(checkFeedUrl(url)).toEqual({ error });
  });
});

// ── A fake https.request: it runs the socket's lookup like Node does, then
//    answers from a script of responses keyed by host + path. ──
type Scripted = { status: number; headers?: Record<string, string>; body?: string | Buffer };

function fakeNetwork(dns: Record<string, string[]>, responses: Record<string, Scripted>) {
  const resolve: LookupFn = (hostname, _options, callback) => {
    const addresses = dns[hostname];
    if (!addresses) {
      callback(Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" }), []);
      return;
    }
    callback(
      null,
      addresses.map((address): LookupAddress => ({ address, family: address.includes(":") ? 6 : 4 })),
    );
  };
  const requested: string[] = [];
  const request: RequestFn = (options: RequestOptions, onResponse) => {
    const req = new EventEmitter() as EventEmitter & { end(): void; destroy(): void };
    req.destroy = () => undefined;
    req.end = () => {
      const lookup = options.lookup as unknown as (
        host: string,
        opts: { all: true },
        cb: (error: Error | null, addresses: LookupAddress[]) => void,
      ) => void;
      lookup(String(options.hostname), { all: true }, (error) => {
        if (error) {
          req.emit("error", error);
          return;
        }
        const key = `${options.hostname}${options.path}`;
        requested.push(key);
        const scripted = responses[key] ?? { status: 404 };
        const response = Readable.from(
          scripted.body === undefined ? [] : [Buffer.from(scripted.body)],
        ) as unknown as IncomingMessage;
        response.statusCode = scripted.status;
        response.headers = scripted.headers ?? {};
        onResponse(response);
      });
    };
    return req;
  };
  return { request, resolve, requested };
}

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "ok";
  } catch (error) {
    return error instanceof FeedFetchError ? error.code : `unexpected: ${String(error)}`;
  }
};

describe("fetchFeed", () => {
  const dns = {
    "feeds.example.com": ["93.184.216.34"],
    "evil.example.com": ["127.0.0.1"],
    "mixed.example.com": ["93.184.216.34", "10.0.0.5"],
    "meta.example.com": ["169.254.169.254"],
  };

  it("returns a calendar from a public host", async () => {
    const net = fakeNetwork(dns, { "feeds.example.com/cal.ics": { status: 200, body: ICAL } });
    await expect(fetchFeed("https://feeds.example.com/cal.ics", net)).resolves.toBe(ICAL);
  });

  it("decompresses a gzip answer", async () => {
    const net = fakeNetwork(dns, {
      "feeds.example.com/cal.ics": {
        status: 200,
        headers: { "content-encoding": "gzip" },
        body: gzipSync(ICAL),
      },
    });
    await expect(fetchFeed("https://feeds.example.com/cal.ics", net)).resolves.toBe(ICAL);
  });

  it("refuses a name that resolves to a private or loopback address", async () => {
    const net = fakeNetwork(dns, {});
    expect(await codeOf(fetchFeed("https://evil.example.com/x.ics", net))).toBe("blocked_host");
    expect(await codeOf(fetchFeed("https://mixed.example.com/x.ics", net))).toBe("blocked_host");
    expect(await codeOf(fetchFeed("https://meta.example.com/x.ics", net))).toBe("blocked_host");
    expect(net.requested).toEqual([]);
  });

  it("checks every redirect again", async () => {
    const toPrivate = fakeNetwork(dns, {
      "feeds.example.com/cal.ics": { status: 302, headers: { location: "https://evil.example.com/admin" } },
    });
    expect(await codeOf(fetchFeed("https://feeds.example.com/cal.ics", toPrivate))).toBe("blocked_host");

    const toHttp = fakeNetwork(dns, {
      "feeds.example.com/cal.ics": { status: 301, headers: { location: "http://feeds.example.com/cal.ics" } },
    });
    expect(await codeOf(fetchFeed("https://feeds.example.com/cal.ics", toHttp))).toBe("invalid_url");

    const relative = fakeNetwork(dns, {
      "feeds.example.com/old.ics": { status: 308, headers: { location: "/new.ics" } },
      "feeds.example.com/new.ics": { status: 200, body: ICAL },
    });
    await expect(fetchFeed("https://feeds.example.com/old.ics", relative)).resolves.toBe(ICAL);
  });

  it("stops after three redirects", async () => {
    const loop = fakeNetwork(dns, {
      "feeds.example.com/a": { status: 302, headers: { location: "/b" } },
      "feeds.example.com/b": { status: 302, headers: { location: "/a" } },
    });
    expect(await codeOf(fetchFeed("https://feeds.example.com/a", loop))).toBe("too_many_redirects");
    expect(loop.requested).toHaveLength(4);
  });

  it("caps the size, declared or streamed", async () => {
    const declared = fakeNetwork(dns, {
      "feeds.example.com/big.ics": { status: 200, headers: { "content-length": "999999999" }, body: ICAL },
    });
    expect(await codeOf(fetchFeed("https://feeds.example.com/big.ics", declared))).toBe("too_large");
    const streamed = fakeNetwork(dns, {
      "feeds.example.com/big.ics": { status: 200, body: `${ICAL}${"X".repeat(2000)}` },
    });
    expect(
      await codeOf(fetchFeed("https://feeds.example.com/big.ics", { ...streamed, maxBytes: 1000 })),
    ).toBe("too_large");
  });

  it("names what went wrong in a short code, never the raw error", async () => {
    const net = fakeNetwork(dns, {
      "feeds.example.com/gone.ics": { status: 404 },
      "feeds.example.com/denied.ics": { status: 403 },
      "feeds.example.com/broken.ics": { status: 500 },
      "feeds.example.com/login.ics": { status: 200, body: "<html>Please log in</html>" },
    });
    expect(await codeOf(fetchFeed("https://feeds.example.com/gone.ics", net))).toBe("gone");
    expect(await codeOf(fetchFeed("https://feeds.example.com/denied.ics", net))).toBe("denied");
    expect(await codeOf(fetchFeed("https://feeds.example.com/broken.ics", net))).toBe("http");
    expect(await codeOf(fetchFeed("https://feeds.example.com/login.ics", net))).toBe("not_ical");
    expect(await codeOf(fetchFeed("https://nowhere.example.com/x.ics", net))).toBe("unreachable");
    const error = await fetchFeed("https://feeds.example.com/gone.ics", net).catch((e) => e);
    expect(error.status).toBe(404);
    expect(String(error.message)).not.toContain("feeds.example.com");
  });

  it("times out", async () => {
    const hang: RequestFn = () => {
      const req = new EventEmitter() as EventEmitter & { end(): void; destroy(): void };
      req.end = () => undefined;
      req.destroy = () => undefined;
      return req;
    };
    expect(
      await codeOf(fetchFeed("https://feeds.example.com/cal.ics", { request: hang, timeoutMs: 20 })),
    ).toBe("timeout");
  });
});

describe("guardedLookup", () => {
  it("answers in both shapes Node asks for", async () => {
    const resolve: LookupFn = (_h, _o, cb) => cb(null, [{ address: "93.184.216.34", family: 4 }]);
    const lookup = guardedLookup(resolve);
    const single = await new Promise((done) =>
      lookup("x.example.com", {}, (error, address, family) => done({ error, address, family })),
    );
    expect(single).toEqual({ error: null, address: "93.184.216.34", family: 4 });
    const all = await new Promise((done) =>
      lookup("x.example.com", { all: true }, (error, addresses) => done({ error, addresses })),
    );
    expect(all).toEqual({ error: null, addresses: [{ address: "93.184.216.34", family: 4 }] });
  });
});
