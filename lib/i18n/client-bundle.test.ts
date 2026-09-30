import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// The two-language dictionary (lib/i18n/strings.ts, ~130 KB) belongs on the
// server: a client component that reaches it — directly, through a relative
// path, a default or namespace import, or through a client-safe lib module
// that imports it — ships every string of both languages to every page.
// Client components get their words as props (TabBar, Tour, SupportBot …).
//
// This walks the real import graph from every "use client" file: "@/" and
// relative specifiers are resolved, type-only imports and exports are
// skipped (they vanish at build), and a "use server" module ends the walk
// (a client only gets a reference to its actions, not its code).
// `import "server-only"` is not used instead because the tsx scripts
// (scheduler, repair, seed) import strings.ts transitively.

const ROOT = join(__dirname, "..", "..");
const DICTIONARY = join(ROOT, "lib", "i18n", "strings.ts");

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

const directive = (source: string, name: string) =>
  new RegExp(`^(?:\\s|//[^\\n]*\\n|/\\*[\\s\\S]*?\\*/)*["']${name}["']`).test(source);

const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".mjs", "/index.ts", "/index.tsx"];

/** A project file for an "@/" or relative specifier; null for packages. */
function resolve(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(ROOT, specifier.slice(2));
  else if (specifier.startsWith(".")) base = join(dirname(from), specifier);
  else return null;
  for (const ext of EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** The specifiers a module imports for their values (what the bundle keeps). */
export function valueImports(fileName: string, source: string): string[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const typeOnly =
        clause != null &&
        (clause.isTypeOnly ||
          (!clause.name &&
            clause.namedBindings != null &&
            ts.isNamedImports(clause.namedBindings) &&
            clause.namedBindings.elements.length > 0 &&
            clause.namedBindings.elements.every((element) => element.isTypeOnly)));
      if (!typeOnly) out.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const typeOnly =
        node.isTypeOnly ||
        (node.exportClause != null &&
          ts.isNamedExports(node.exportClause) &&
          node.exportClause.elements.length > 0 &&
          node.exportClause.elements.every((element) => element.isTypeOnly));
      if (!typeOnly) out.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      out.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** The import chain from `entry` to the dictionary, or null when it is not reachable. */
function pathToDictionary(entry: string, cache: Map<string, string>): string[] | null {
  const seen = new Set<string>([entry]);
  const queue: string[][] = [[entry]];
  while (queue.length) {
    const chain = queue.shift()!;
    const file = chain[chain.length - 1];
    let source = cache.get(file);
    if (source == null) {
      source = readFileSync(file, "utf8");
      cache.set(file, source);
    }
    // A server-actions module: the client gets references, not its code.
    if (file !== entry && directive(source, "use server")) continue;
    for (const specifier of valueImports(file, source)) {
      const next = resolve(file, specifier);
      if (!next || seen.has(next)) continue;
      if (next === DICTIONARY) return [...chain, next];
      seen.add(next);
      queue.push([...chain, next]);
    }
  }
  return null;
}

describe("the dictionary stays on the server", () => {
  it("no client component reaches lib/i18n/strings through its value imports", () => {
    const cache = new Map<string, string>();
    const offenders: string[] = [];
    for (const file of [...files(join(ROOT, "app")), ...files(join(ROOT, "lib"))]) {
      const source = readFileSync(file, "utf8");
      if (!directive(source, "use client")) continue;
      const chain = pathToDictionary(file, cache);
      if (chain) offenders.push(chain.map((step) => relative(ROOT, step)).join(" -> "));
    }
    expect(offenders).toEqual([]);
  });

  it("sees every kind of value import and skips type-only ones", () => {
    const source = `
      import type { Locale } from "@/lib/i18n/strings";
      import { type StringKey } from "@/lib/i18n/strings";
      import strings from "../lib/i18n/strings";
      import * as all from "@/lib/a";
      import { t, type Locale as L } from "@/lib/b";
      export { x } from "./c";
      export type { Y } from "./d";
      import "./side-effect";
      const later = () => import("./lazy");
    `;
    expect(valueImports("x.tsx", source)).toEqual([
      "../lib/i18n/strings",
      "@/lib/a",
      "@/lib/b",
      "./c",
      "./side-effect",
      "./lazy",
    ]);
  });
});
