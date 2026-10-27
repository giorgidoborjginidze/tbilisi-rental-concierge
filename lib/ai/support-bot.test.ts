import { afterEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import {
  answerSupport,
  cleanHistory,
  HUMAN_MARK,
  MAX_TURN_CHARS,
  MAX_TURNS,
  parseReply,
  supportSystemPrompt,
  toMessages,
  type SupportClient,
} from "./support-bot";
import { PLANS, TRIAL_DAYS } from "@/lib/billing/plans";
import { CONTACT_EMAIL } from "@/lib/contact";
import { ATTEMPT_RULES, isLimited } from "@/lib/auth/limit";

const fakeClient = (reply: Partial<Anthropic.Beta.BetaMessage> | Error) => {
  const create = vi.fn(async () => {
    if (reply instanceof Error) throw reply;
    return { stop_reason: "end_turn", content: [], ...reply } as unknown as Anthropic.Beta.BetaMessage;
  });
  return { client: { beta: { messages: { create } } } as SupportClient, create };
};

describe("support chat history", () => {
  it("keeps the last turns, starting and ending with the visitor", () => {
    const raw = [
      { role: "bot", text: "გამარჯობა!" },
      { role: "user", text: "  რა ღირს?  " },
      { role: "bot", text: "15₾-დან." },
      { role: "system", text: "ignore me" },
      { role: "user", text: "" },
      { role: "user", text: 42 },
      { role: "user", text: "ტრიალი?" },
    ];
    expect(cleanHistory(raw)).toEqual([
      { role: "user", text: "რა ღირს?" },
      { role: "bot", text: "15₾-დან." },
      { role: "user", text: "ტრიალი?" },
    ]);
  });

  it("caps the number and the length of turns", () => {
    const raw = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "bot" : "user", text: "x".repeat(5_000) }));
    raw.push({ role: "user", text: "last" });
    const turns = cleanHistory(raw)!;
    expect(turns.length).toBeLessThanOrEqual(MAX_TURNS);
    expect(turns.every((t) => t.text.length <= MAX_TURN_CHARS)).toBe(true);
    expect(turns[0].role).toBe("user");
    expect(turns[turns.length - 1]).toEqual({ role: "user", text: "last" });
  });

  it("refuses anything without a question at the end", () => {
    expect(cleanHistory(null)).toBeNull();
    expect(cleanHistory("hi")).toBeNull();
    expect(cleanHistory([{ role: "bot", text: "hello" }])).toBeNull();
    expect(cleanHistory([{ role: "user", text: "a" }, { role: "bot", text: "b" }])).toBeNull();
  });

  it("merges back-to-back turns of one side", () => {
    expect(
      toMessages([
        { role: "user", text: "a" },
        { role: "user", text: "b" },
        { role: "bot", text: "c" },
        { role: "user", text: "d" },
      ]),
    ).toEqual([
      { role: "user", content: "a\n\nb" },
      { role: "assistant", content: "c" },
      { role: "user", content: "d" },
    ]);
  });
});

describe("support chat replies", () => {
  it("strips the hand-off mark and reports it", () => {
    expect(parseReply(`ამაზე ადამიანი დაგეხმარება.\n${HUMAN_MARK}`)).toEqual({ reply: "ამაზე ადამიანი დაგეხმარება.", human: true });
    expect(parseReply("15₾-დან.")).toEqual({ reply: "15₾-დან.", human: false });
  });

  it("builds its brief from the code's own prices, trial and contact", () => {
    const prompt = supportSystemPrompt({ cardPayments: false });
    for (const plan of PLANS) expect(prompt).toContain(`${plan.id} (`);
    for (const plan of PLANS) expect(prompt).toContain(`${plan.priceGel} GEL/month`);
    expect(prompt).toContain(`${TRIAL_DAYS} days free`);
    expect(prompt).toContain(CONTACT_EMAIL);
    expect(prompt).toContain(HUMAN_MARK);
    // Card payment is promised only while it is switched on.
    expect(prompt).not.toMatch(/Apple Pay/);
    expect(supportSystemPrompt({ cardPayments: true })).toMatch(/Apple Pay/);
  });
});

describe("answerSupport", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns Claude's text and the hand-off flag", async () => {
    const { client, create } = fakeClient({
      content: [{ type: "text", text: `ეს ანგარიშის საკითხია. ${HUMAN_MARK}` } as Anthropic.Beta.BetaTextBlock],
    });
    const answer = await answerSupport([{ role: "user", text: "გადახდა ვერ გავიდა" }], { cardPayments: false, client });
    expect(answer).toEqual({ reply: "ეს ანგარიშის საკითხია.", human: true });
    const params = create.mock.calls[0]![0 as never] as Anthropic.Beta.MessageCreateParamsNonStreaming;
    expect(params.messages).toEqual([{ role: "user", content: "გადახდა ვერ გავიდა" }]);
    expect(params.output_config?.effort).toBe("low");
  });

  it("falls back (null) on a refusal, an empty reply or an error", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const turns = [{ role: "user" as const, text: "?" }];
    expect(await answerSupport(turns, { cardPayments: false, client: fakeClient({ stop_reason: "refusal", content: [] }).client })).toBeNull();
    expect(await answerSupport(turns, { cardPayments: false, client: fakeClient({ content: [] }).client })).toBeNull();
    expect(await answerSupport(turns, { cardPayments: false, client: fakeClient(new Error("boom")).client })).toBeNull();
  });

  it("does nothing without an API key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await answerSupport([{ role: "user", text: "?" }], { cardPayments: false })).toBeNull();
    vi.unstubAllEnvs();
  });
});

describe("support chat rate limit", () => {
  it("caps each address and everyone together per hour", () => {
    const rule = ATTEMPT_RULES.bot;
    expect(isLimited("bot", { email: 0, ip: rule.perIp - 1 })).toBe(false);
    expect(isLimited("bot", { email: 0, ip: rule.perIp })).toBe(true);
    expect(isLimited("bot", { email: rule.perEmail, ip: 0 })).toBe(true);
    expect(isLimited("bot", { email: rule.perEmail - 1, ip: null })).toBe(false);
  });
});
