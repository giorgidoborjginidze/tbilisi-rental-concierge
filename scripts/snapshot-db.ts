// A database snapshot right before a production deploy changes the schema
// (run by scripts/prepare-db.mjs before `prisma db push`). Skips without
// NEON_API_KEY; never fails the deploy — the push itself refuses anything
// destructive, this is the extra way back.
import { snapshotDatabase } from "../lib/backup/neon-snapshot";

const sha = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7);
const outcome = await snapshotDatabase(sha ? `deploy-${sha}` : "deploy");
if (outcome.status === "created") {
  console.log(`[snapshot-db] created ${outcome.name}${outcome.deleted.length ? `, removed ${outcome.deleted.join(", ")}` : ""}`);
} else if (outcome.status === "skipped") {
  console.log("[snapshot-db] skipped: NEON_API_KEY or the Neon project id is not set");
} else {
  console.warn(`[snapshot-db] could not snapshot: ${outcome.error}`);
}
