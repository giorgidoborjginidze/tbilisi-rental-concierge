import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionOperator, readOnlyOperator } from "@/lib/auth/session";
import { fileStore } from "@/lib/files/store";
import {
  ACCOUNT_QUOTA_BYTES,
  asFileKind,
  cleanName,
  isImage,
  MAX_FILE_BYTES,
  MAX_FILES_PER_PLACE,
  sniffType,
  storePath,
} from "@/lib/files/rules";

// Upload one file to an asset or a unit (multipart: file, assetId | unitId,
// kind). The session cookie is SameSite=Lax, so another site cannot post
// here as the owner; the Origin check below refuses it as well.
export const dynamic = "force-dynamic";

const refuse = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return refuse("files_failed", 403);

  const operator = await getSessionOperator();
  if (!operator) return refuse("files_failed", 401);
  if (readOnlyOperator(operator)) return refuse("error_demo_readonly", 403);
  const store = fileStore();
  if (!store) return refuse("files_not_ready", 503);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return refuse("error_required", 400);
  if (file.size > MAX_FILE_BYTES) return refuse("files_too_big", 413);

  const assetId = String(form.get("assetId") ?? "") || null;
  const unitId = assetId ? null : String(form.get("unitId") ?? "") || null;
  const owned = assetId
    ? await prisma.asset.count({ where: { id: assetId, operatorId: operator.id } })
    : unitId
      ? await prisma.unit.count({ where: { id: unitId, operatorId: operator.id } })
      : 0;
  if (!owned) return refuse("files_failed", 404);

  const [onPlace, used] = await Promise.all([
    prisma.attachment.count({ where: assetId ? { assetId } : { unitId } }),
    prisma.attachment.aggregate({ where: { operatorId: operator.id }, _sum: { size: true } }),
  ]);
  if (onPlace >= MAX_FILES_PER_PLACE) return refuse("files_too_many", 409);
  if ((used._sum.size ?? 0) + file.size > ACCOUNT_QUOTA_BYTES) return refuse("files_quota", 409);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffType(bytes);
  if (!contentType) return refuse("files_bad_type", 415);

  const pathname = storePath(operator.id, randomUUID(), contentType);
  try {
    await store.put(pathname, Buffer.from(bytes), contentType);
  } catch (error) {
    console.error("[files] upload failed:", error instanceof Error ? error.message : "error");
    return refuse("files_failed", 502);
  }
  // A row that fails to save leaves an orphan file: the daily sweep removes it.
  const row = await prisma.attachment.create({
    data: {
      operatorId: operator.id,
      assetId,
      unitId,
      kind: asFileKind(form.get("kind"), isImage(contentType) ? "photo" : "document"),
      name: cleanName(file.name, contentType),
      contentType,
      size: bytes.length,
      pathname,
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: row.id });
}
