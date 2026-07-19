"use client";

import { useActionState, useState } from "react";
import { createInvite, removeMember, revokeInvite } from "@/lib/billing/actions";
import type { FormState } from "@/lib/units/actions";

export interface MemberRow {
  id: string;
  name: string;
  email: string;
  assets: number;
  units: number;
}

export interface InviteRow {
  id: string;
  email: string;
  token: string;
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
                    <td style={{ fontWeight: 400 }}>{invite.email}</td>
                    <td className="num">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button type="button" className="btn-chip" onClick={() => copy(invite)}>
                          {copied === invite.id ? "✓" : labels.copy_link}
                        </button>
                        <form action={revokeInvite}>
                          <input type="hidden" name="inviteId" value={invite.id} />
                          <button type="submit" className="btn-chip">✕</button>
                        </form>
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
                      {member.name}
                      <div className="cell-sub">{member.email}</div>
                    </td>
                    <td style={{ fontWeight: 400 }}>
                      {member.assets} {labels.billing_assets} · {member.units}{" "}
                      {labels.billing_units}
                    </td>
                    <td className="num">
                      <form action={removeMember}>
                        <input type="hidden" name="memberId" value={member.id} />
                        <button type="submit" className="btn-chip">
                          {labels.team_remove}
                        </button>
                      </form>
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
