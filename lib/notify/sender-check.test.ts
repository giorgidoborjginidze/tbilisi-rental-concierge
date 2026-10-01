import { describe, expect, it } from "vitest";
import { checkWhatsAppNumber } from "./sender-check";

const reply = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("WhatsApp number check", () => {
  it("names the number when Meta accepts the pair", async () => {
    expect(await checkWhatsAppNumber("123456789", "t", reply(200, { display_phone_number: "+995 555 12 34 56" }))).toEqual({
      ok: true,
      displayPhone: "+995 555 12 34 56",
    });
  });
  it("tells a refused token from an unreachable Meta", async () => {
    expect(await checkWhatsAppNumber("123456789", "t", reply(401, {}))).toEqual({ ok: false, error: "wa_sender_rejected" });
    const down = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await checkWhatsAppNumber("123456789", "t", down)).toEqual({ ok: false, error: "wa_sender_unreachable" });
  });
});
