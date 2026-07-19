"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login, register } from "@/lib/auth/actions";
import type { FormState } from "@/lib/units/actions";

const inputClass =
  "w-full rounded border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700";
const labelClass = "flex flex-col gap-1 text-sm";

export default function AuthForm({
  mode,
  labels,
}: {
  mode: "login" | "register";
  labels: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    mode === "login" ? login : register,
    null,
  );

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      {mode === "register" && (
        <label className={labelClass}>
          {labels.operator_name}
          <input name="name" required className={inputClass} />
        </label>
      )}
      <label className={labelClass}>
        {labels.operator_email}
        <input name="email" type="email" required className={inputClass} />
      </label>
      <label className={labelClass}>
        {labels.password_label}
        <input
          name="password"
          type="password"
          required
          minLength={mode === "register" ? 8 : 1}
          className={inputClass}
        />
      </label>

      {state?.error && (
        <p className="text-sm text-red-600">{labels[state.error]}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {mode === "login" ? labels.login_submit : labels.register_submit}
      </button>

      <p className="text-sm text-neutral-500">
        {mode === "login" ? (
          <>
            {labels.auth_no_account}{" "}
            <Link href="/register" className="text-blue-600 hover:underline dark:text-blue-400">
              {labels.register_title}
            </Link>
          </>
        ) : (
          <>
            {labels.auth_have_account}{" "}
            <Link href="/login" className="text-blue-600 hover:underline dark:text-blue-400">
              {labels.login_title}
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
