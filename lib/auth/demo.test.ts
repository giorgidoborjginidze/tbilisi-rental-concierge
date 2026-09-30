import { describe, expect, it } from "vitest";
import { demoRefusalPath } from "./demo";

describe("demoRefusalPath", () => {
  it("sends the visitor back to the page they were on, flagged", () => {
    expect(demoRefusalPath("https://activo.world/assets/abc/rental?tab=gps", "activo.world")).toBe(
      "/assets/abc/rental?tab=gps&demo=readonly",
    );
  });

  it("never follows a Referer from another host", () => {
    expect(demoRefusalPath("https://evil.example/phish", "activo.world")).toBe("/?demo=readonly");
    expect(demoRefusalPath("https://activo.world.evil.example/x", "activo.world")).toBe("/?demo=readonly");
  });

  it("falls back to the dashboard without a usable Referer", () => {
    expect(demoRefusalPath(null, "activo.world")).toBe("/?demo=readonly");
    expect(demoRefusalPath("not a url", "activo.world")).toBe("/?demo=readonly");
    expect(demoRefusalPath("https://activo.world/x", null)).toBe("/?demo=readonly");
  });

  it("does not repeat the flag", () => {
    expect(demoRefusalPath("http://localhost:3000/units?demo=readonly", "localhost:3000")).toBe(
      "/units?demo=readonly",
    );
  });
});
