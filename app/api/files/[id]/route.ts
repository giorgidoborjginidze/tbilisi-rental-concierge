import { prisma } from "@/lib/db";
import { getSessionOperator } from "@/lib/auth/session";
import { fileStore } from "@/lib/files/store";
import { disposition, isViewableImage } from "@/lib/files/rules";

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

  const download = new URL(request.url).searchParams.get("download") === "1";
  const inline = !download && (isViewableImage(row.contentType) || row.contentType === "application/pdf");
  return new Response(file.stream, {
    headers: {
      "Content-Type": row.contentType,
      "Content-Length": String(file.size),
      "Content-Disposition": disposition(row.name, inline),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
