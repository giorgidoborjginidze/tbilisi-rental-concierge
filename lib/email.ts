// Transactional email (password-reset links), through Resend's HTTP API.
// No SDK: one POST to https://api.resend.com/emails.
//
//   RESEND_API_KEY — the Resend API key (keep private, never commit)
//   EMAIL_FROM     — a sender on a domain verified in Resend,
//                    e.g. "Activo <no-reply@activo.world>"
//
// Without both, email is "not configured": the forgot-password page says so
// and points to support instead of pretending a link was sent. Nothing about
// the recipient or the message is ever logged.

export interface EmailConfig {
  apiKey: string;
  from: string;
}

export function emailConfig(): EmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  return apiKey && from ? { apiKey, from } : null;
}

export const emailConfigured = (): boolean => emailConfig() != null;

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Sends one email. Resolves true when Resend accepted it, false otherwise
 * (not configured, refused, network error) — the caller decides what the
 * user sees; the failure is logged without the address or the content.
 */
export async function sendEmail(
  message: EmailMessage,
  cfg: EmailConfig | null = emailConfig(),
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  if (!cfg) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: cfg.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`[email] send refused: HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[email] send failed: ${error instanceof Error ? error.name : "error"}`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Escapes text for the HTML part of an email. */
export const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
