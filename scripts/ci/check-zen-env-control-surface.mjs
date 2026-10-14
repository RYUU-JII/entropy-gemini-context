#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

const guardedFiles = Object.freeze([
  'src/themes/plugins/zen/widgets/signals/signalScanner/README.md',
  'src/themes/plugins/zen/widgets/signals/signalScanner/ZEN_POND_ARCHITECTURE.md',
  'src/themes/plugins/zen/pond/app/ZenKoiTunerPanel.jsx',
  'src/themes/plugins/zen/pond/tuner/koiTunerSchema.js',
  'src/themes/plugins/zen/pond/tuner/env/envPresetModel.js',
  'tests/themes/zenEnvWorkspaceVisibility.test.js',
]);

const legacyRootDocs = Object.freeze([
  'WATER_ENV_UNIFICATION_SPEC.md',
  'ZEN_POND_CAUSE_CHANNEL_MASTER_PLAN.md',
  'ZEN_POND_ENV_CONTROL_STRUCTURE_AUDIT.md',
  'ZEN_POND_PHASE0_BASELINE_REPORT_20260226.md',
  'ZEN_POND_PHASE1_3_PROGRESS_20260226.md',
  'ZEN_POND_PHASE4_5_PROGRESS_20260226.md',
  'ZEN_POND_PHASE6_PROGRESS_20260226.md',
  'ZEN_POND_PHASE7_PROGRESS_20260226.md',
  'ZEN_POND_REFACTOR_EXECUTION_SPEC.md',
  'ZEN_CONTROL_TAB_CANONICAL.md',
]);

const forbiddenMatchers = Object.freeze([
  {
    id: 'ENV_PRESETS',
    re: /\bENV_PRESETS\b/g,
    message: 'legacy preset path is forbidden in active env control surface.',
  },
  {
    id: 'REFRACTION_STYLE_PRESETS',
    re: /\bREFRACTION_STYLE_PRESETS\b/g,
    message: 'legacy preset path is forbidden in active env control surface.',
  },
  {
    id: 'ENV_WORKSPACE_MODES',
    re: /\bENV_WORKSPACE_MODES\b/g,
    message: 'workspace mode split is forbidden in canonical env UI.',
  },
  {
    id: 'resolveEnvVisibleSubTabs',
    re: /\bresolveEnvVisibleSubTabs\b/g,
    message: 'env subtab visibility splitter is forbidden in canonical env UI.',
  },
  {
    id: 'workspaceMode',
    re: /\bworkspaceMode\b/g,
    message: 'workspace mode token is forbidden in canonical env UI.',
  },
]);

const requiredCanonicalSnippets = Object.freeze([
  'cause -> derived channels -> authoritative frame bundle -> consumers',
  'Authoritative Frame Bundle',
  'Control Plane',
  'World Plane',
]);

const failures = [];

const absolute = (relativePath) => path.resolve(rootDir, relativePath);

const computeLine = (source, index) => {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source.charCodeAt(i) === 10) line += 1;
  }
  return line;
};

const collectMatches = (content, matcher) => {
  const matches = [];
  matcher.re.lastIndex = 0;
  let result = matcher.re.exec(content);
  while (result) {
    matches.push({
      line: computeLine(content, result.index),
    });
    result = matcher.re.exec(content);
  }
  matcher.re.lastIndex = 0;
  return matches;
};

const scanGuardedFile = async (relativePath) => {
  const abs = absolute(relativePath);
  let content;
  try {
    content = await fs.readFile(abs, 'utf8');
  } catch {
    failures.push(`${relativePath}: missing guarded file`);
    return;
  }

  forbiddenMatchers.forEach((matcher) => {
    const matches = collectMatches(content, matcher);
    matches.forEach(({ line }) => {
      failures.push(`${relativePath}:${line} ${matcher.id} -> ${matcher.message}`);
    });
  });
};

const assertLegacyRootDocsArchived = async () => {
  const rootDirPath = 'src/themes/plugins/zen/widgets/signals/signalScanner';
  for (const docName of legacyRootDocs) {
    const legacyPath = absolute(path.join(rootDirPath, docName));
    try {
      await fs.access(legacyPath);
      failures.push(`${path.join(rootDirPath, docName)}: legacy doc must be archived under archive/.`);
    } catch {
      // expected: missing in root
    }
  }
};

const assertCanonicalDocContent = async () => {
  const canonicalPath = 'src/themes/plugins/zen/widgets/signals/signalScanner/ZEN_POND_ARCHITECTURE.md';
  const abs = absolute(canonicalPath);
  let content;
  try {
    content = await fs.readFile(abs, 'utf8');
  } catch {
    failures.push(`${canonicalPath}: canonical doc is missing.`);
    return;
  }
  requiredCanonicalSnippets.forEach((snippet) => {
    if (!content.includes(snippet)) {
      failures.push(`${canonicalPath}: missing canonical snippet "${snippet}"`);
    }
  });
};

const main = async () => {
  await Promise.all(guardedFiles.map((file) => scanGuardedFile(file)));
  await assertLegacyRootDocsArchived();
  await assertCanonicalDocContent();

  if (failures.length > 0) {
    failures.forEach((failure) => {
      console.error(`[zen-env-control-surface] ${failure}`);
    });
    process.exit(1);
    return;
  }

  console.log(`[zen-env-control-surface] PASS: guarded env control surface matches the canonical pond architecture and archived docs stay non-canonical.`);
};

main().catch((error) => {
  console.error('[zen-env-control-surface] Unexpected error:', error);
  process.exit(1);
});
