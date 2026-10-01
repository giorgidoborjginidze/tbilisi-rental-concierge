"use client";

import { useState } from "react";
import { IconCheck, IconCopy } from "@/app/icons";
import ConfirmAction from "@/app/confirm-action";
import { makeCalendarExport } from "@/lib/units/actions";

// The unit's own calendar for Airbnb and Booking.com: one address each
// (each leaves out the stays that channel sent itself), pasted into the
// channel's "import calendar". Created on first ask; "new link" retires the
// old address.
export default function CalendarExport({
  unitId,
  base,
  labels,
}: {
  unitId: string;
  /** The export URL without ?for=…, or null before one is made. */
  base: string | null;
  labels: Record<string, string>;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (value: string, key: string) =>
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(key);
        setTimeout(() => setCopied(null), 1600);
      },
      () => undefined,
    );

  if (!base) {
    return (
      <form action={async (data) => void (await makeCalendarExport(data))}>
        <input type="hidden" name="unitId" value={unitId} />
        <button type="submit" className="btn-secondary">{labels.cal_export_make}</button>
      </form>
    );
  }
  const rows = [
    { key: "airbnb", label: labels.cal_export_for_airbnb, url: `${base}?for=airbnb` },
    { key: "booking", label: labels.cal_export_for_booking, url: `${base}?for=booking` },
  ];
  return (
    <div className="gps-copy">
      {rows.map((row) => (
        <div key={row.key}>
          <span className="field-hint">{row.label}</span>
          <code>{row.url}</code>
          <button type="button" className="btn-chip" aria-label={row.label} onClick={() => copy(row.url, row.key)}>
            {copied === row.key ? <IconCheck size={16} /> : <IconCopy size={16} />}
          </button>
        </div>
      ))}
      <p className="field-hint" style={{ margin: 0 }}>{labels.cal_export_how}</p>
      <ConfirmAction
        action={makeCalendarExport}
        fields={{ unitId }}
        trigger={labels.cal_export_new}
        triggerClassName="btn-chip"
        question={labels.cal_export_new_q}
        confirmLabel={labels.cal_export_new}
        cancelLabel={labels.cancel}
        confirmClassName="btn-primary btn-compact"
      />
    </div>
  );
}
