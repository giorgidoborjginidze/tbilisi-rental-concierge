import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// The two-language dictionary (lib/i18n/strings.ts, ~130 KB) belongs on the
// server: a client component that imports it ships every string of both
// languages to every page. Client components get their words as props
// (TabBar, Tour, SupportBot …). Type-only imports are fine — they vanish.

const ROOT = join(__dirname, "..", "..");

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === "generated" || name === "node_modules") continue;
    if (statSync(path).isDirectory()) out.push(...files(path));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

describe("the dictionary stays on the server", () => {
  it("no client component imports lib/i18n/strings for its values", () => {
    const offenders: string[] = [];
    for (const file of files(join(ROOT, "app"))) {
      const source = readFileSync(file, "utf8");
      if (!/^\s*["']use client["']/.test(source)) continue;
      const imports = source.match(/import\s+(type\s+)?\{[^}]*\}\s+from\s+["']@\/lib\/i18n\/(strings|locale)["']/g) ?? [];
      for (const line of imports) {
        const typeOnly = /^import\s+type\b/.test(line) || /\{\s*(type\s+\w+\s*,?\s*)+\}/.test(line);
        if (!typeOnly) offenders.push(`${relative(ROOT, file)}: ${line.replace(/\s+/g, " ")}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
