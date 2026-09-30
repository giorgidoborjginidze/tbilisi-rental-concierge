"use client";

import { useActionState } from "react";
import { syncCalendars, type SyncState } from "@/lib/bookings/actions";

// "Sync Calendars" with an answer: how many calendars synced, what changed,
// and how many failed (the reasons are listed per unit on the page).
export default function SyncButton({ labels }: { labels: Record<string, string> }) {
  const [state, action, pending] = useActionState<SyncState, FormData>(syncCalendars, null);

  let message: string | null = null;
  if (state) {
    message =
      state.feeds === 0
        ? state.demo > 0
          ? labels.sync_demo
          : labels.sync_none
        : labels.sync_done
            .replace("{feeds}", String(state.feeds))
            .replace("{created}", String(state.created))
            .replace("{updated}", String(state.updated))
            .replace("{cancelled}", String(state.cancelled));
    if (state.errors > 0) message += ` ${labels.sync_done_errors.replace("{errors}", String(state.errors))}`;
  }

  return (
    <form action={action} className="sync-form">
      <button type="submit" className="btn-secondary" disabled={pending} aria-busy={pending}>
        {pending ? labels.sync_running : labels.sync_now}
      </button>
      {message && (
        <p className="sync-result" role="status" data-state={state && state.errors > 0 ? "warn" : "ok"}>
          {message}
        </p>
      )}
    </form>
  );
}
