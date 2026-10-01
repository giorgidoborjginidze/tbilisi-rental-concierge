// What an owner may keep with an asset or a unit, and how it is named in
// the store. Pure, client-safe (the upload button checks the same limits
// before sending).
//
// The file's real type is read from its first bytes, never taken from the
// browser's word for it: only photos (JPEG, PNG, WebP, HEIC) and PDFs are
// kept, so nothing that could run as a page in the app's origin is served.

export const FILE_KINDS = ["photo", "document", "receipt"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export const asFileKind = (value: unknown, fallback: FileKind): FileKind =>
  (FILE_KINDS as readonly unknown[]).includes(value) ? (value as FileKind) : fallback;

/** One file: under the 4.5 MB a request may carry, with room for the form. */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
/** All of one account's files together. */
export const ACCOUNT_QUOTA_BYTES = 100 * 1024 * 1024;
/** Files on one asset or unit. */
export const MAX_FILES_PER_PLACE = 200;

/** Photos are shrunk in the browser to this longest side before upload. */
export const PHOTO_MAX_SIDE = 1800;

export const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

const EXTENSION: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "application/pdf": ".pdf",
};

const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.subarray(from, to));

/** The type the bytes really are, or null when it is not one we keep. */
export function sniffType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === "PNG") return "image/png";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  if (ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";
  if (ascii(bytes, 4, 8) === "ftyp" && /^(heic|heix|hevc|mif1|msf1)$/.test(ascii(bytes, 8, 12))) {
    // The first box's own size, a small big-endian number in a real HEIC —
    // never text such as "<!--" put in front of something else.
    const box = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
    return box >= 16 && box <= 4096 ? "image/heic" : null;
  }
  return null;
}

/** The only types ever kept and served. */
export const KEPT_TYPES: readonly string[] = Object.keys(EXTENSION);
export const isKeptType = (contentType: string) => KEPT_TYPES.includes(contentType);

/** The type a stored file has, read from its own path (storePath). */
export function typeOfPath(pathname: string): string | null {
  const ext = pathname.slice(pathname.lastIndexOf("."));
  return Object.entries(EXTENSION).find(([, e]) => e === ext)?.[0] ?? null;
}

export const isImage = (contentType: string) => contentType.startsWith("image/");
/** What a browser shows by itself (HEIC mostly is not: it downloads). */
export const isViewableImage = (contentType: string) => isImage(contentType) && contentType !== "image/heic";

/** The file's own name, safe to show and to send back in a header. */
export function cleanName(raw: string | null | undefined, contentType: string): string {
  const base = String(raw ?? "")
    .split(/[\\/]/)
    .pop()!
    .replace(/[\u0000-\u001f\u007f"<>|]/g, "")
    .trim()
    .slice(0, 120);
  return base || `file${EXTENSION[contentType] ?? ""}`;
}

/** Where it lives in the store: the account's folder and a random name. */
export function storePath(operatorId: string, id: string, contentType: string): string {
  return `op/${operatorId}/${id}${EXTENSION[contentType] ?? ""}`;
}

/** "1.4 MB", "820 KB". */
export function formatBytes(bytes: number, locale: "ka" | "en" = "ka"): string {
  const mb = locale === "ka" ? "მბ" : "MB";
  const kb = locale === "ka" ? "კბ" : "KB";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} ${mb}`;
  return `${Math.max(1, Math.round(bytes / 1024))} ${kb}`;
}

/** Content-Disposition with the name in UTF-8 (Georgian names survive). */
export function disposition(name: string, inline: boolean): string {
  const fallback = name.replace(/[^\x20-\x7e]/g, "_").replace(/[%;\\]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
