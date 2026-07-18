// Simple local job runner: runs the iCal sync on an interval (and, later,
// the alert scan). Start with `npm run scheduler`.

import "dotenv/config";
import { syncAllUnits } from "../lib/ical/run-sync";
import { scanAlerts } from "../lib/alerts/scan";

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

  try {
    const alerts = await scanAlerts();
    console.log(
      `[${startedAt}] alerts: +${alerts.created} created, ${alerts.skipped} already open`,
    );
  } catch (error) {
    console.error(`[${startedAt}] alert scan failed:`, error);
  }
}

console.log(`Scheduler started — syncing every ${intervalMinutes} min.`);
void tick();
setInterval(() => void tick(), intervalMinutes * 60 * 1000);
