// Flitt (formerly Fondy) payment gateway — redirect checkout flow.
//
// All merchant details come from the environment so the same code runs
// against Flitt's public sandbox (default) or a real merchant account:
//   FLITT_MERCHANT_ID  — merchant id (default: 1396424, Flitt/Fondy test)
//   FLITT_SECRET_KEY   — merchant secret / password (default: "test")
//   FLITT_CURRENCY     — ISO currency (default: GEL)
//   FLITT_API_URL      — checkout endpoint (default: pay.flitt.com)
//
// Nothing secret is ever hard-coded; without env vars it uses the public
// sandbox so the whole flow is testable before real onboarding.

import { createHash } from "node:crypto";

export interface FlittConfig {
  merchantId: string;
  secretKey: string;
  currency: string;
  apiUrl: string;
}

const SANDBOX_MERCHANT_ID = "1396424";

export function flittConfig(): FlittConfig {
  const merchantId = process.env.FLITT_MERCHANT_ID?.trim() || SANDBOX_MERCHANT_ID;
  const isSandbox = merchantId === SANDBOX_MERCHANT_ID;
  // The public sandbox merchant doesn't support GEL, so default it to USD
  // (amounts are the same numbers, just test money). Real merchants → GEL.
  const defaultCurrency = isSandbox ? "USD" : "GEL";
  // The 1396424 test merchant lives on Fondy's gateway; real Flitt merchants
  // use pay.flitt.com. Both speak the same API.
  const defaultApiUrl = isSandbox
    ? "https://pay.fondy.eu/api/checkout/url/"
    : "https://pay.flitt.com/api/checkout/url/";
  return {
    merchantId,
    secretKey: process.env.FLITT_SECRET_KEY?.trim() || "test",
    currency: process.env.FLITT_CURRENCY?.trim() || defaultCurrency,
    apiUrl: process.env.FLITT_API_URL?.trim() || defaultApiUrl,
  };
}

/** True when running against the built-in public sandbox merchant. */
export function isFlittSandbox(cfg = flittConfig()): boolean {
  return cfg.merchantId === SANDBOX_MERCHANT_ID;
}

/**
 * Flitt/Fondy signature: sha1 of `secret|v1|v2|...` where the values are
 * every non-empty request field except `signature`, sorted by field name.
 */
export function flittSignature(
  params: Record<string, string | number | undefined>,
  secretKey: string,
): string {
  const values = Object.entries(params)
    .filter(([k, v]) => k !== "signature" && v !== undefined && v !== null && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => String(v));
  const base = [secretKey, ...values].join("|");
  return createHash("sha1").update(base).digest("hex");
}

export interface CheckoutInput {
  orderId: string;
  amountMinor: number; // in tetri (minor units)
  description: string;
  callbackUrl: string; // server-to-server status callback
  responseUrl: string; // where the buyer lands after paying
}

/**
 * Requests a hosted checkout URL from Flitt. Returns the URL to redirect
 * the buyer to, or throws with a readable message on failure.
 */
export async function createFlittCheckout(
  input: CheckoutInput,
  cfg = flittConfig(),
): Promise<string> {
  const request: Record<string, string | number> = {
    order_id: input.orderId,
    merchant_id: cfg.merchantId,
    order_desc: input.description,
    amount: input.amountMinor,
    currency: cfg.currency,
    server_callback_url: input.callbackUrl,
    response_url: input.responseUrl,
  };
  request.signature = flittSignature(request, cfg.secretKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(cfg.apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ request }),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    let data: {
      response?: {
        response_status?: string;
        checkout_url?: string;
        error_message?: string;
        error_code?: number;
      };
    };
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `HTTP ${res.status} from Flitt (non-JSON): ${text.slice(0, 120)}`,
      );
    }
    const r = data.response;
    if (r?.response_status === "success" && r.checkout_url) {
      return r.checkout_url;
    }
    throw new Error(
      r?.error_message
        ? `${r.error_message}${r.error_code ? ` (code ${r.error_code})` : ""}`
        : `Flitt did not return a checkout URL (HTTP ${res.status})`,
    );
  } finally {
    clearTimeout(timer);
  }
}

export interface CallbackResult {
  valid: boolean;
  orderId: string | null;
  status: string | null; // "approved" | "declined" | "processing" | ...
  amountMinor: number | null;
  currency: string | null;
  providerRef: string | null;
}

/**
 * Parses and verifies a Flitt server callback body. The signature is
 * recomputed over all returned fields (minus signature / response
 * signature) and compared to the one Flitt sent.
 */
export function verifyFlittCallback(
  fields: Record<string, string>,
  cfg = flittConfig(),
): CallbackResult {
  const provided = fields.signature ?? "";
  const toSign: Record<string, string> = { ...fields };
  delete toSign.signature;
  delete toSign.response_signature_string;

  const expected = flittSignature(toSign, cfg.secretKey);
  const valid = provided.length > 0 && provided === expected;

  return {
    valid,
    orderId: fields.order_id ?? null,
    status: fields.order_status ?? null,
    amountMinor: fields.amount ? Number(fields.amount) : null,
    currency: fields.currency ?? null,
    providerRef: fields.payment_id ?? null,
  };
}
