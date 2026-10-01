// Asks Meta whether a WhatsApp Business phone number id and access token
// work together, before they are saved: the answer names the number
// ("+995 5xx …"), which Settings then shows. Nothing is sent to anyone.

const GRAPH = "https://graph.facebook.com/v21.0";

export type SenderCheck =
  | { ok: true; displayPhone: string }
  | { ok: false; error: "wa_sender_rejected" | "wa_sender_unreachable" };

export async function checkWhatsAppNumber(
  phoneNumberId: string,
  token: string,
  fetcher: typeof fetch = fetch,
): Promise<SenderCheck> {
  try {
    const response = await fetcher(`${GRAPH}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, error: "wa_sender_rejected" };
    const body = (await response.json().catch(() => ({}))) as { display_phone_number?: string };
    return { ok: true, displayPhone: String(body.display_phone_number ?? "").slice(0, 40) };
  } catch {
    return { ok: false, error: "wa_sender_unreachable" };
  }
}
