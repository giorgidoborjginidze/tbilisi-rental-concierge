// The session cookie's name and token format. Pure — shared by
// lib/auth/session.ts and the test that keeps next.config.ts's signed-in
// Home rewrite (it matches the cookie by this format) in step with it.

import { randomBytes } from "node:crypto";

export const SESSION_COOKIE = "session";

/** 32 random bytes as 64 lowercase hex characters. */
export const newSessionToken = (): string => randomBytes(32).toString("hex");
