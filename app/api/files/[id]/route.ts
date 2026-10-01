import { prisma } from "@/lib/db";
import { getSessionOperator } from "@/lib/auth/session";
import { fileStore } from "@/lib/files/store";
import { disposition, isKeptType, isViewableImage } from "@/lib/files/rules";

// Opens one of the owner's files — only for the account that keeps it.
// ?download=1 saves it instead of showing it.
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const operator = await getSessionOperator();
  if (!operator) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const row = await prisma.attachment.findFirst({ where: { id, operatorId: operator.id } });
  const store = fileStore();
  if (!row || !store) return new Response("Not found", { status: 404 });
  const file = await store.get(row.pathname).catch(() => null);
  if (!file) return new Response("Not found", { status: 404 });

  // Only the kept types are ever served as themselves; anything else (a
  // row written before the checks) only downloads, as plain bytes.
  const kept = isKeptType(row.contentType);
  const contentType = kept ? row.contentType : "application/octet-stream";
  const download = new URL(request.url).searchParams.get("download") === "1";
  const inline = kept && !download && (isViewableImage(contentType) || contentType === "application/pdf");
  return new Response(file.stream, {
    headers: {
      "Content-Type": contentType,
      // A shown photo can run nothing on activo.world.
      ...(isViewableImage(contentType) ? { "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox" } : {}),
      "Content-Length": String(file.size),
      "Content-Disposition": disposition(row.name, inline),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
