import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireOperator } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/locale";
import { t, type StringKey } from "@/lib/i18n/strings";
import { toggleLocale } from "@/lib/i18n/actions";
import {
  signOutOtherDevices,
  updateProfileName,
  updateWorkspaceProfile,
} from "@/lib/account/actions";
import { WORKSPACE_PROFILES } from "@/lib/nav/model";
import { currentSessionId } from "@/lib/auth/session";
import { ChangeEmailForm, ChangePasswordForm, DeleteAccountForm, VerifyEmailButton } from "./security-forms";
import { getBillingContext } from "@/lib/billing/context";
import { planById, type AccountType } from "@/lib/billing/plans";
import ThemeToggle from "../theme-toggle";
import TeamSection from "../billing/team-section";
import { tbilisiFormat } from "@/lib/time";
import { inviteUsable } from "@/lib/auth/invite";
import { titled } from "@/lib/i18n/metadata";
import { firstParam, type QueryValue } from "@/lib/params";
import { IconCheck } from "../icons";
import { badgeClass } from "@/lib/ui/tone";
import PushDevice from "./notify-section";
import { pushConfig } from "@/lib/notify/owner";
import { setNotifyEmail } from "@/lib/notify/push-actions";
import { emailConfigured } from "@/lib/email";
import WhatsAppSender from "./whatsapp-sender";
import { openSecret, secretsConfigured } from "@/lib/security/secret";
import { isAdminEmail } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export const generateMetadata = titled("settings_title");

const PROFILE_LABEL: Record<(typeof WORKSPACE_PROFILES)[number], StringKey> = {
  personal: "account_personal",
  hotel: "profile_hotel",
  brokerage: "profile_brokerage",
  car_rental: "profile_car",
};

const PLAN_LATIN: Record<string, string> = {
  starter: "Starter", standard: "Standard", pro: "Pro",
  biz_s: "Business S", biz_m: "Business M",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: QueryValue }>;
}) {
  const operator = await requireOperator();
  const saved = firstParam((await searchParams).saved);
  const locale = await getLocale();
  const other = locale === "en" ? "ka" : "en";
  const context = await getBillingContext(operator);

  // Other browsers/phones signed in to this account (live sessions only).
  const sessionId = await currentSessionId();
  const otherSessions = await prisma.session.count({
    where: {
      operatorId: operator.userId,
      expiresAt: { gt: new Date() },
      ...(sessionId ? { id: { not: sessionId } } : {}),
    },
  });
  const securityKeys: StringKey[] = [
    "password_change", "password_current", "password_new", "password_repeat",
    "password_changed", "email_change", "email_new", "password_confirm", "email_changed",
    "error_required", "error_password_short", "error_password_mismatch",
    "error_password_wrong", "error_too_many_attempts", "error_email_invalid",
    "error_email_unavailable", "error_demo_readonly",
    "account_delete", "account_delete_hint", "account_delete_word", "account_delete_yes", "error_delete_word",
    "verify_send", "verify_sent", "verify_wait",
  ];
  const securityLabels = Object.fromEntries(securityKeys.map((k) => [k, t(locale, k)]));

  const fmtDate = tbilisiFormat(locale, {
    day: "numeric", month: "short", year: "numeric",
  });

  const now = new Date();
  const isMember = operator.companyId != null;
  const accountType = (isMember ? "business" : operator.accountType) as AccountType;
  // The plan in force: a bought plan while paid (or in its grace days),
  // otherwise the trial or the free bottom tier.
  const planLatin =
    context.standing === "paid" || context.standing === "grace" || context.standing === "complimentary"
      ? PLAN_LATIN[context.plan.id] ?? planById(context.plan.id)?.id ?? "—"
      : context.trialDaysLeft > 0
        ? "Trial"
        : PLAN_LATIN[context.plan.id] ?? context.plan.id;
  const lapsed = !isMember && context.standing === "expired" && context.paidUntil != null;

  const [members, invites] = context.isOwner && accountType === "business"
    ? await Promise.all([
        prisma.operator.findMany({
          where: { companyId: operator.id },
          select: { id: true, name: true, email: true, role: true },
          orderBy: { createdAt: "asc" },
        }),
        prisma.invite.findMany({
          where: { companyId: operator.id, usedAt: null },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [[], []];

  const labelKeys: StringKey[] = [
    "team_invite", "team_invite_hint", "team_remove", "copy_link", "team_invite_expired",
    "copied", "aria_revoke_invite", "team_revoke_q", "team_revoke_yes", "team_remove_q", "cancel",
    "operator_email", "error_required", "error_limit_members",
    "error_owner_only", "save", "team_role", "team_role_member", "team_role_viewer", "team_role_hint",
  ];
  const labels = Object.fromEntries(labelKeys.map((k) => [k, t(locale, k)]));

  const row = { color: "var(--color-text-muted)" };

  // Notifications: phone/browser (Web Push) and email.
  const push = pushConfig();
  const notifyKeys: StringKey[] = [
    "notify_push", "notify_push_hint", "notify_push_on", "notify_push_turn_on", "notify_push_off",
    "notify_push_unsupported", "notify_push_ios", "notify_push_denied", "notify_push_failed",
    "notify_test", "notify_test_sent",
  ];
  const notifyLabels = Object.fromEntries(notifyKeys.map((k) => [k, t(locale, k)]));
  // A member: whose workspace this is.
  const company = isMember
    ? await prisma.operator.findUnique({ where: { id: operator.id }, select: { name: true, email: true } })
    : null;
  const workspace = await prisma.operator.findUnique({
    where: { id: operator.id },
    select: { notifyEmail: true, waPhoneNumberId: true, waTemplateName: true, waTemplateLocale: true, waDisplayPhone: true, waTokenSealed: true },
  });
  const notifyEmail = workspace?.notifyEmail ?? true;
  // The person's own address: confirmed or not (lib/auth/verify.ts).
  const emailVerified = await prisma.operator
    .findUnique({ where: { id: operator.userId }, select: { emailVerifiedAt: true } })
    .then((found) => found?.emailVerifiedAt != null);
  const waKeys: StringKey[] = [
    "wa_sender_connected", "wa_sender_none", "wa_sender_change", "wa_sender_connect", "wa_sender_id", "wa_sender_token",
    "wa_sender_token_keep", "wa_sender_template", "wa_sender_template_lang", "wa_sender_how", "wa_sender_check_save",
    "wa_sender_saved", "wa_sender_remove", "wa_sender_remove_q", "wa_sender_bad_id", "wa_sender_bad_template",
    "wa_sender_no_token", "wa_sender_broken", "wa_sender_rejected", "wa_sender_unreachable", "wa_sender_not_ready", "error_owner_only", "cancel",
  ];
  const waLabels = Object.fromEntries(waKeys.map((k) => [k, t(locale, k)]));

  return (
    <main>
      <h1>{t(locale, "settings_title")}</h1>

      {/* ── Account ── */}
      <section style={{ marginTop: 8 }}>
        <h2>{t(locale, "settings_account")}</h2>
        <div className="card" style={{ marginTop: 12, padding: 18, display: "grid", gap: 14 }}>
          <form action={updateProfileName} className="flex flex-wrap items-end gap-3">
            <label className="field" style={{ flex: 1, minWidth: 200 }}>
              {t(locale, "operator_name")}
              <input name="name" defaultValue={operator.name ?? ""} placeholder="Activo" />
            </label>
            <button type="submit" className="btn-secondary">{t(locale, "save")}</button>
          </form>
          {/* The workspace type chosen at sign-up — changeable here. */}
          <form action={updateWorkspaceProfile} className="flex flex-wrap items-end gap-3">
            <label className="field" style={{ flex: 1, minWidth: 200 }}>
              {t(locale, "settings_profile")}
              <select name="profile" defaultValue={operator.profile} disabled={isMember}>
                {WORKSPACE_PROFILES.map((value) => (
                  <option key={value} value={value}>
                    {t(locale, PROFILE_LABEL[value])}
                  </option>
                ))}
              </select>
              <span className="field-hint">
                {t(locale, isMember ? "settings_profile_member" : "settings_profile_hint")}
              </span>
            </label>
            {!isMember && (
              <button type="submit" className="btn-secondary">{t(locale, "save")}</button>
            )}
          </form>
          {saved === "profile" && (
            <p role="status" style={{ margin: 0 }}>
              <span className={`${badgeClass("good")} badge--icon`}>
                <IconCheck size={14} /> {t(locale, "settings_profile_saved")}
              </span>
            </p>
          )}
          {company && (
            <p className="field-hint" style={{ margin: 0 }}>
              {t(locale, "team_member_of").replace("{company}", company.name ?? company.email)}
              {operator.role === "viewer" && <> {t(locale, "team_viewer_note")}</>}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span style={row}>{t(locale, "operator_email")}</span>
            <span className="flex flex-wrap items-center justify-end gap-2">
              <strong>{operator.email}</strong>
              {emailConfigured() && !operator.isDemo && (
                emailVerified ? (
                  <span className={`${badgeClass("good")} badge--icon`}>
                    <IconCheck size={14} /> {t(locale, "verify_ok")}
                  </span>
                ) : (
                  <>
                    <span className={badgeClass("warn")}>{t(locale, "verify_no")}</span>
                    <VerifyEmailButton labels={securityLabels} />
                  </>
                )
              )}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span style={row}>{t(locale, "billing_current")}</span>
            <span className="flex flex-wrap items-center justify-end gap-2">
              <span className="badge badge--tag">{planLatin}</span>
              {!isMember && context.paidUntil && context.standing !== "complimentary" && (
                <span style={{ fontSize: 12, color: lapsed ? "var(--status-danger-text)" : "var(--color-text-muted)" }}>
                  {lapsed ? t(locale, "billing_expired_short") : t(locale, "billing_paid_until")}:{" "}
                  {fmtDate.format(context.paidUntil)}
                </span>
              )}
              {!isMember && (
                <Link href="/billing" className="btn-chip">
                  {t(locale, "nav_billing")}
                </Link>
              )}
            </span>
          </div>
        </div>
      </section>

      {/* ── Notifications: what needs the owner now, on the phone and by email ── */}
      <section id="notifications" style={{ marginTop: 20 }}>
        <h2>{t(locale, "notify_title")}</h2>
        <div className="card" style={{ marginTop: 12, padding: 18, display: "grid", gap: 16 }}>
          <p className="field-hint" style={{ margin: 0 }}>{t(locale, "notify_what")}</p>
          {push && !operator.isDemo ? (
            <PushDevice publicKey={push.publicKey} labels={notifyLabels} />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span style={row}>
                {t(locale, "notify_push")}
                <span className="field-hint" style={{ display: "block", margin: "2px 0 0" }}>
                  {t(locale, operator.isDemo ? "error_demo_readonly" : "notify_push_not_ready")}
                </span>
              </span>
            </div>
          )}
          {!isMember && (
          <form action={setNotifyEmail} className="flex flex-wrap items-center justify-between gap-3">
            <label style={{ ...row, display: "flex", gap: 10, alignItems: "flex-start", flex: 1, minWidth: 220 }}>
              <input type="checkbox" name="notifyEmail" defaultChecked={notifyEmail} disabled={operator.isDemo} style={{ marginTop: 3 }} />
              <span>
                {t(locale, "notify_email").replace("{email}", operator.email)}
                {!emailConfigured() && (
                  <span className="field-hint" style={{ display: "block", margin: "2px 0 0" }}>
                    {t(locale, "notify_email_not_ready")}
                  </span>
                )}
              </span>
            </label>
            {!operator.isDemo && (
              <button type="submit" className="btn-secondary">{t(locale, "save")}</button>
            )}
          </form>
          )}
        </div>
      </section>

      {/* ── The owner's own WhatsApp number for messages to renters ── */}
      {!isMember && (
        <section id="whatsapp" style={{ marginTop: 20 }}>
          <h2>{t(locale, "wa_sender_title")}</h2>
          <div className="card" style={{ marginTop: 12, padding: 18 }}>
            <p className="field-hint" style={{ margin: "0 0 12px" }}>{t(locale, "wa_sender_what")}</p>
            {operator.isDemo ? (
              <p className="field-hint" style={{ margin: 0 }}>{t(locale, "error_demo_readonly")}</p>
            ) : !secretsConfigured() ? (
              <p className="field-hint" style={{ margin: 0 }}>{t(locale, "wa_sender_not_ready")}</p>
            ) : (
              <WhatsAppSender
                connected={workspace?.waPhoneNumberId && workspace.waTokenSealed ? workspace.waDisplayPhone ?? "" : null}
                broken={!!(workspace?.waPhoneNumberId && workspace.waTokenSealed && !openSecret(workspace.waTokenSealed))}
                values={{
                  phoneNumberId: workspace?.waPhoneNumberId ?? "",
                  templateName: workspace?.waTemplateName ?? "",
                  templateLocale: workspace?.waTemplateLocale ?? "",
                }}
                labels={waLabels}
              />
            )}
          </div>
        </section>
      )}

      {/* ── Sign-in and security ── */}
      <section style={{ marginTop: 20 }}>
        <h2>{t(locale, "settings_security")}</h2>
        <div className="card" style={{ marginTop: 12, padding: 18, display: "grid", gap: 16 }}>
          <ChangePasswordForm labels={securityLabels} />
          <ChangeEmailForm labels={securityLabels} current={operator.email} />
          <form action={signOutOtherDevices} className="settings-form">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span style={row}>
                {t(locale, "sessions_other").replace("{n}", String(otherSessions))}
              </span>
              <button type="submit" className="btn-secondary" disabled={otherSessions === 0}>
                {t(locale, "sessions_signout_others")}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* ── Your data: a copy of it, and the way out ── */}
      <section style={{ marginTop: 20 }}>
        <h2>{t(locale, "settings_data")}</h2>
        <div className="card" style={{ marginTop: 12, padding: 18, display: "grid", gap: 16 }}>
          {!isMember && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span style={row}>
              {t(locale, "data_export")}
              <span className="field-hint" style={{ display: "block", margin: "2px 0 0" }}>
                {t(locale, "data_export_hint")}
              </span>
            </span>
            <a href="/settings/export" className="btn-secondary" download>
              {t(locale, "data_export_button")}
            </a>
          </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span style={row}>
              {t(locale, "activity_title")}
              <span className="field-hint" style={{ display: "block", margin: "2px 0 0" }}>
                {t(locale, "activity_lead")}
              </span>
            </span>
            <Link href="/activity" className="btn-secondary">{t(locale, "activity_open")}</Link>
          </div>
          {/* Activo's own administrator: the hand tools. */}
          {!operator.isDemo && isAdminEmail(operator.email) && (
            <div className="flex flex-wrap items-center gap-2">
              <span style={row}>{t(locale, "admin_tools")}</span>
              <Link href="/admin/accounts" className="btn-secondary">{t(locale, "admin_accounts_title")}</Link>
              <Link href="/admin/market" className="btn-secondary">{t(locale, "market_title")}</Link>
            </div>
          )}
          {!operator.isDemo && <DeleteAccountForm labels={securityLabels} />}
        </div>
      </section>

      {/* ── Team ── */}
      {context.isOwner && accountType === "business" && (
        <TeamSection
          members={members.map((m) => ({
            id: m.id, name: m.name, email: m.email, role: m.role,
          }))}
          invites={invites.map((invite) => ({
            id: invite.id, email: invite.email, token: invite.token,
            // An expired link no longer works and holds no seat: listed so the
            // owner sees what happened, without a link to copy.
            expired: !inviteUsable(invite, now),
          }))}
          heading={t(locale, "team_title")}
          membersHeading={t(locale, "team_members")}
          pendingHeading={t(locale, "team_pending")}
          labels={labels}
        />
      )}

      {/* ── Interface ── */}
      <section style={{ marginTop: 20 }}>
        <h2>{t(locale, "settings_interface")}</h2>
        <div className="card" style={{ marginTop: 12, padding: 18, display: "grid", gap: 14 }}>
          <div className="flex items-center justify-between gap-3">
            <span style={row}>
              {t(locale, "settings_language")}
              <span className="field-hint" style={{ display: "block", margin: "2px 0 0" }}>
                {t(locale, "settings_language_hint")}
              </span>
            </span>
            <form action={toggleLocale}>
              <input type="hidden" name="locale" value={other} />
              <button
                type="submit"
                className="btn-chip"
                aria-label={t(locale, "aria_language_switch")}
                title={t(locale, "aria_language_switch")}
              >
                {locale === "ka" ? "KA" : "EN"}
              </button>
            </form>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span style={row}>{t(locale, "settings_theme")}</span>
            <ThemeToggle label={t(locale, "aria_theme")} />
          </div>
        </div>
      </section>
    </main>
  );
}
