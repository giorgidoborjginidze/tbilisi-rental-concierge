import { describe, it, expect } from "vitest";
import { detectPlatform, isWebUrl, listingUrlFor } from "./listings";

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

describe("detectPlatform refuses anything but a web address", () => {
  // A stored listing link is opened with window.open when the owner flips
  // an asset's status: it must never be a script URL dressed up as a
  // platform host.
  it.each([
    "javascript://myhome.ge/%0aalert(1)",
    "JavaScript://booking.com/%0aalert(1)",
    "data://airbnb.com/x",
    "vbscript://ss.ge/x",
    "file://myauto.ge/etc/passwd",
  ])("refuses %s", (url) => {
    expect(detectPlatform(url)).toBeNull();
  });
});

describe("listingUrlFor", () => {
  it("stores a platform's own link as a full web address", () => {
    expect(listingUrlFor("myhomeUrl", "myhome.ge/ka/pr/123")).toBe("https://myhome.ge/ka/pr/123");
    expect(listingUrlFor("bookingUrl", "https://www.booking.com/hotel/ge/x.html")).toBe("https://www.booking.com/hotel/ge/x.html");
  });

  it("drops anything else", () => {
    expect(listingUrlFor("myhomeUrl", "javascript://myhome.ge/%0aalert(1)")).toBeNull();
    expect(listingUrlFor("myhomeUrl", "https://www.booking.com/hotel/ge/x.html")).toBeNull(); // another platform's column
    expect(listingUrlFor("airbnbUrl", "https://evil.example/airbnb.com")).toBeNull();
    expect(listingUrlFor("ssUrl", "")).toBeNull();
    expect(listingUrlFor("ssUrl", null)).toBeNull();
  });

  it("opens only web addresses", () => {
    expect(isWebUrl("https://myhome.ge/x")).toBe(true);
    expect(isWebUrl("javascript:alert(1)")).toBe(false);
    expect(isWebUrl("myhome.ge/x")).toBe(false);
  });
});
