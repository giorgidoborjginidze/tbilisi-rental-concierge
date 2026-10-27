// The support chat's AI answers.
//
// With ANTHROPIC_API_KEY set, Claude answers what visitors type into the
// support chat, from a fixed brief about the product built here from the
// code's own facts (plans, prices, trial, limits, contact). It sees only the
// conversation, never anyone's account. Without a key — or on any API error,
// a refusal or the rate limit — the route says so and the chat falls back to
// its keyword FAQ (app/support-bot.tsx), so the bot always answers.

import Anthropic from "@anthropic-ai/sdk";
import { FREE_LIMITS, GRACE_DAYS, PLANS, TRIAL_DAYS } from "@/lib/billing/plans";
import { CONTACT_EMAIL, CONTACT_WHATSAPP_DISPLAY, CONTACT_WHATSAPP_READY } from "@/lib/contact";

/** The model, overridable without a deploy of code (Vercel env). */
export const SUPPORT_BOT_MODEL = process.env.SUPPORT_BOT_MODEL || "claude-opus-5-5";

/** What the client may send: the last few turns, each kept short. */
export const MAX_TURNS = 10;
export const MAX_TURN_CHARS = 1_000;

/** The model ends its reply with this when a person should take over. */
export const HUMAN_MARK = "[[HUMAN]]";

export interface ChatTurn {
  role: "user" | "bot";
  text: string;
}

/**
 * The client's history, cleaned: only user/bot turns with text, each cut
 * to MAX_TURN_CHARS, the last MAX_TURNS of them, starting with a user turn
 * and ending with one (the question being asked). Null when nothing usable.
 */
export function cleanHistory(raw: unknown): ChatTurn[] | null {
  if (!Array.isArray(raw)) return null;
  const turns: ChatTurn[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { role, text } = item as { role?: unknown; text?: unknown };
    if ((role !== "user" && role !== "bot") || typeof text !== "string") continue;
    const trimmed = text.trim().slice(0, MAX_TURN_CHARS);
    if (trimmed) turns.push({ role, text: trimmed });
  }
  const recent = turns.slice(-MAX_TURNS);
  while (recent.length && recent[0].role !== "user") recent.shift();
  if (!recent.length || recent[recent.length - 1].role !== "user") return null;
  return recent;
}

/** Anthropic messages: consecutive turns of one role merged into one. */
export function toMessages(turns: ChatTurn[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const turn of turns) {
    const role = turn.role === "user" ? "user" : "assistant";
    const last = out[out.length - 1];
    if (last && last.role === role && typeof last.content === "string") {
      last.content = `${last.content}\n\n${turn.text}`;
    } else {
      out.push({ role, content: turn.text });
    }
  }
  return out;
}

/** The reply text without the hand-off mark, and whether it was there. */
export function parseReply(text: string): { reply: string; human: boolean } {
  const human = text.includes(HUMAN_MARK);
  const reply = text.split(HUMAN_MARK).join("").replace(/\n{3,}/g, "\n\n").trim();
  return { reply, human };
}

const planLine = (p: (typeof PLANS)[number]) =>
  `- ${p.id} (${p.kind === "personal" ? "personal" : "business"}): ${p.priceGel} GEL/month; up to ${p.maxAssets} assets, ` +
  `${p.maxUnits} rental units, ${p.maxMembers} ${p.maxMembers === 1 ? "person" : "people incl. the owner"}; ` +
  `Pro investment analysis ${p.analysis ? "included" : "not included"}.`;

/** The brief. Stable for a given deployment, so it can be prompt-cached. */
export function supportSystemPrompt(opts: { cardPayments: boolean }): string {
  const contact = CONTACT_WHATSAPP_READY
    ? `email ${CONTACT_EMAIL} or WhatsApp ${CONTACT_WHATSAPP_DISPLAY}`
    : `email ${CONTACT_EMAIL}`;
  return `You are the support assistant in the chat window of Activo (activo.world), a web app from Georgia for people and small businesses who own and rent out property and cars.

How to answer
- Reply in the language of the visitor's last message (most write Georgian; answer Georgian in natural, informal Georgian, addressing the person as "შენ").
- Be brief: 1-4 short sentences, plain text only (no markdown, no lists unless asked, no emoji).
- Answer only from the facts below. If something is not covered, or you are not sure, say so plainly and offer to connect them with a person.
- You cannot see anyone's account, bookings or payments, and cannot change anything. For anything about a specific account (a bug, a payment, a refund, deleting data, a plan change that did not work), say a person will help and offer the contact.
- When a person should take over, or the visitor asks for a person, end your reply with ${HUMAN_MARK} on its own (the chat then shows a contact button). Contact: ${contact}.
- Stay on Activo, renting and managing property or cars. Politely decline anything else.
- Never invent features, prices, integrations, dates or promises. Never give legal or tax advice; suggest a lawyer or accountant.

What Activo is
- One dashboard for everything a person owns: real estate, vehicles, rentals, income sources and digital assets (crypto, stocks, metals) with their current value and total net worth.
- Works in the browser on a phone or a computer (it can be added to the home screen). There is no App Store / Google Play app. Georgian and English, light and dark theme.

Short-term rentals (apartments, apart-hotels)
- Paste each listing's iCal link from Airbnb and Booking.com: all bookings show in one calendar, re-synced automatically, with a warning when two bookings overlap (double booking).
- iCal carries dates only, not prices: the amount of an imported booking is entered by hand. Activo does not change prices or availability on Airbnb/Booking (no channel-manager API); it gives an iCal export link per unit that the platforms can import to block dates.
- Bookings can also be added by hand (direct guests). Analytics: occupancy, average nightly rate, income per unit.
- Price suggestions per night from season, demand and the district's average; they are advice only, the owner sets prices on the platforms.

Long-term rentals
- Contracts with rent schedules, recording payments, alerts when rent is late, contract end dates.
- Reminders to renters can be sent via WhatsApp only to renters who agreed to receive them.
- Invoices (shareable link and email) and a place for documents (contracts, photos).
- Rent is not collected through Activo: renters pay the owner as before.

Car rental / fleet
- A fleet table of cars with plates, rental status and late returns.
- GPS: with a GPS tracker installed in the car (bought separately), Activo shows its location, zones (geofences) on a map and warns when a car leaves a zone or the tracker goes silent.

Also
- An alerts centre (late rent, overlaps, ended contracts, silent trackers) with a daily automatic check.
- Teams on business plans: the owner invites members; a member can view and edit assets, contracts, calendar and invoices; a "view only" member changes nothing; billing and the team stay with the owner.
- A free investment calculator on the site (no account needed). The Pro 5-year investment analysis is in the plans listed as including it.
- Data export, an activity log, market data for Tbilisi districts.

Prices (GEL per month)
${PLANS.map(planLine).join("\n")}
- A new account gets ${TRIAL_DAYS} days free with full access (the top plan of its type). No card is needed to start.
- After the trial without a plan, the account keeps a free allowance of ${FREE_LIMITS.maxAssets} assets and ${FREE_LIMITS.maxUnits} rental unit; nothing is deleted, only adding more stops. A plan can be cancelled any time; a late renewal keeps working for ${GRACE_DAYS} days.
- ${opts.cardPayments ? "Payment is by card on a secure payment page (including Apple Pay and Google Pay)." : `Online card payment is being switched on; until then, write to ${CONTACT_EMAIL} and the team activates the plan.`}

Data and privacy
- Each account's data is kept separate from every other account; passwords are stored only as hashes; data is never sold. The privacy policy (activo.world/privacy) lists every provider the service uses. Messages in this chat are sent to Anthropic to write the answers.

Do not promise
- syncing prices or availability to Airbnb/Booking automatically, collecting rent from tenants, filing taxes or reporting to rs.ge, guaranteed income or savings, a mobile app in the stores, or anything else not listed above.`;
}

// The slice of the SDK used here, so tests can pass a fake.
export interface SupportClient {
  beta: {
    messages: {
      create(params: Anthropic.Beta.MessageCreateParamsNonStreaming): Promise<Anthropic.Beta.BetaMessage>;
    };
  };
}

/**
 * Claude's answer to the last user turn, or null (no key, an error, a
 * refusal or an empty reply): the caller then falls back to the FAQ.
 */
export async function answerSupport(
  turns: ChatTurn[],
  opts: { cardPayments: boolean; client?: SupportClient },
): Promise<{ reply: string; human: boolean } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!opts.client && !apiKey) return null;
  try {
    const client: SupportClient = opts.client ?? new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 });
    const response = await client.beta.messages.create({
      model: SUPPORT_BOT_MODEL,
      max_tokens: 2_000,
      // Short, factual chat: low effort is enough and keeps answers quick.
      output_config: { effort: "low" },
      // A rare classifier decline is retried on another model instead of
      // leaving the visitor without an answer.
      betas: ["server-side-fallback-2026-06-01"],
      fallbacks: [{ model: "claude-opus-4-8" }],
      system: [
        { type: "text", text: supportSystemPrompt({ cardPayments: opts.cardPayments }), cache_control: { type: "ephemeral" } },
      ],
      messages: toMessages(turns),
    });
    if (response.stop_reason === "refusal") return null;
    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) return null;
    const parsed = parseReply(text);
    return parsed.reply ? parsed : null;
  } catch (error) {
    console.warn(JSON.stringify({ level: "warn", event: "support_bot_error", message: String(error).slice(0, 200) }));
    return null;
  }
}
