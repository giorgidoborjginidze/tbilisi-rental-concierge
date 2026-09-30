import { describe, expect, it } from "vitest";
import { keepingValues, submittedValues } from "./forms";

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
};

describe("forms keep what was typed", () => {
  it("submittedValues keeps text fields and drops React's action fields", () => {
    expect(submittedValues(form({ name: "Vake flat", $ACTION_ID_1: "x" }))).toEqual({ name: "Vake flat" });
  });

  it("an error gets the typed values; a silent save reads as ok", async () => {
    type S = { error?: string; values?: Record<string, string>; ok?: boolean } | null;
    const failing = keepingValues<S>(async () => ({ error: "error_required" }));
    expect(await failing(null, form({ amount: "12" }))).toEqual({
      error: "error_required",
      values: { amount: "12" },
    });
    const saving = keepingValues<S>(async () => null);
    expect(await saving(null, form({}))).toEqual({ ok: true });
    const own = keepingValues<S>(async () => ({ error: "x", values: { a: "1" } }));
    expect(await own(null, form({ a: "2" }))).toEqual({ error: "x", values: { a: "1" } });
  });
});
