// Password hashing with Node's built-in scrypt — no native dependencies,
// works everywhere (including Windows). Stored format: "salt:hash" (hex).
//
// Async (libuv thread pool), never scryptSync: a burst of sign-in attempts
// must not freeze every other request on the server while it hashes.

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await derive(password, salt)).toString("hex");
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = await derive(password, salt);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

// A well-formed hash of a random password nobody knows. Sign-in runs one
// scrypt against it when the email has no account (or no password), so an
// unknown email takes as long to refuse as a wrong password — the response
// time does not tell which emails have accounts.
let dummy: Promise<string> | null = null;
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(24).toString("hex"));
  return dummy;
}

/** Minimum length for a new password (register, change, reset). */
export const MIN_PASSWORD_LENGTH = 8;
