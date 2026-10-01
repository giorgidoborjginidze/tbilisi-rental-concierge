// Database backups on Neon: a fresh snapshot of the production branch every
// morning (the daily run, lib/automation/run.ts) and right before a deploy
// changes the schema (scripts/snapshot-db.ts, from scripts/prepare-db.mjs).
//
// Neon's own instant restore only reaches back 6 hours on the free plan, and
// the free plan keeps a single manual snapshot with no schedule — so the job
// rotates: it creates a new snapshot and, when the plan's limit refuses
// that, deletes the oldest snapshot it made itself and tries again. On a
// paid plan the last KEEP snapshots stay. Only snapshots named with PREFIX
// are ever deleted; one an owner made by hand in the Neon console is left
// alone (and then, on the free plan, the job reports that it could not
// snapshot instead of removing it).
//
// Needs NEON_API_KEY (Neon console → Account or Organization settings →
// API keys) and the project id, which the Vercel–Neon integration already
// sets as DATABASE_NEON_PROJECT_ID. Without them it skips quietly.

export const PREFIX = "activo-auto-";
export const KEEP = 7;
const API = "https://console.neon.tech/api/v2";

export interface Snapshot {
  id: string;
  name: string;
  created_at: string;
}

export type SnapshotOutcome =
  | { status: "skipped"; reason: "not_configured" }
  | { status: "created"; name: string; deleted: string[] }
  | { status: "failed"; error: string };

export interface NeonApi {
  defaultBranchId(): Promise<string>;
  list(): Promise<Snapshot[]>;
  create(branchId: string, name: string): Promise<{ ok: true } | { ok: false; limit: boolean; error: string }>;
  remove(id: string): Promise<void>;
}

export function neonConfig(env: Record<string, string | undefined> = process.env) {
  const apiKey = env.NEON_API_KEY?.trim();
  const projectId = (env.NEON_PROJECT_ID || env.DATABASE_NEON_PROJECT_ID)?.trim();
  return apiKey && projectId ? { apiKey, projectId } : null;
}

export function httpNeonApi(apiKey: string, projectId: string, fetchImpl: typeof fetch = fetch): NeonApi {
  const call = async (path: string, init: RequestInit = {}) =>
    fetchImpl(`${API}/projects/${projectId}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
  const fail = async (res: Response) => `${res.status} ${(await res.text()).slice(0, 200)}`;
  return {
    async defaultBranchId() {
      const res = await call("/branches");
      if (!res.ok) throw new Error(`list branches: ${await fail(res)}`);
      const { branches } = (await res.json()) as { branches: { id: string; default?: boolean }[] };
      const branch = branches.find((b) => b.default) ?? branches[0];
      if (!branch) throw new Error("no branch");
      return branch.id;
    },
    async list() {
      const res = await call("/snapshots");
      if (!res.ok) throw new Error(`list snapshots: ${await fail(res)}`);
      return ((await res.json()) as { snapshots?: Snapshot[] }).snapshots ?? [];
    },
    async create(branchId, name) {
      const res = await call(`/branches/${branchId}/snapshot?name=${encodeURIComponent(name)}`, { method: "POST" });
      if (res.ok) return { ok: true };
      const error = await fail(res);
      return { ok: false, limit: res.status === 422 && /limit/i.test(error), error };
    },
    async remove(id) {
      const res = await call(`/snapshots/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error(`delete snapshot: ${await fail(res)}`);
    },
  };
}

/** The job's own snapshots, oldest first. */
export function ownSnapshots(all: Snapshot[]): Snapshot[] {
  return all
    .filter((s) => s.name.startsWith(PREFIX))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** e.g. activo-auto-daily-2026-10-01T0400 — unique per minute, sortable. */
export function snapshotName(label: string, now: Date): string {
  const stamp = now.toISOString().slice(0, 16).replace(/:/g, "");
  return `${PREFIX}${label}-${stamp}`;
}

export async function rotateSnapshot(api: NeonApi, label: string, now: Date = new Date()): Promise<SnapshotOutcome> {
  try {
    const branchId = await api.defaultBranchId();
    const name = snapshotName(label, now);
    const own = ownSnapshots(await api.list());
    const deleted: string[] = [];

    let attempt = await api.create(branchId, name);
    // The plan's snapshot limit: make room by dropping our oldest, one at a
    // time, never anyone else's.
    while (!attempt.ok && attempt.limit && own.length > 0) {
      const oldest = own.shift()!;
      await api.remove(oldest.id);
      deleted.push(oldest.name);
      attempt = await api.create(branchId, name);
    }
    if (!attempt.ok) return { status: "failed", error: attempt.error };

    // Paid plans: keep the newest KEEP of ours (the new one included).
    const after = ownSnapshots(await api.list());
    for (const extra of after.slice(0, Math.max(0, after.length - KEEP))) {
      await api.remove(extra.id);
      deleted.push(extra.name);
    }
    return { status: "created", name, deleted };
  } catch (error) {
    return { status: "failed", error: (error instanceof Error ? error.message : String(error)).slice(0, 200) };
  }
}

/** The whole job with the environment's settings; skips without them. */
export async function snapshotDatabase(label: string, now: Date = new Date()): Promise<SnapshotOutcome> {
  const config = neonConfig();
  if (!config) return { status: "skipped", reason: "not_configured" };
  return rotateSnapshot(httpNeonApi(config.apiKey, config.projectId), label, now);
}
