"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "./password";
import { createSession, destroySession } from "./session";
import type { FormState } from "@/lib/units/actions";

const str = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

export async function register(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = str(formData, "name");
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email) return { error: "error_required" };
  if (password.length < 8) return { error: "error_password_short" };

  const existing = await prisma.operator.findUnique({ where: { email } });
  if (existing) return { error: "error_email_taken" };

  const operator = await prisma.operator.create({
    data: { name, email, passwordHash: hashPassword(password) },
  });
  await createSession(operator.id);
  redirect("/");
}

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = str(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "error_required" };

  const operator = await prisma.operator.findUnique({ where: { email } });
  if (
    !operator ||
    !operator.passwordHash ||
    !verifyPassword(password, operator.passwordHash)
  ) {
    return { error: "error_invalid_credentials" };
  }

  await createSession(operator.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
