import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";
import { newSessionToken, SESSION_COOKIE } from "./session-token";

type Rewrite = { source: string; destination: string; has?: { type: string; key: string; value?: string }[] };

async function homeRewrite(): Promise<Rewrite> {
  const rewrites = (await nextConfig.rewrites!()) as { beforeFiles: Rewrite[] };
  const rule = rewrites.beforeFiles.find((r) => r.source === "/");
  if (!rule) throw new Error("no rewrite for /");
  return rule;
}

describe("signed-in Home rewrite (next.config.ts)", () => {
  it("serves a signed-in / from the dashboard segment, keyed on the real session cookie", async () => {
    const rule = await homeRewrite();
    expect(rule.destination).toBe("/dashboard");
    expect(rule.has).toHaveLength(1);
    expect(rule.has![0].type).toBe("cookie");
    expect(rule.has![0].key).toBe(SESSION_COOKIE);
  });

  it("matches the tokens sessions are created with — and not an emptied cookie", async () => {
    // Next anchors a has-value as ^value$.
    const pattern = new RegExp(`^${(await homeRewrite()).has![0].value}$`);
    for (let i = 0; i < 20; i += 1) expect(newSessionToken()).toMatch(pattern);
    expect("").not.toMatch(pattern);
    expect("not-a-token").not.toMatch(pattern);
  });

  it("sends a direct visit to /dashboard back to /", async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects).toContainEqual({ source: "/dashboard", destination: "/", permanent: false });
  });
});
