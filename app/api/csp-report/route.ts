import { cspReportEntries } from "@/lib/security/csp-report";

// Where browsers send Content-Security-Policy violation reports (the
// report-uri / report-to of the report-only policy in next.config.ts). Each
// report becomes one JSON log line, so the owner can see in Vercel → Logs
// whether the policy runs clean before it is switched to enforcement.
// No session, no database; bodies over 64 KB are ignored.
export const dynamic = "force-dynamic";

const MAX_BODY = 64 * 1024;

export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY) return new Response(null, { status: 413 });
  const raw = await request.text();
  if (raw.length > MAX_BODY) return new Response(null, { status: 413 });

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
