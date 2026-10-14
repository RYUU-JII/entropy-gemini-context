#!/usr/bin/env node

/**
 * Line-budget gate.
 *
 * Purpose: surface *accretion* — files and functions that quietly grow past a
 * size a human would have split. It is intentionally advisory, not a hard cut,
 * because a hard cap blocks legitimate feature work and invites agents to
 * "fix" the guard instead of the code. Design choices:
 *
 * - Warn-oriented. Default exit code is 0. `--strict` fails ONLY on new or
 *   grown file-level violations, never on pre-existing debt.
 * - Role-aware. i18n/config data and dev-only labs are exempt; renderers/models
 *   get a generous budget; domain/app logic gets the tight one (where accretion
 *   actually hurts).
 * - Density-aware. A long-but-flat file (data table, big switch) is a quiet
 *   NOTE; only a file that is long AND structurally dense (control-flow heavy)
 *   is a loud WARN. This is the same philosophy as `enforceSoftModuleBudget`:
 *   size alone is not the crime, size plus ownership/complexity risk is.
 * - Ratchet baseline. Existing over-budget files are recorded once and stay
 *   quiet. Only NEW over-budget files or files that GREW past their baseline
 *   are flagged — that regression is the real signal. `--update-baseline`
 *   rewrites it as an explicit, reviewable act.
 *
 * Function-level measurement is a best-effort heuristic (JS only) and is always
 * advisory — it never affects the exit code.
 *
 * Flags:
 *   --strict           exit 1 on new/grown file-level WARN violations
 *   --update-baseline  rewrite the baseline from the current tree
 *   --all              also list quiet known-debt entries
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { analyzeModuleStructure, countNonEmptyLines } from './architectureGuardUtils.mjs';

const rootDir = process.cwd();
const configPath = path.resolve(rootDir, 'scripts/ci/quality-gate.config.json');
const scanDir = path.resolve(rootDir, 'src');

const args = new Set(process.argv.slice(2));
const isStrict = args.has('--strict');
const isUpdateBaseline = args.has('--update-baseline');
const showAll = args.has('--all');

const readJson = async (targetPath) => JSON.parse(await fs.readFile(targetPath, 'utf8'));

const toPosix = (relPath) => relPath.split(path.sep).join('/');

const walkFiles = async (dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const entryPath = path.resolve(dirPath, entry.name);
    if (entry.isDirectory()) return walkFiles(entryPath);
    return Promise.resolve([entryPath]);
  }));
  return nested.flat();
};

const resolveRole = (relPath, roles) => {
  for (const role of roles) {
    if ((role.match ?? []).some((needle) => relPath.includes(needle))) return role;
  }
  return null;
};

/**
 * Best-effort longest-function line span for .js files. Strips block/line
 * comments and quoted strings so braces inside them do not skew depth, then
 * matches function-body openers and measures until the body closes. Imperfect
 * by design (advisory only); JSX is skipped because its expression braces make
 * the heuristic unreliable.
 */
const FUNCTION_OPENER = /(?:\bfunction\b[^;{]*\)\s*\{|\)\s*=>\s*\{|=>\s*\{|^\s*(?:export\s+)?(?:async\s+)?(?:get\s+|set\s+|static\s+)*[\w$]+\s*\([^;=]*\)\s*\{)/;

const sanitizeLine = (line, state) => {
  let out = '';
  let i = 0;
  while (i < line.length) {
    if (state.inBlockComment) {
      const end = line.indexOf('*/', i);
      if (end === -1) return out;
      state.inBlockComment = false;
      i = end + 2;
      continue;
    }
    const two = line.slice(i, i + 2);
    if (two === '//') return out;
    if (two === '/*') { state.inBlockComment = true; i += 2; continue; }
    const ch = line[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i += 1;
      while (i < line.length && line[i] !== ch) {
        if (line[i] === '\\') i += 1;
        i += 1;
      }
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
};

/**
 * Returns the largest function "self size" — a function's own body lines
 * excluding the bodies of functions nested inside it. This deliberately ignores
 * module-wrapping IIFEs and factory closures (whose self size is tiny once their
 * many child functions are subtracted) and surfaces only a single function that
 * is itself doing too much, which is the real accretion signal.
 */
const longestFunctionSpan = (source) => {
  const lines = source.split(/\r?\n/u);
  const state = { inBlockComment: false };
  const stack = [];
  let depth = 0;
  let maxSelf = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const clean = sanitizeLine(lines[i], state);
    const opens = (clean.match(/\{/gu) || []).length;
    const closes = (clean.match(/\}/gu) || []).length;
    const depthBefore = depth;
    if (FUNCTION_OPENER.test(clean) && opens > closes) {
      stack.push({ startLine: i, openDepth: depthBefore, childLines: 0 });
    }
    depth += opens - closes;
    while (stack.length && depth <= stack[stack.length - 1].openDepth) {
      const frame = stack.pop();
      const span = i - frame.startLine + 1;
      const self = span - frame.childLines;
      if (self > maxSelf) maxSelf = self;
      if (stack.length) stack[stack.length - 1].childLines += span;
    }
  }
  return maxSelf;
};

const main = async () => {
  let config;
  try {
    config = await readJson(configPath);
  } catch (error) {
    console.error(`[line-budget] Failed to read config: ${configPath}`);
    console.error(`[line-budget] ${error?.message || error}`);
    process.exit(1);
    return;
  }

  const settings = config?.lineBudget;
  if (!settings || !Array.isArray(settings.roles)) {
    console.error('[line-budget] Missing "lineBudget" config block.');
    process.exit(1);
    return;
  }

  const baselinePath = path.resolve(rootDir, settings.baselinePath ?? 'scripts/ci/line-budget.baseline.json');
  const drift = Number(settings.driftAllowance ?? 0);
  const nearPct = Number(settings.warnNearBudgetPct ?? 0.85);
  const densityCfg = settings.density ?? {};
  const cfCap = Number(densityCfg.controlFlowTokens ?? Infinity);
  const fnCap = Number(densityCfg.topLevelFunctions ?? Infinity);

  let baseline = {};
  try {
    baseline = await readJson(baselinePath);
  } catch {
    baseline = {};
  }

  const filePaths = (await walkFiles(scanDir))
    .filter((filePath) => /\.(?:js|jsx)$/u.test(filePath));

  const overBudget = [];   // file-level over budget (WARN or NOTE)
  const longFns = [];      // advisory function-level hints
  const nextBaseline = {};
  let scanned = 0;
  let exemptCount = 0;
  let nearCount = 0;

  for (const filePath of filePaths) {
    const relPath = toPosix(path.relative(rootDir, filePath));
    const role = resolveRole(relPath, settings.roles);
    if (!role) continue;
    scanned += 1;
    if (role.exempt) { exemptCount += 1; continue; }

    const source = await fs.readFile(filePath, 'utf8');
    const lines = countNonEmptyLines(source);
    const structure = analyzeModuleStructure(source);

    const fileBudget = Number(role.fileLines ?? Infinity);
    const fnBudget = Number(role.functionLines ?? Infinity);
    const over = lines > fileBudget;
    const dense = structure.controlFlowTokens >= cfCap
      || structure.topLevelFunctionDeclarations >= fnCap;

    if (over) {
      nextBaseline[relPath] = lines;
      const baselineLines = Number(baseline[relPath]);
      let status = 'KNOWN';
      if (!Number.isFinite(baselineLines)) status = 'NEW';
      else if (lines > baselineLines + drift) status = 'GREW';
      overBudget.push({
        relPath, roleId: role.id, lines, fileBudget, dense, status,
        controlFlow: structure.controlFlowTokens,
        topFns: structure.topLevelFunctionDeclarations,
        baselineLines: Number.isFinite(baselineLines) ? baselineLines : null,
      });
    } else if (lines >= fileBudget * nearPct) {
      nearCount += 1;
    }

    // Function-level advisory (JS only; JSX braces are too noisy to trust).
    if (relPath.endsWith('.js') && Number.isFinite(fnBudget)) {
      const span = longestFunctionSpan(source);
      if (span > fnBudget) longFns.push({ relPath, roleId: role.id, span, fnBudget });
    }
  }

  if (isUpdateBaseline) {
    const sorted = Object.fromEntries(Object.entries(nextBaseline).sort(([a], [b]) => a.localeCompare(b)));
    await fs.writeFile(baselinePath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
    console.log(`[line-budget] Baseline updated: ${toPosix(path.relative(rootDir, baselinePath))} (${Object.keys(sorted).length} entries)`);
    return;
  }

  const budgetSummary = settings.roles
    .filter((role) => !role.exempt)
    .map((role) => `${role.id}<=${role.fileLines}`)
    .join(' ');
  console.log(`[line-budget] scanned ${scanned} files under src (${exemptCount} exempt) | file budgets: ${budgetSummary} lines`);

  const loud = overBudget.filter((e) => e.dense && (e.status === 'NEW' || e.status === 'GREW'));
  const notes = overBudget.filter((e) => !e.dense && (e.status === 'NEW' || e.status === 'GREW'));
  const knownDebt = overBudget.filter((e) => e.status === 'KNOWN');

  const describe = (e) => {
    const delta = `+${e.lines - e.fileBudget}`;
    const grew = e.status === 'GREW' && e.baselineLines != null ? ` was=${e.baselineLines}` : '';
    return `${e.status.padEnd(4)} ${e.relPath} — ${e.lines} lines (${e.roleId} budget ${e.fileBudget}, ${delta})${grew} cf=${e.controlFlow} fns=${e.topFns}`;
  };

  if (loud.length) {
    console.warn('[line-budget] WARN — new/grown files that are long AND structurally dense (split candidates):');
    loud.sort((a, b) => (b.lines - b.fileBudget) - (a.lines - a.fileBudget))
      .forEach((e) => console.warn(`  ${describe(e)}`));
  }

  if (notes.length) {
    console.log('[line-budget] NOTE — new/grown but structurally flat (likely data/table, low priority):');
    notes.sort((a, b) => (b.lines - b.fileBudget) - (a.lines - a.fileBudget))
      .forEach((e) => console.log(`  ${describe(e)}`));
  }

  if (longFns.length) {
    console.log('[line-budget] advisory — longest single function over budget (~approx, JS only):');
    longFns.sort((a, b) => (b.span - b.fnBudget) - (a.span - a.fnBudget)).slice(0, 20)
      .forEach((e) => console.log(`  ~${e.span} lines  ${e.relPath} (${e.roleId} fn budget ${e.fnBudget})`));
    if (longFns.length > 20) console.log(`  … and ${longFns.length - 20} more`);
  }

  if (knownDebt.length) {
    if (showAll) {
      console.log(`[line-budget] known debt held in baseline (${knownDebt.length}):`);
      knownDebt.sort((a, b) => b.lines - a.lines).forEach((e) => console.log(`  ${describe(e)}`));
    } else {
      console.log(`[line-budget] known debt: ${knownDebt.length} files over budget held quiet in baseline (use --all to list, --update-baseline to accept changes)`);
    }
  }

  const regressions = loud.length + notes.length;
  console.log(
    `[line-budget] summary: ${loud.length} dense warnings, ${notes.length} flat notes, `
    + `${longFns.length} long-function hints, ${nearCount} near-budget, ${knownDebt.length} known-debt.`,
  );

  if (isStrict && loud.length > 0) {
    console.error(`[line-budget] FAIL (--strict): ${loud.length} new/grown dense file(s) over budget. Split them or run --update-baseline to accept.`);
    process.exit(1);
    return;
  }

  if (regressions === 0) {
    console.log('[line-budget] PASS: no new or grown budget regressions.');
  } else {
    console.log('[line-budget] PASS (advisory): regressions reported above; exit 0. Use --strict to gate.');
  }
};

main().catch((error) => {
  console.error('[line-budget] Unexpected error:', error);
  process.exit(1);
});
