import {
  createReportLimiter,
  cspReportEntries,
  MAX_REPORT_BYTES,
  readCapped,
} from "@/lib/security/csp-report";
import { clientIpFrom } from "@/lib/auth/limit";

// Where browsers send Content-Security-Policy violation reports (the
// report-uri / report-to of the report-only policy in next.config.ts). Each
// report becomes one JSON log line, so the owner can see in Vercel → Logs
// whether the policy runs clean before it is switched to enforcement.
// No session, no database. The route is public, so it is kept cheap:
// bodies over 64 KB are refused while they stream in, at most 5 reports of
// a request are logged, and each address gets a small per-minute allowance
// (over it: 204 and nothing logged).
export const dynamic = "force-dynamic";

const limiter = createReportLimiter();

export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_REPORT_BYTES) return new Response(null, { status: 413 });

  const ip = clientIpFrom((name) => request.headers.get(name)) ?? "unknown";
  if (!limiter.take(ip, Date.now())) {
    await request.body?.cancel().catch(() => {});
    return new Response(null, { status: 204 });
  }

  const raw = await readCapped(request.body, MAX_REPORT_BYTES);
  if (raw == null) return new Response(null, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const at = new Date().toISOString();
  for (const entry of cspReportEntries(body)) {
    console.warn(JSON.stringify({ ...entry, at }));
  }
  return new Response(null, { status: 204 });
}
