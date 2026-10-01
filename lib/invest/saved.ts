// Kept PRO scenarios: what is stored (only the typed figures and the
// currency, cleaned), and the one-line summary a list or a comparison
// shows — recomputed from the figures, never stored. Pure.

import {
  analyzeWorthiness,
  WORTHINESS_DEFAULTS_GEL,
  type WorthinessCurrency,
  type WorthinessInputs,
} from "./worthiness";

export interface SavedScenario {
  inputs: WorthinessInputs;
  currency: WorthinessCurrency;
}

const NUMBER_KEYS = (Object.keys(WORTHINESS_DEFAULTS_GEL) as (keyof WorthinessInputs)[]).filter(
  (key) => typeof WORTHINESS_DEFAULTS_GEL[key] === "number",
);

/** Untrusted data (a form, a stored row) → a scenario with every figure in place. */
export function cleanScenario(raw: unknown): SavedScenario {
  const value = (raw ?? {}) as { inputs?: Record<string, unknown>; currency?: unknown };
  const given = value.inputs ?? {};
  const inputs = { ...WORTHINESS_DEFAULTS_GEL };
  for (const key of NUMBER_KEYS) {
    const n = Number(given[key]);
    if (Number.isFinite(n) && Math.abs(n) < 1e12) (inputs as Record<string, unknown>)[key] = n;
  }
  inputs.taxModel = given.taxModel === "profit" ? "profit" : "gross";
  return { inputs, currency: value.currency === "USD" ? "USD" : "GEL" };
}

export interface ScenarioSummary {
  verdict: "good" | "ok" | "poor";
  /** After-tax cash flow per month, year 1. */
  cashFlowMonth: number;
  cocPct: number;
  capRatePct: number;
  paybackYears: number | null;
  totalInvested: number;
}

export function summarize(scenario: SavedScenario): ScenarioSummary {
  const result = analyzeWorthiness(scenario.inputs);
  const y1 = result.years[0];
  return {
    verdict: result.verdict,
    cashFlowMonth: y1 ? y1.atCashFlow / 12 : 0,
    cocPct: y1?.atCocPct ?? 0,
    capRatePct: y1?.capRatePct ?? 0,
    paybackYears: result.paybackYears,
    totalInvested: result.totalInvested,
  };
}

/** How many scenarios one workspace keeps. */
export const MAX_SAVED = 50;
