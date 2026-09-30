// Small helpers shared by server actions and their forms.

/**
 * The text fields of a submitted form, to hand back with an error: React
 * resets a form after its action runs, so the form re-fills its fields from
 * these (as defaultValue) and nothing the owner typed is lost.
 */
export function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) values[key] = value;
  }
  return values;
}

type ActionResult = { error?: unknown; values?: Record<string, string>; ok?: boolean } | null;

/**
 * Wrap a form action so its result always carries what was typed after an
 * error (for actions that do not return it themselves), and reads as
 * `{ ok: true }` after a save that returned nothing — so the form can say
 * "saved". Client-side; the FormData is the one the browser submitted.
 */
export function keepingValues<S extends ActionResult>(
  action: (previous: S, formData: FormData) => Promise<S>,
): (previous: S, formData: FormData) => Promise<S> {
  return async (previous, formData) => {
    const result = await action(previous, formData);
    if (result == null) return { ok: true } as S;
    if (result.error && !result.values) return { ...result, values: submittedValues(formData) } as S;
    return result;
  };
}
