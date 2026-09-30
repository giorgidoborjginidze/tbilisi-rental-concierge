"use client";

import { useActionState, useState } from "react";
import { createInvite, removeMember, revokeInvite } from "@/lib/billing/actions";
import type { FormState } from "@/lib/units/actions";
import { IconCheck, IconClose, IconCopy } from "../icons";
import ConfirmAction from "../confirm-action";

export interface MemberRow {
  id: string;
  name: string | null;
  email: string;
  assets: number;
  units: number;
}

export interface InviteRow {
  id: string;
  email: string;
  token: string;
  /** Past its 7 days: the link no longer works and holds no seat. */
  expired?: boolean;
}

export default function TeamSection({
  members,
  invites,
  heading,
  membersHeading,
  pendingHeading,
  labels,
}: {
  members: MemberRow[];
  invites: InviteRow[];
  heading: string;
  membersHeading: string;
  pendingHeading: string;
  labels: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    createInvite,
    null,
  );
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (invite: InviteRow) => {
    const url = `${window.location.origin}/register?invite=${invite.token}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(invite.id);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <section>
      <h2>{heading}</h2>

      <form
        action={formAction}
        className="card form-grid form-grid--full"
        style={{ padding: 18, overflow: "visible", maxWidth: 560 }}
      >
        <label className="field">
          {labels.operator_email}
          <input name="email" type="email" required placeholder="employee@company.ge" />
        </label>
        <div className="field" style={{ justifyContent: "flex-end" }}>
          <button type="submit" disabled={pending} className="btn-primary">
            {labels.team_invite}
          </button>
        </div>
        <span className="hint col-span-2">{labels.team_invite_hint}</span>
        {state?.error && (
          <p className="col-span-2" style={{ color: "var(--status-danger-text)", fontSize: 13 }}>
            {labels[state.error] ?? state.error}
          </p>
        )}
      </form>

      {invites.length > 0 && (
        <>
          <h2 style={{ marginTop: 24 }}>{pendingHeading}</h2>
          <div className="card">
            <table>
              <tbody>
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td style={{ fontWeight: 400 }}>
                      {invite.email}
                      {invite.expired && (
                        <div className="cell-sub">
                          <span className="badge badge--muted">{labels.team_invite_expired}</span>
                        </div>
                      )}
                    </td>
                    <td className="num">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {!invite.expired && (
                          <button type="button" className="btn-chip btn-chip--icon-text" onClick={() => copy(invite)}>
                            {copied === invite.id ? <IconCheck size={15} /> : <IconCopy size={15} />}
                            {copied === invite.id ? labels.copied : labels.copy_link}
                          </button>
                        )}
                        <ConfirmAction
                          action={revokeInvite}
                          fields={{ inviteId: invite.id }}
                          trigger={<IconClose size={15} />}
                          triggerClassName="btn-chip btn-chip--icon"
                          ariaLabel={labels.aria_revoke_invite}
                          question={labels.team_revoke_q.replace("{email}", invite.email)}
                          confirmLabel={labels.team_revoke_yes}
                          cancelLabel={labels.cancel}
                          inline
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {members.length > 0 && (
        <>
          <h2 style={{ marginTop: 24 }}>{membersHeading}</h2>
          <div className="card">
            <table>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      {member.name ?? member.email}
                      <div className="cell-sub">{member.email}</div>
                    </td>
                    <td style={{ fontWeight: 400 }}>
                      {member.assets} {labels.billing_assets} · {member.units}{" "}
                      {labels.billing_units}
                    </td>
                    <td className="num">
                      <ConfirmAction
                        action={removeMember}
                        fields={{ memberId: member.id }}
                        trigger={labels.team_remove}
                        triggerClassName="btn-chip"
                        question={labels.team_remove_q.replace("{name}", member.name ?? member.email)}
                        confirmLabel={labels.team_remove}
                        cancelLabel={labels.cancel}
                        inline
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
