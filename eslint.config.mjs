import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Emoji and Unicode pseudo-icons (🏠 🚗 🔑 ☀️ ✓ ✕ ✎ ☰ ◔ ◷ ⚑ ⧉ …) render
// differently on every phone and clash with the line-icon set. UI icons come
// from app/icons.tsx; this rule makes a new emoji in text or a string fail
// lint. Arrows (→ in "10 → 12 ₾"), the ₾ sign and × (multiplication) stay
// allowed — they are characters of the text, not icons. The circular
// arrows (↺ ↻ ⟲ ⟳) are only ever used as "restart/refresh" icons, so
// they are refused like emoji (IconRestart).
const PICTOGRAPH =
  "[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{2B00}-\\u{2BFF}\\u{25A0}-\\u{25FF}\\u{29C9}\\u{FE0F}\\u{21BA}\\u{21BB}\\u{27F2}\\u{27F3}]";
const NO_EMOJI_MESSAGE =
  "Use a line icon from app/icons.tsx instead of an emoji or pseudo-icon character.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    ignores: ["app/generated/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `JSXText[value=/${PICTOGRAPH}/u]`, message: NO_EMOJI_MESSAGE },
        { selector: `Literal[value=/${PICTOGRAPH}/u]`, message: NO_EMOJI_MESSAGE },
        { selector: `TemplateElement[value.raw=/${PICTOGRAPH}/u]`, message: NO_EMOJI_MESSAGE },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
