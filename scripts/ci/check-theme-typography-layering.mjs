#!/usr/bin/env node

/**
 * Theme typography layering contract.
 *
 * Typography resolves through three layers:
 *   L1  themes/styles/tokens/typography.css  --font-sans/-mono/-serif/-heading/-ui
 *       App base. Theme-neutral. The only faces actually shipped as @font-face.
 *   L2  themes/core/utils.js                 --font-theme-heading/-ui/-mono/-serif
 *       Projected from each theme's `tokens.typography`.
 *   L3  Tailwind font-* utilities            consume L2.
 *
 * A theme's `tokens.typography` block in plugins/<id>/theme.js is the ONE
 * sanctioned bridge from L1 to L2. Everything else in a theme must read L2.
 *
 * This guard exists because a `[data-theme='x'] .font-mono { font-family:
 * var(--font-mono) }` rule outranks the Tailwind utility (0,2,0 vs 0,1,0) and
 * silently pins that theme to L1 — making its own typography tokens dead
 * config that no amount of editing can change.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();
const violations = [];

const LAYER_1_VARS = Object.freeze(['sans', 'mono', 'serif', 'heading', 'ui']);
const LAYER_1_PATTERN = new RegExp(
  String.raw`var\(\s*--font-(${LAYER_1_VARS.join('|')})\b`,
  'u',
);
const LAYER_1_FONT_FAMILY_PATTERN = new RegExp(
  String.raw`font-family:\s*var\(\s*--font-(${LAYER_1_VARS.join('|')})\b`,
  'u',
);

/**
 * Font families named in theme tokens but NOT shipped as @font-face.
 * Each entry renders only where the OS happens to have it, so it is an
 * accepted per-machine variance, not a guarantee. Adding a name here is a
 * deliberate decision: either ship the woff2 or accept the variance.
 *
 * Exit condition: self-host the face, then remove it from this list.
 */
const ACCEPTED_UNSHIPPED_FACES = Object.freeze(new Set([
  // matrix / scp / cyberpunk theme-identity faces are now self-hosted (see
  // the "THEME-IDENTITY FACES" @font-face block in typography.css) and no
  // longer belong in this list.
  // Locale stacks (installed via OS/user font packs).
  'Pretendard Variable',
  'Pretendard',
  'Noto Sans KR',
  'Noto Serif KR',
  'Apple SD Gothic Neo',
  'Malgun Gothic',
  'Segoe UI',
  'Georgia',
  'Batang',
  'Iowan Old Style',
]));

const CATEGORY_OF = Object.freeze({
  ui: 'ui',
  sans: 'ui',
  heading: 'heading',
  mono: 'mono',
  serif: 'serif',
});

const readSource = (relativePath) => fs.readFile(
  path.resolve(rootDir, relativePath),
  'utf8',
);

const walk = async (dir, filter) => {
  const found = [];
  let entries;
  try {
    entries = await fs.readdir(path.resolve(rootDir, dir), { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...await walk(rel, filter));
    } else if (filter(entry.name)) {
      found.push(rel);
    }
  }
  return found;
};

const isSourceFile = (name) => /\.(?:js|jsx|css)$/u.test(name);

// ── Rule A: theme plugins must read L2, not L1 ────────────────────────────
const pluginFiles = await walk('src/themes/plugins', isSourceFile);

for (const relativePath of pluginFiles) {
  const source = await readSource(relativePath);
  const isThemeTokenFile = /\/theme\.js$/u.test(relativePath);
  const lines = source.split('\n');

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (!LAYER_1_PATTERN.test(line)) return;

    if (isThemeTokenFile) {
      // Inside theme.js, L1 is legal only in the tokens.typography bridge.
      // A `font-family:` prefix means it is theme-scoped CSS instead.
      if (LAYER_1_FONT_FAMILY_PATTERN.test(line)) {
        violations.push(
          `${relativePath}:${lineNumber}: theme-scoped CSS must use var(--font-theme-*), not the app-base layer. `
          + 'A [data-theme] rule outranks the Tailwind utility and would make this theme\'s typography tokens dead config.',
        );
      }
      return;
    }

    violations.push(
      `${relativePath}:${lineNumber}: theme plugin code must read var(--font-theme-*). `
      + 'Only tokens.typography in theme.js may reference the app-base --font-* layer.',
    );
  });
}

// ── Rule B: fallback chains must stay within one font category ────────────
const chainScanRoots = ['src/themes', 'src/domains', 'src/apps'];
const CHAIN_PATTERN = new RegExp(
  String.raw`var\(\s*--font-theme-(heading|ui|mono|serif)\s*,\s*var\(\s*--font-(${LAYER_1_VARS.join('|')})\b`,
  'gu',
);

for (const root of chainScanRoots) {
  const files = await walk(root, isSourceFile);
  for (const relativePath of files) {
    const source = await readSource(relativePath);
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      for (const match of line.matchAll(CHAIN_PATTERN)) {
        const [, themeCategory, baseVar] = match;
        const baseCategory = CATEGORY_OF[baseVar];
        const themeNormalized = themeCategory === 'heading' ? 'heading' : themeCategory;
        const compatible = themeNormalized === baseCategory
          // heading legitimately degrades to the ui/sans family.
          || (themeNormalized === 'heading' && baseCategory === 'ui');
        if (!compatible) {
          violations.push(
            `${relativePath}:${index + 1}: --font-theme-${themeCategory} must not fall back to --font-${baseVar} `
            + '(cross-category font substitution). Match the fallback to the primary token\'s category.',
          );
        }
      }
    });
  }
}

// ── Rule C: declared faces must be shipped or explicitly accepted ─────────
const shippedFaces = new Set();
const typographyCssPath = 'src/themes/styles/tokens/typography.css';
const typographyCss = await readSource(typographyCssPath);
for (const match of typographyCss.matchAll(/@font-face\s*\{[^}]*?font-family:\s*['"]([^'"]+)['"]/gu)) {
  shippedFaces.add(match[1]);
}
if (shippedFaces.size === 0) {
  violations.push(`${typographyCssPath}: no @font-face declarations found; the shipped-face set cannot be verified.`);
}

const themeFiles = pluginFiles.filter((p) => /\/theme\.js$/u.test(p));
for (const relativePath of [...themeFiles, typographyCssPath, 'src/themes/core/boot/presentationCatalog.js']) {
  const source = await readSource(relativePath);
  const lines = source.split('\n');
  lines.forEach((line, index) => {
    if (!/font|Font/u.test(line)) return;
    for (const match of line.matchAll(/['"]([A-Z][A-Za-z0-9 ]{2,})['"]/gu)) {
      const face = match[1];
      if (shippedFaces.has(face) || ACCEPTED_UNSHIPPED_FACES.has(face)) continue;
      // Only flag names that sit in an actual font declaration.
      if (!/font-family|fontFamily|Font:|heading:|body:|mono:|serif:|calligraphy:/u.test(line)) continue;
      violations.push(
        `${relativePath}:${index + 1}: font face "${face}" is neither shipped via @font-face nor listed in `
        + 'ACCEPTED_UNSHIPPED_FACES. Ship the woff2 or record the accepted variance.',
      );
    }
  });
}

if (violations.length > 0) {
  console.error('[theme-typography-layering] Contract violation detected:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(
  '[theme-typography-layering] PASS: themes read the projected --font-theme-* layer, '
  + 'fallback chains stay within one font category, and every declared face is shipped or explicitly accepted.',
);
