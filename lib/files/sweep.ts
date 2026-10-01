// The daily clean-up of the file store: bytes whose row is gone — a file
// deleted in the app (after its undo window), an asset or a whole account
// deleted — are removed. Files younger than an hour are left alone (an
// upload still saving its row).

import { prisma } from "@/lib/db";
import { fileStore, type FileStore } from "./store";

export const SWEEP_GRACE_MS = 3_600_000;

export async function sweepOrphanFiles(now: Date = new Date(), store: FileStore | null = fileStore()): Promise<number> {
  if (!store) return 0;
  const stored = await store.list("op/");
  const old = stored.filter((file) => now.getTime() - file.uploadedAt.getTime() > SWEEP_GRACE_MS);
  if (old.length === 0) return 0;
  const kept = new Set<string>();
  for (let i = 0; i < old.length; i += 500) {
    const rows = await prisma.attachment.findMany({
      where: { pathname: { in: old.slice(i, i + 500).map((file) => file.pathname) } },
      select: { pathname: true },
    });
    for (const row of rows) kept.add(row.pathname);
  }
  const orphans = old.filter((file) => !kept.has(file.pathname)).map((file) => file.pathname);
  for (let i = 0; i < orphans.length; i += 500) await store.del(orphans.slice(i, i + 500));
  return orphans.length;
}
