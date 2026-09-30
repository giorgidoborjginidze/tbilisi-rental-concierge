import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSessionOperator } from "@/lib/auth/session";
import { inviteUsable } from "@/lib/auth/invite";
import { getLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/strings";
import AuthForm from "../login/auth-form";
import { AUTH_LABEL_KEYS } from "../login/labels";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  if (await getSessionOperator()) redirect("/");

  const { invite: rawInvite } = await searchParams;
  const invite = typeof rawInvite === "string" && rawInvite ? rawInvite : undefined;
  const locale = await getLocale();
  // An invite shows the email it was made for, read-only: the link works
  // only with that address. An unknown, used or expired one says so.
  const inviteRow = invite
    ? await prisma.invite.findUnique({
        where: { token: invite },
        select: { email: true, usedAt: true, createdAt: true },
      })
    : null;
  const inviteOk = inviteUsable(inviteRow, new Date());
  const labels = Object.fromEntries(
    AUTH_LABEL_KEYS.map((key) => [key, t(locale, key)]),
  );

  return (
    <main>
      <section className="auth-box">
      <h1>{t(locale, "register_title")}</h1>
      <p style={{ color: "var(--color-text-muted)" }}>{t(locale, "onboarding_intro")}</p>
      {invite && !inviteOk ? (
        <p className="demo-hint" role="alert" style={{ color: "var(--status-danger-text)" }}>
          {labels.error_invite_invalid}
        </p>
      ) : (
        <AuthForm
          mode="register"
          labels={labels}
          invite={invite}
          inviteEmail={inviteOk ? inviteRow?.email : undefined}
        />
      )}
      <p className="demo-hint" style={{ marginTop: 20 }}>
        {labels.privacy_note_register}{" "}
        <a href="/privacy" className="link">{t(locale, "privacy_title")}</a>
      </p>
      </section>
    </main>
  );
}
