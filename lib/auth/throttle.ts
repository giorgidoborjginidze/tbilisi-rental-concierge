// Brute-force braking for the sign-in form.
//
// scrypt already makes each guess expensive, but "expensive" is only a wall
// if the attacker is made to wait between attempts. This counts failures per
// (email, source address) pair and locks that pair out for a growing window
// — the account itself is never locked, so an attacker cannot deny a real
// operator their own login by guessing at it.
//
// The key is a hash: the table can be read without learning which addresses
// have been trying which accounts.

import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { MAX_ATTEMPTS, WINDOW_MS, lockDuration } from "./throttle-policy";

export * from "./throttle-policy";

const keyFor = (email: string, ip: string | null) =>
  createHash("sha256")
    .update(`${email.trim().toLowerCase()}|${ip ?? "-"}`)
    .digest("hex");

export interface ThrottleState {
  locked: boolean;
  /** Seconds until the caller may try again; 0 when not locked. */
  retryAfterSeconds: number;
}

/** Is this (email, address) pair currently on hold? */
export async function checkThrottle(
  email: string,
  ip: string | null,
  now = new Date(),
): Promise<ThrottleState> {
  const row = await prisma.loginAttempt.findUnique({
    where: { key: keyFor(email, ip) },
  });
  if (!row?.lockedUntil || row.lockedUntil <= now) {
    return { locked: false, retryAfterSeconds: 0 };
  }
  return {
    locked: true,
    retryAfterSeconds: Math.ceil(
      (row.lockedUntil.getTime() - now.getTime()) / 1000,
    ),
  };
}

/**
 * Record one failed attempt and return the resulting state. A window older
 * than WINDOW_MS starts over, so an operator who mistypes twice a week is
 * never treated as an attack.
 */
export async function registerFailure(
  email: string,
  ip: string | null,
  now = new Date(),
): Promise<ThrottleState> {
  const key = keyFor(email, ip);
  const existing = await prisma.loginAttempt.findUnique({ where: { key } });

  const staleWindow =
    existing != null && now.getTime() - existing.firstAt.getTime() > WINDOW_MS;
  const count = existing && !staleWindow ? existing.count + 1 : 1;
  const lockedUntil =
    count >= MAX_ATTEMPTS ? new Date(now.getTime() + lockDuration(count)) : null;

  await prisma.loginAttempt.upsert({
    where: { key },
    create: { key, count, firstAt: now, lastAt: now, lockedUntil },
    update: {
      count,
      lastAt: now,
      ...(staleWindow ? { firstAt: now } : {}),
      lockedUntil,
    },
  });

  return {
    locked: lockedUntil != null,
    retryAfterSeconds: lockedUntil
      ? Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000)
      : 0,
  };
}

/** A successful sign-in clears the pair's history. */
export async function clearFailures(
  email: string,
  ip: string | null,
): Promise<void> {
  await prisma.loginAttempt
    .delete({ where: { key: keyFor(email, ip) } })
    .catch(() => {});
}
