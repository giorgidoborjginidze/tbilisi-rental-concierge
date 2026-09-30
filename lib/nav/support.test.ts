import { describe, expect, it } from "vitest";
import { supportLauncherHidden } from "./support";

describe("supportLauncherHidden", () => {
  it("hides the floating support button on form pages", () => {
    for (const path of [
      "/assets/new",
      "/units/new",
      "/bookings/new",
      "/assets/abc123/edit",
      "/units/u1/edit",
      "/bookings/b1/edit/",
      "/settings",
      "/register",
      "/login",
      "/forgot",
      "/reset/token",
    ]) {
      expect(supportLauncherHidden(path), path).toBe(true);
    }
  });

  it("keeps it on reading pages", () => {
    for (const path of ["/", "/assets", "/calendar", "/alerts", "/assets/abc/rental", "/newsletter", "/invest", null]) {
      expect(supportLauncherHidden(path), String(path)).toBe(false);
    }
  });
});
