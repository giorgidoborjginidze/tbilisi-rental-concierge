// A spreadsheet file (CSV) that Excel and Google Sheets open as they are:
// UTF-8 with a byte-order mark (Georgian letters survive Excel), commas,
// CRLF lines, quotes where needed. Text that would start a formula
// (= + - @) gets a leading apostrophe, so a driver's name typed as
// "=HYPERLINK(...)" is never run by the spreadsheet. Pure.

export type CsvValue = string | number | null | undefined;

export function csvCell(value: CsvValue): string {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: CsvValue[][]): string {
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
