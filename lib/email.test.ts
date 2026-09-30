import { describe, expect, it, vi } from "vitest";
import { emailConfig, escapeHtml, sendEmail } from "./email";

describe("sendEmail (Resend)", () => {
  const cfg = { apiKey: "re_test", from: "Activo <no-reply@activo.world>" };

  it("posts one message to Resend with the key as a bearer token", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 }));
    const ok = await sendEmail({ to: "nino@example.com", subject: "Hi", text: "Body" }, cfg, fetcher as never);
    expect(ok).toBe(true);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(String(init.body))).toMatchObject({ from: cfg.from, to: ["nino@example.com"], subject: "Hi" });
  });

  it("reports a refusal or a network error as not sent", async () => {
    const refused = vi.fn(async () => new Response("{}", { status: 422 }));
    const broken = vi.fn(async () => {
      throw new Error("offline");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await sendEmail({ to: "a@b.ge", subject: "s", text: "t" }, cfg, refused as never)).toBe(false);
    expect(await sendEmail({ to: "a@b.ge", subject: "s", text: "t" }, cfg, broken as never)).toBe(false);
    // Nothing about the recipient reaches the log.
    expect(spy.mock.calls.flat().join(" ")).not.toContain("a@b.ge");
    spy.mockRestore();
  });

  it("sends nothing when not configured", async () => {
    const fetcher = vi.fn();
    expect(await sendEmail({ to: "a@b.ge", subject: "s", text: "t" }, null, fetcher as never)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("needs both the key and the sender", () => {
    const saved = { ...process.env };
    process.env.RESEND_API_KEY = "re_x";
    delete process.env.EMAIL_FROM;
    expect(emailConfig()).toBeNull();
    process.env.EMAIL_FROM = "a@activo.world";
    expect(emailConfig()).toEqual({ apiKey: "re_x", from: "a@activo.world" });
    process.env = saved;
  });

  it("escapes HTML", () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  });
});
