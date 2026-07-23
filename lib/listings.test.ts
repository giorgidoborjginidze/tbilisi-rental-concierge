import { describe, it, expect } from "vitest";
import { detectPlatform } from "./listings";

describe("detectPlatform", () => {
  it("detects each supported platform, ignoring www and scheme", () => {
    expect(detectPlatform("https://www.myhome.ge/pr/123")?.key).toBe("myhome");
    expect(detectPlatform("https://home.ss.ge/en/flat/456")?.key).toBe("ss");
    expect(detectPlatform("myauto.ge/ka/pr/789")?.key).toBe("myauto");
    expect(detectPlatform("https://www.airbnb.com/rooms/111")?.key).toBe("airbnb");
    expect(detectPlatform("https://www.booking.com/hotel/ge/x.html")?.key).toBe("booking");
  });

  it("maps a platform to its Asset column", () => {
    expect(detectPlatform("https://myhome.ge/pr/1")?.field).toBe("myhomeUrl");
    expect(detectPlatform("https://myauto.ge/pr/1")?.field).toBe("myautoUrl");
  });

  it("returns null for unknown or empty input", () => {
    expect(detectPlatform("https://example.com/x")).toBeNull();
    expect(detectPlatform("not a url")).toBeNull();
    expect(detectPlatform("")).toBeNull();
  });
});
