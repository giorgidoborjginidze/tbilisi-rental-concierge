"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/admin";
import { loadGelRates } from "@/lib/fx/gel-rates";
import { aggregateListings, parseFigureLines, parseListings, type ParsedFigure } from "./parse";

export type AdminState = { ok?: string; error?: string } | null;

const str = (formData: FormData, key: string, max = 200) => String(formData.get(key) ?? "").trim().slice(0, max);
const PERIOD = /^20\d{2}-(0[1-9]|1[0-2])$/;

async function store(figures: ParsedFigure[], source: "report" | "listings", sourceName: string, period: string, note: string | null) {
  for (const figure of figures) {
    const where = { district_metric_period_source_sourceName: { district: figure.district, metric: figure.metric, period, source, sourceName } };
    await prisma.marketFigure.upsert({
      where,
      create: { ...figure, period, source, sourceName, note },
      update: { value: figure.value, sampleSize: figure.sampleSize, note },
    });
  }
  revalidatePath("/admin/market");
  revalidatePath("/invest");
  revalidatePath("/assets");
}

/** Figures from a published report, typed or pasted line by line. */
export async function saveReportFigures(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const sourceName = str(formData, "sourceName", 80);
  const period = str(formData, "period", 7);
  if (!sourceName) return { error: "market_err_source" };
  if (!PERIOD.test(period)) return { error: "market_err_period" };
  const { figures, badLines } = parseFigureLines(str(formData, "lines", 20_000));
  if (figures.length === 0) return { error: "market_err_lines" };
  await store(figures, "report", sourceName, period, str(formData, "note", 300) || null);
  return { ok: `${figures.length}${badLines.length ? ` · −${badLines.join(", ")}` : ""}` };
}

/** A listings export (CSV/TSV, pasted or uploaded): only district aggregates are kept. */
export async function importListings(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin();
  const sourceName = str(formData, "sourceName", 80) || "listings";
  const period = str(formData, "period", 7);
  if (!PERIOD.test(period)) return { error: "market_err_period" };
  const file = formData.get("file");
  const text =
    file instanceof File && file.size > 0
      ? file.size > 5 * 1024 * 1024
        ? null
        : await file.text()
      : str(formData, "csv", 2_000_000);
  if (!text) return { error: "market_err_file" };
  const { listings, skipped, missing } = parseListings(text, await loadGelRates());
  if (missing.length) return { error: "market_err_columns" };
  const figures = aggregateListings(listings);
  if (figures.length === 0) return { error: "market_err_few" };
  await store(figures, "listings", sourceName, period, `${listings.length} listings, ${skipped} skipped`);
  return { ok: `${figures.length} · ${listings.length} / ${listings.length + skipped}` };
}

export async function deleteFigure(formData: FormData) {
  await requireAdmin();
  await prisma.marketFigure.deleteMany({ where: { id: str(formData, "id", 40), source: { in: ["report", "listings"] } } });
  revalidatePath("/admin/market");
  revalidatePath("/invest");
  revalidatePath("/assets");
}
