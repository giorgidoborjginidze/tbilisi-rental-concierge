// The night-by-night suggestions as a CSV table the owner copies into a
// channel or a sheet. Pure.

// Text that would start a spreadsheet formula (= + - @) gets a leading
// apostrophe, as in lib/fleet/csv.ts: a reason written by the AI from a unit
// name like "=HYPERLINK(…)" is shown, never run.
const cell = (value: string | number) => {
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** With a byte-order mark, so spreadsheet apps read Georgian text as UTF-8. */
export function suggestionsCsv(
  header: [string, string, string, string],
  rows: { date: string; price: number; currency: string; reason: string }[],
): string {
  const lines = [header.map(cell).join(",")];
  for (const row of rows) lines.push([row.date, row.price, row.currency, row.reason].map(cell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
