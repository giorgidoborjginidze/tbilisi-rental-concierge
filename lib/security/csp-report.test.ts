import { describe, expect, it } from "vitest";
import { cspReportEntries, MAX_REPORTS_PER_REQUEST, stripUrl } from "./csp-report";

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
