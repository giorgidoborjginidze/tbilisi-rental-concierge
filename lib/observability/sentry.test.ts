import { describe, expect, it } from "vitest";
import { scrubUrl } from "./sentry";

describe("scrubUrl", () => {
  it("hides every link that is its own key", () => {
    expect(scrubUrl("https://activo.world/reset/abc123?x=1")).toBe("https://activo.world/reset/[token]");
    expect(scrubUrl("/verify/abc123")).toBe("/verify/[token]");
    expect(scrubUrl("/i/abc123")).toBe("/i/[token]");
    expect(scrubUrl("/api/ical/abc123.ics")).toBe("/api/ical/[token]");
  });
  it("leaves ordinary paths and drops queries", () => {
    expect(scrubUrl("/assets/a1/edit?tab=gps#x")).toBe("/assets/a1/edit");
    expect(scrubUrl("/invoices/inv1")).toBe("/invoices/inv1");
  });
});
