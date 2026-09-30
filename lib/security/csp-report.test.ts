import { describe, expect, it } from "vitest";
import {
  createReportLimiter,
  cspReportEntries,
  MAX_REPORTS_PER_REQUEST,
  readCapped,
  stripUrl,
} from "./csp-report";

describe("stripUrl", () => {
  it("drops the query string and fragment, and masks reset tokens", () => {
    expect(stripUrl("https://activo.world/alerts?view=done#x")).toBe("https://activo.world/alerts");
    expect(stripUrl("https://activo.world/reset/abc123?e=1")).toBe("https://activo.world/reset/[token]");
    expect(stripUrl("inline")).toBe("inline");
    expect(stripUrl("data:image/png;base64,AAAA")).toBe("data:");
    expect(stripUrl("")).toBeNull();
    expect(stripUrl(42)).toBeNull();
  });
});

describe("cspReportEntries", () => {
  it("reads the report-uri shape", () => {
    const [entry] = cspReportEntries({
      "csp-report": {
        "document-uri": "https://activo.world/billing?order=activo-1",
        "blocked-uri": "https://evil.example/x.js?token=secret",
        "violated-directive": "script-src-elem",
        disposition: "report",
        "line-number": 12,
      },
    });
    expect(entry).toMatchObject({
      event: "csp_violation",
      document: "https://activo.world/billing",
      blocked: "https://evil.example/x.js",
      directive: "script-src-elem",
      disposition: "report",
      line: 12,
    });
  });

  it("reads the Reporting API shape and ignores other report types", () => {
    const entries = cspReportEntries([
      { type: "deprecation", body: { id: "x" } },
      {
        type: "csp-violation",
        body: { documentURL: "https://activo.world/", blockedURL: "eval", effectiveDirective: "script-src" },
      },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ document: "https://activo.world/", blocked: "eval", directive: "script-src" });
  });

  it("caps the number of entries and ignores garbage", () => {
    const many = Array.from({ length: 50 }, () => ({ type: "csp-violation", body: { blockedURL: "inline" } }));
    expect(cspReportEntries(many)).toHaveLength(MAX_REPORTS_PER_REQUEST);
    expect(cspReportEntries(null)).toEqual([]);
    expect(cspReportEntries({ "csp-report": "x" })).toEqual([]);
    expect(cspReportEntries("hello")).toEqual([]);
  });
});

describe("readCapped", () => {
  const stream = (parts: string[]) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const part of parts) controller.enqueue(new TextEncoder().encode(part));
        controller.close();
      },
    });

  it("reads a body within the cap", async () => {
    expect(await readCapped(stream(["{\"a\":", "1}"]), 64)).toBe('{"a":1}');
    expect(await readCapped(null, 64)).toBe("");
  });

  it("stops as soon as the body passes the cap (no Content-Length needed)", async () => {
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(1024));
      },
    });
    expect(await readCapped(endless, 4 * 1024)).toBeNull();
    expect(pulled).toBeLessThan(10);
  });
});

describe("createReportLimiter", () => {
  it("lets an address log a few reports, then refuses until it refills", () => {
    const limiter = createReportLimiter(3, 6);
    const t0 = 1_000_000;
    expect([1, 2, 3, 4].map(() => limiter.take("1.2.3.4", t0))).toEqual([true, true, true, false]);
    // Another address has its own allowance.
    expect(limiter.take("5.6.7.8", t0)).toBe(true);
    // 6 a minute: one token back after 10 s.
    expect(limiter.take("1.2.3.4", t0 + 10_000)).toBe(true);
    expect(limiter.take("1.2.3.4", t0 + 10_000)).toBe(false);
  });

  it("forgets the longest-idle addresses beyond its size", () => {
    const limiter = createReportLimiter(1, 1, 2);
    expect(limiter.take("a", 0)).toBe(true);
    expect(limiter.take("b", 0)).toBe(true);
    expect(limiter.take("c", 0)).toBe(true); // "a" is dropped
    expect(limiter.take("a", 1)).toBe(true); // fresh bucket again
    expect(limiter.take("c", 1)).toBe(false);
  });
});
