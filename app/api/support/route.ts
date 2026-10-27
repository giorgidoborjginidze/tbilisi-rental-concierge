import { prisma } from "@/lib/db";
import { answerSupport, cleanHistory } from "@/lib/ai/support-bot";
import { attemptCounts, clientIpFrom, isLimited, recordAttempt } from "@/lib/auth/limit";
import { flittConfig } from "@/lib/billing/flitt";
import { readCapped } from "@/lib/security/csp-report";

// The support chat's AI answers (lib/ai/support-bot.ts). Public — the chat
// is on every page — so it is kept cheap: small bodies only, the last few
// turns, and a per-address and a global hourly cap (lib/auth/limit.ts).
// Anything other than an answer is { fallback: true }: the chat then uses
// its keyword FAQ, so a visitor is never left without a reply.
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
const fallback = () => Response.json({ fallback: true });

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return fallback();
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  const raw = await readCapped(request.body, MAX_BODY_BYTES);
  if (raw == null) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const turns = cleanHistory((body as { messages?: unknown } | null)?.messages);
  if (!turns) return new Response(null, { status: 400 });

  const ip = clientIpFrom((name) => request.headers.get(name));
  const now = new Date();
  // The empty email makes the "email" count the global one (see ATTEMPT_RULES.bot).
  if (isLimited("bot", await attemptCounts(prisma, "bot", "", ip, now))) return fallback();
  await recordAttempt(prisma, "bot", "", ip, now);

  const answer = await answerSupport(turns, { cardPayments: flittConfig() != null });
  return answer ? Response.json(answer) : fallback();
}
