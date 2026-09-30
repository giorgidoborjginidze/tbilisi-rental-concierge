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
