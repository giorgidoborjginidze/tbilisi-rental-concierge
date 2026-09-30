// Flitt (formerly Fondy) payment gateway — redirect checkout flow.
//
// All merchant details come from the environment:
//   FLITT_MERCHANT_ID  — merchant id
//   FLITT_SECRET_KEY   — merchant secret / password
//   FLITT_CURRENCY     — ISO currency (default: GEL)
//   FLITT_API_URL      — checkout endpoint (default: pay.flitt.com)
//   FLITT_SANDBOX=1    — preview deployments only: use the public sandbox
//
// Without keys, local development uses Flitt's public sandbox (merchant
// 1396424 / "test") so the whole flow is testable before onboarding. In
// production (VERCEL_ENV=production, or NODE_ENV=production on Vercel) it
// fails closed instead: no keys → no checkout, and a clear message — never
// a silent switch to the public test merchant, whose "payments" are free.
// A real merchant id without its secret is never paired with "test".

import { createHash, timingSafeEqual } from "node:crypto";

export interface FlittConfig {
  merchantId: string;
  secretKey: string;
  currency: string;
  apiUrl: string;
}

const SANDBOX_MERCHANT_ID = "1396424";

type Env = Record<string, string | undefined>;

/** A production deployment (the spec: VERCEL_ENV, or NODE_ENV on Vercel). */
export function isProductionDeploy(env: Env = process.env): boolean {
  return env.VERCEL_ENV === "production" || (env.NODE_ENV === "production" && Boolean(env.VERCEL));
}

/**
 * The merchant to use, or null when payments must stay off (production
 * without keys, or a merchant id without its secret).
 */
export function flittConfig(env: Env = process.env): FlittConfig | null {
  const merchantId = env.FLITT_MERCHANT_ID?.trim();
  const secretKey = env.FLITT_SECRET_KEY?.trim();
  let cfgMerchant: string;
  let cfgSecret: string;
  if (merchantId || secretKey) {
    if (!merchantId || !secretKey) return null;
    cfgMerchant = merchantId;
    cfgSecret = secretKey;
  } else {
    // No keys: the public sandbox, but never on a production deployment
    // (a preview may opt in with FLITT_SANDBOX=1).
    const sandboxAllowed =
      !isProductionDeploy(env) || (env.FLITT_SANDBOX === "1" && env.VERCEL_ENV !== "production");
    if (!sandboxAllowed) return null;
    cfgMerchant = SANDBOX_MERCHANT_ID;
    cfgSecret = "test";
  }
  const isSandbox = cfgMerchant === SANDBOX_MERCHANT_ID;
  // The public sandbox merchant doesn't support GEL, so default it to USD
  // (amounts are the same numbers, just test money). Real merchants → GEL.
  const defaultCurrency = isSandbox ? "USD" : "GEL";
  // The 1396424 test merchant lives on Fondy's gateway; real Flitt merchants
  // use pay.flitt.com. Both speak the same API.
  const defaultApiUrl = isSandbox
    ? "https://pay.fondy.eu/api/checkout/url/"
    : "https://pay.flitt.com/api/checkout/url/";
  return {
    merchantId: cfgMerchant,
    secretKey: cfgSecret,
    currency: env.FLITT_CURRENCY?.trim() || defaultCurrency,
    apiUrl: env.FLITT_API_URL?.trim() || defaultApiUrl,
  };
}

/** True when running against the built-in public sandbox merchant. */
export function isFlittSandbox(cfg: FlittConfig | null = flittConfig()): boolean {
  return cfg?.merchantId === SANDBOX_MERCHANT_ID;
}

/**
 * What a callback's order_status means for our Payment row. Only an
 * approved order with the exact amount activates anything; a final "no"
 * (declined, expired, reversed) is recorded as declined; anything else
 * (created, processing) leaves the payment waiting for the final callback.
 */
export function callbackOutcome(
  status: string | null,
  amountMatches: boolean,
): "approved" | "declined" | "pending" {
  if (status === "approved") return amountMatches ? "approved" : "declined";
  if (status === "declined" || status === "expired" || status === "reversed") return "declined";
  return "pending";
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
  cfg: FlittConfig,
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
  cfg: FlittConfig,
): CallbackResult {
  const provided = fields.signature ?? "";
  const toSign: Record<string, string> = { ...fields };
  delete toSign.signature;
  delete toSign.response_signature_string;

  const expected = flittSignature(toSign, cfg.secretKey);
  // Constant-time: the comparison must not leak how much of a forged
  // signature was right.
  const valid =
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected));

  return {
    valid,
    orderId: fields.order_id ?? null,
    status: fields.order_status ?? null,
    amountMinor: fields.amount ? Number(fields.amount) : null,
    currency: fields.currency ?? null,
    providerRef: fields.payment_id ?? null,
  };
}
