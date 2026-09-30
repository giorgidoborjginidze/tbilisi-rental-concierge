import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { LIVE_CONTRACT } from "./live";

// A deleted contract (soft delete) must never be read as a contract: every
// query of RentalContract rows carries LIVE_CONTRACT. This walks app/ and
// lib/ and checks each place a contract query starts. A query that must see
// deleted rows too says so with an `all-contracts:` comment just above it.

const ROOT = join(__dirname, "..", "..");
const DIRS = ["app", "lib"];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === "generated" || name === "node_modules") continue;
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

// Where a read of contract rows starts: a direct read/count/bulk update, a
// nested include/select/count of an asset's contracts, or a relation filter.
const STARTS = [
  /rentalContract\.(findMany|findFirst|findUnique|count|aggregate|groupBy|updateMany)\(/,
  /\bcontracts: \{/,
  /\bcontracts: true\b/,
];

describe("deleted contracts are left out everywhere", () => {
  it("LIVE_CONTRACT filters on deletedAt", () => {
    expect(LIVE_CONTRACT).toEqual({ deletedAt: null });
  });

  it("every contract query in app/ and lib/ carries LIVE_CONTRACT (or says why not)", () => {
    const missing: string[] = [];
    for (const dir of DIRS) {
      for (const file of sourceFiles(join(ROOT, dir))) {
        const lines = readFileSync(file, "utf8").split("\n");
        lines.forEach((line, i) => {
          if (line.trimStart().startsWith("//") || line.trimStart().startsWith("*")) return;
          if (!STARTS.some((pattern) => pattern.test(line))) return;
          // A findUnique by id right after a filtered read is not a new read.
          const window = lines.slice(i, i + 6).join("\n");
          const before = lines.slice(Math.max(0, i - 3), i).join("\n");
          if (/LIVE_CONTRACT|deletedAt/.test(window) || /all-contracts:/.test(before)) return;
          missing.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
        });
      }
    }
    expect(missing).toEqual([]);
  });
});
