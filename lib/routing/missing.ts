// Which record a detail URL points at, for proxy.ts: a page for an asset,
// unit or booking that does not exist (or belongs to another workspace)
// must answer with a real 404, and with the `loading.tsx` skeletons the
// page itself starts streaming as 200 before it can find out — so the check
// runs before the page, here. Pure parsing; the lookup is in proxy.ts.

export type DetailRecord = { kind: "asset" | "unit" | "booking"; id: string };

const ROUTES: { pattern: RegExp; kind: DetailRecord["kind"] }[] = [
  { pattern: /^\/assets\/([^/]+)\/(?:edit|rental)\/?$/, kind: "asset" },
  { pattern: /^\/units\/([^/]+)\/edit\/?$/, kind: "unit" },
  { pattern: /^\/bookings\/([^/]+)\/edit\/?$/, kind: "booking" },
];

export function detailRecord(pathname: string): DetailRecord | null {
  for (const { pattern, kind } of ROUTES) {
    const match = pattern.exec(pathname);
    if (match) {
      try {
        return { kind, id: decodeURIComponent(match[1]) };
      } catch {
        return { kind, id: match[1] };
      }
    }
  }
  return null;
}
