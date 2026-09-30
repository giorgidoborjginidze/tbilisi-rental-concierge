// URL query values arrive as a string, an array (?unit=a&unit=b) or
// nothing. Pages take the first value only, so a repeated parameter never
// reaches a database query as an array (a 500 before). Client-safe, pure.

export type QueryValue = string | string[] | undefined;

export function firstParam(value: QueryValue): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first === undefined || first === "" ? undefined : first;
}
