// Password hashing with Node's built-in scrypt — no native dependencies,
// works everywhere (including Windows). Stored format: "salt:hash" (hex).

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

// A sign-in against an unknown email must cost the same as one against a
// known email. Without this, the response time alone says whether an
// address has an account here — an enumeration oracle that no amount of
// careful wording in the error message can close.
const DECOY_HASH = hashPassword("password-that-belongs-to-nobody");

export function burnVerifyTime(password: string): void {
  verifyPassword(password, DECOY_HASH);
}
