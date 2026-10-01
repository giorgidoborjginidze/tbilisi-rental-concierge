// Secrets the owners give us (their WhatsApp Business access token) are
// stored sealed: AES-256-GCM under SECRETS_KEY, an app key that lives only
// in the environment (Vercel → Sensitive). A copy of the database alone
// reveals nothing; a wrong or rotated key fails to open, never decrypts to
// garbage. Server-only.
//
//   SECRETS_KEY — 32 random bytes, base64 (`openssl rand -base64 32`)

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

function key(env: Record<string, string | undefined> = process.env): Buffer | null {
  const raw = env.SECRETS_KEY?.trim();
  if (!raw) return null;
  const bytes = Buffer.from(raw, "base64");
  return bytes.length === 32 ? bytes : null;
}

export const secretsConfigured = (env?: Record<string, string | undefined>): boolean => key(env) != null;

/** "v1.<iv>.<tag>.<ciphertext>" (base64url), or null without a key. */
export function sealSecret(plain: string, env?: Record<string, string | undefined>): string | null {
  const k = key(env);
  if (!k) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), body].map((part) => (typeof part === "string" ? part : part.toString("base64url"))).join(".");
}

/** The secret, or null when it cannot be opened (no key, another key, tampered). */
export function openSecret(sealed: string | null | undefined, env?: Record<string, string | undefined>): string | null {
  const k = key(env);
  if (!k || !sealed) return null;
  const [version, iv, tag, body] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !body) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
