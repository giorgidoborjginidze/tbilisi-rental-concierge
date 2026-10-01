// The night-by-night suggestions as a CSV table the owner copies into a
// channel or a sheet. Pure.

const cell = (value: string | number) => {
  const text = String(value);
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
