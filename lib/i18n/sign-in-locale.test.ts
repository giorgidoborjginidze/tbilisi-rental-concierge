import { describe, expect, it } from "vitest";
import { signInLocale } from "./sign-in-locale";

const chosen = new Date("2026-09-01T10:00:00Z");

describe("signInLocale", () => {
  it("never lets a device cookie change a language the owner already chose", () => {
    // Someone viewed the landing page in English on this device.
    expect(signInLocale({ isDemo: false, locale: "ka", localeSetAt: chosen }, "en")).toEqual({
      save: null,
      cookie: "ka",
    });
    expect(signInLocale({ isDemo: false, locale: "en", localeSetAt: chosen }, "ka")).toEqual({
      save: null,
      cookie: "en",
    });
  });

  it("keeps a matching cookie as it is", () => {
    expect(signInLocale({ isDemo: false, locale: "ka", localeSetAt: chosen }, "ka")).toEqual({
      save: null,
      cookie: null,
    });
  });

  it("takes the device's language when the account never had one chosen", () => {
    expect(signInLocale({ isDemo: false, locale: "ka", localeSetAt: null }, "en")).toEqual({
      save: "en",
      cookie: null,
    });
  });

  it("opens a device without a cookie in the account's language", () => {
    expect(signInLocale({ isDemo: false, locale: "en", localeSetAt: null }, null)).toEqual({
      save: null,
      cookie: "en",
    });
    expect(signInLocale({ isDemo: false, locale: "en", localeSetAt: chosen }, null)).toEqual({
      save: null,
      cookie: "en",
    });
  });

  it("never writes the shared demo's language", () => {
    expect(signInLocale({ isDemo: true, locale: "ka", localeSetAt: chosen }, "en")).toEqual({
      save: null,
      cookie: null,
    });
    expect(signInLocale({ isDemo: true, locale: "ka", localeSetAt: null }, null)).toEqual({
      save: null,
      cookie: "ka",
    });
  });
});
