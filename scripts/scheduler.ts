// Simple local job runner: runs the iCal sync on an interval (and, later,
// the alert scan). Start with `npm run scheduler`.

import "dotenv/config";
import { syncAllUnits } from "../lib/ical/run-sync";

const intervalMinutes = Number(process.env.SYNC_INTERVAL_MINUTES ?? 60);

async function tick() {
  const startedAt = new Date().toISOString();
  try {
    const results = await syncAllUnits();
    const created = results.reduce((sum, r) => sum + r.created, 0);
    const updated = results.reduce((sum, r) => sum + r.updated, 0);
    const errors = results.filter((r) => r.error);
    console.log(
      `[${startedAt}] sync: ${results.length} feeds, +${created} created, ~${updated} updated, ${errors.length} errors`,
    );
    for (const feed of errors) {
      console.warn(`  ! ${feed.unitName} ${feed.url}: ${feed.error}`);
    }
  } catch (error) {
    console.error(`[${startedAt}] sync failed:`, error);
  }
}

console.log(`Scheduler started — syncing every ${intervalMinutes} min.`);
void tick();
setInterval(() => void tick(), intervalMinutes * 60 * 1000);
