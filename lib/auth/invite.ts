// Team invites (business plans): the link /register?invite=<token> is for
// the person it was made for. It works only with the invited email, only
// once, and only for INVITE_DAYS days — a forwarded or leaked link does not
// give a stranger a seat on the company's plan. Pure.

export const INVITE_DAYS = 7;

export interface InviteRow {
  email: string;
  usedAt: Date | null;
  createdAt: Date;
}

export type InviteProblem = "error_invite_invalid" | "error_invite_email";

/** When the invite stops working. */
export const inviteExpiresAt = (invite: Pick<InviteRow, "createdAt">): Date =>
  new Date(invite.createdAt.getTime() + INVITE_DAYS * 86_400_000);

/** Can this invite still be opened at all (unknown, used or expired → no)? */
export function inviteUsable(invite: InviteRow | null, now: Date): invite is InviteRow {
  return invite != null && invite.usedAt == null && now < inviteExpiresAt(invite);
}

/** Why registering `email` with this invite is refused, or null when it is fine. */
export function inviteProblem(invite: InviteRow | null, email: string, now: Date): InviteProblem | null {
  if (!inviteUsable(invite, now)) return "error_invite_invalid";
  if (invite.email.trim().toLowerCase() !== email.trim().toLowerCase()) return "error_invite_email";
  return null;
}
