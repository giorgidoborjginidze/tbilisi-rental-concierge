"use server";

// Deleting a file, with its 10-second undo. The row goes at once; the bytes
// stay in the store until the daily sweep (lib/files/sweep.ts) finds them
// without a row, so the undo can simply put the row back.

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity/log";
import { requireWriter } from "@/lib/auth/session";
import { asFileKind, cleanName, MAX_FILE_BYTES, typeOfPath } from "./rules";

const pageOf = (row: { assetId: string | null; unitId: string | null }) =>
  row.assetId ? `/assets/${row.assetId}` : `/units/${row.unitId}/edit`;

export async function deleteAttachment(formData: FormData): Promise<{ undo: Record<string, string> } | null> {
  const operator = await requireWriter();
  const id = String(formData.get("id") ?? "");
  const row = await prisma.attachment.findFirst({ where: { id, operatorId: operator.id } });
  if (!row) return null;
  await prisma.attachment.delete({ where: { id: row.id } });
  await logActivity(operator, "file.delete", { id: row.id, label: row.name });
  revalidatePath(pageOf(row), "layout");
  return {
    undo: {
      snapshot: JSON.stringify({
        assetId: row.assetId, unitId: row.unitId, kind: row.kind, name: row.name,
        contentType: row.contentType, size: row.size, pathname: row.pathname,
      }),
    },
  };
}

export async function restoreAttachment(formData: FormData): Promise<boolean> {
  const operator = await requireWriter();
  let snap: Record<string, unknown>;
  try {
    snap = JSON.parse(String(formData.get("snapshot") ?? ""));
  } catch {
    return false;
  }
  const pathname = String(snap.pathname ?? "");
  // Only this account's own files, and only once.
  if (!pathname.startsWith(`op/${operator.id}/`)) return false;
  if (await prisma.attachment.count({ where: { pathname } })) return false;
  const assetId = typeof snap.assetId === "string" ? snap.assetId : null;
  const unitId = assetId ? null : typeof snap.unitId === "string" ? snap.unitId : null;
  const owned = assetId
    ? await prisma.asset.count({ where: { id: assetId, operatorId: operator.id } })
    : unitId
      ? await prisma.unit.count({ where: { id: unitId, operatorId: operator.id } })
      : 0;
  if (!owned) return false;
  // The type and size come from what was stored, never from the snapshot
  // the browser sends back: a restored file cannot be re-labelled as
  // something that would run as a page (an SVG, HTML).
  const contentType = typeOfPath(pathname);
  if (!contentType) return false;
  await prisma.attachment.create({
    data: {
      operatorId: operator.id,
      assetId,
      unitId,
      kind: asFileKind(snap.kind, "document"),
      name: cleanName(String(snap.name ?? ""), contentType),
      contentType,
      size: Math.min(MAX_FILE_BYTES, Math.max(0, Math.round(Number(snap.size) || 0))),
      pathname,
    },
  });
  revalidatePath(pageOf({ assetId, unitId }), "layout");
  return true;
}

export async function setAttachmentKind(formData: FormData) {
  const operator = await requireWriter();
  const id = String(formData.get("id") ?? "");
  const row = await prisma.attachment.findFirst({ where: { id, operatorId: operator.id } });
  if (!row) return;
  await prisma.attachment.update({ where: { id }, data: { kind: asFileKind(formData.get("kind"), row.kind as never) } });
  revalidatePath(pageOf(row), "layout");
}
