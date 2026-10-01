import { afterEach, describe, expect, it, vi } from "vitest";
import { shownOrigin } from "./site";

const hdrs = (map: Record<string, string>) => ({ get: (name: string) => map[name] ?? null });

describe("shownOrigin", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the configured site URL when there is one", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://activo.world/");
    expect(shownOrigin(hdrs({ host: "evil.example" }))).toBe("https://activo.world");
  });

  it("without one, the host the owner's browser used — never localhost:3000", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(shownOrigin(hdrs({ host: "rent.example.ge", "x-forwarded-proto": "https" }))).toBe(
      "https://rent.example.ge",
    );
    expect(shownOrigin(hdrs({ host: "localhost:3300" }))).toBe("http://localhost:3300");
  });

  it("ignores a malformed host", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(shownOrigin(hdrs({ host: "a b/c" }))).toBe("http://localhost:3000");
  });
});
