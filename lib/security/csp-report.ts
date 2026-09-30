// Content-Security-Policy violation reports → one log line each. Pure.
//
// Browsers send reports in two shapes:
//   - `report-uri` (application/csp-report): { "csp-report": { "document-uri", "blocked-uri", … } }
//   - `report-to` / Reporting API (application/reports+json):
//       [{ type: "csp-violation", url, body: { documentURL, blockedURL, effectiveDirective, … } }]
// Both are reduced to the same small entry. URLs lose their query string and
// fragment (reset tokens, phone numbers), and a reset link's token is masked,
// the same way instrumentation.ts logs request paths.

export interface CspLogEntry {
  level: "warn";
  event: "csp_violation";
  document: string | null;
  blocked: string | null;
  directive: string | null;
  disposition: string | null;
  source: string | null;
  line: number | null;
}

/** At most this many reports are logged from one request. */
export const MAX_REPORTS_PER_REQUEST = 5;

/** Report bodies larger than this are refused (413) without being read on. */
export const MAX_REPORT_BYTES = 64 * 1024;

/**
 * Reads a request body as text, stopping as soon as it passes `maxBytes`
 * (null then) — so a chunked upload without Content-Length is never held
 * in memory in full.
 */
export async function readCapped(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<string | null> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    all.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(all);
}

/**
 * A small in-memory token bucket per client address. The route is public,
 * so it must not let one address fill the logs: `capacity` reports at once,
 * refilled at `perMinute`. Per server instance only (serverless instances
 * each keep their own) — a light brake, not an accounting system.
 */
export function createReportLimiter(capacity = 10, perMinute = 10, maxKeys = 5_000) {
  const buckets = new Map<string, { tokens: number; at: number }>();
  const refillPerMs = perMinute / 60_000;
  return {
    /** True when this address may log one more report now. */
    take(key: string, now: number): boolean {
      const bucket = buckets.get(key) ?? { tokens: capacity, at: now };
      bucket.tokens = Math.min(capacity, bucket.tokens + (now - bucket.at) * refillPerMs);
      bucket.at = now;
      const allowed = bucket.tokens >= 1;
      if (allowed) bucket.tokens -= 1;
      buckets.delete(key); // re-insert: the Map keeps the most recent last
      buckets.set(key, bucket);
      // Forget the longest-idle addresses so the map cannot grow unbounded.
      while (buckets.size > maxKeys) {
        const oldest = buckets.keys().next().value;
        if (oldest === undefined) break;
        buckets.delete(oldest);
      }
      return allowed;
    },
  };
}

/** A URL without its query string or fragment; keywords like "inline" stay. */
export function stripUrl(value: unknown): string | null {
  if (typeof value !== "string" || value === "") return null;
  let out: string;
  try {
    const url = new URL(value);
    out = url.protocol === "http:" || url.protocol === "https:"
      ? `${url.origin}${url.pathname}`
      : url.protocol; // data:, blob:, chrome-extension: … — the scheme is enough
  } catch {
    out = value.split(/[?#]/)[0]; // "inline", "eval", a bare path
  }
  return out.replace(/\/reset\/[^/]+/, "/reset/[token]").slice(0, 300);
}

const str = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value.slice(0, 120) : null;

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function entry(fields: {
  document: unknown; blocked: unknown; directive: unknown;
  disposition: unknown; source: unknown; line: unknown;
}): CspLogEntry {
  return {
    level: "warn",
    event: "csp_violation",
    document: stripUrl(fields.document),
    blocked: stripUrl(fields.blocked),
    directive: str(fields.directive),
    disposition: str(fields.disposition),
    source: stripUrl(fields.source),
    line: num(fields.line),
  };
}

/** The log entries in a report body (parsed JSON); unknown shapes give none. */
export function cspReportEntries(body: unknown): CspLogEntry[] {
  if (Array.isArray(body)) {
    return body
      .filter((item): item is { type?: unknown; body?: Record<string, unknown> } =>
        typeof item === "object" && item !== null)
      .filter((item) => item.type === "csp-violation" && typeof item.body === "object" && item.body !== null)
      .slice(0, MAX_REPORTS_PER_REQUEST)
      .map(({ body: b }) =>
        entry({
          document: b!.documentURL,
          blocked: b!.blockedURL,
          directive: b!.effectiveDirective,
          disposition: b!.disposition,
          source: b!.sourceFile,
          line: b!.lineNumber,
        }),
      );
  }
  if (typeof body === "object" && body !== null && "csp-report" in body) {
    const r = (body as { "csp-report": unknown })["csp-report"];
    if (typeof r !== "object" || r === null) return [];
    const b = r as Record<string, unknown>;
    return [
      entry({
        document: b["document-uri"],
        blocked: b["blocked-uri"],
        directive: b["effective-directive"] ?? b["violated-directive"],
        disposition: b.disposition,
        source: b["source-file"],
        line: b["line-number"],
      }),
    ];
  }
  return [];
}
