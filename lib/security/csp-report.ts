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
export const MAX_REPORTS_PER_REQUEST = 20;

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
