#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const failures = [];

const requiredFiles = Object.freeze({
  profile: 'src/themes/core/profile.js',
  toolsVisualPolicy: 'src/themes/core/toolsVisualPolicy.js',
  sceneRuntime: 'src/apps/dashboard/tabs/tools/components/sceneRuntime.js',
  artifactGallery: 'src/apps/dashboard/tabs/tools/components/ArtifactGallery.jsx',
});

const forbiddenFiles = Object.freeze([
  'src/apps/dashboard/tabs/tools/components/ArsenalGallery.jsx',
]);

const sourceRoots = Object.freeze([
  'src/themes/core/profile.js',
  'src/themes/core/toolsVisualPolicy.js',
  'src/themes/core/sceneSpecs',
  'src/apps/dashboard/tabs/tools/components',
]);

const forbiddenPatterns = Object.freeze([
  {
    re: /\bartifactOffset\s*:/,
    message: 'legacy scene field `artifactOffset` is forbidden; use `sceneSpec.artifacts.*.offset`.',
  },
  {
    re: /\bgroundOffset\s*:/,
    message: 'legacy scene field `groundOffset` is forbidden; use `sceneSpec.anchors/groundLayout`.',
  },
  {
    re: /\banchorUnit\b/,
    message: 'legacy anchor unit switching is forbidden; runtime anchors are pixel-space only.',
  },
  {
    re: /\banchorX\s*:/,
    message: 'legacy `anchorX` field is forbidden; use `policy.anchor.x` from runtime.',
  },
  {
    re: /\banchorY\s*:/,
    message: 'legacy `anchorY` field is forbidden; use `policy.anchor.y` from runtime.',
  },
  {
    re: /\bscene\s*:\s*Object\.freeze\(/,
    message: 'legacy `scene` policy object is forbidden; use `sceneSpec`.',
  },
  {
    re: /\bArsenalGallery\b/,
    message: 'legacy name `ArsenalGallery` is forbidden; use `ArtifactGallery`.',
  },
]);

const requiredPatterns = Object.freeze([
  {
    file: requiredFiles.toolsVisualPolicy,
    re: /sceneSpec\s*:/,
    message: '`sceneSpec` must exist in tools visual policy.',
  },
  {
    file: requiredFiles.toolsVisualPolicy,
    re: /sceneSpecs\/index\.js/,
    message: '`toolsVisualPolicy.js` must import scene specs from `sceneSpecs/index.js`.',
  },
  {
    file: requiredFiles.artifactGallery,
    re: /resolveArtifactGallerySceneRuntime\(/,
    message: '`ArtifactGallery` must resolve scene runtime via `resolveArtifactGallerySceneRuntime(...)`.',
  },
  {
    file: requiredFiles.sceneRuntime,
    re: /warnSceneSpecOnce\(/,
    message: '`sceneRuntime` must keep validator warning guard (`warnSceneSpecOnce`).',
  },
]);

const absolute = (relativePath) => path.resolve(rootDir, relativePath);

const readUtf8 = async (relativePath) => (
  fs.readFile(absolute(relativePath), 'utf8')
);

const addFailure = (msg) => {
  failures.push(msg);
};

const ensureRequiredFiles = async () => {
  await Promise.all(Object.entries(requiredFiles).map(async ([label, relativePath]) => {
    try {
      await fs.access(absolute(relativePath));
    } catch {
      addFailure(`missing required file (${label}): ${relativePath}`);
    }
  }));
};

const ensureForbiddenFilesAbsent = async () => {
  await Promise.all(forbiddenFiles.map(async (relativePath) => {
    try {
      await fs.access(absolute(relativePath));
      addFailure(`forbidden legacy file exists: ${relativePath}`);
    } catch {
      // expected: does not exist
    }
  }));
};

const walkFiles = async (targetPath) => {
  const abs = absolute(targetPath);
  const stat = await fs.stat(abs);
  if (stat.isFile()) return [targetPath];

  const entries = await fs.readdir(abs, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const relative = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkFiles(relative);
      results.push(...nested);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(js|jsx|mjs|ts|tsx)$/.test(entry.name)) continue;
    results.push(relative);
  }
  return results;
};

const checkForbiddenPatterns = async () => {
  const rootFiles = await Promise.all(sourceRoots.map((entry) => walkFiles(entry)));
  const files = rootFiles.flat();

  await Promise.all(files.map(async (file) => {
    const content = await readUtf8(file);
    forbiddenPatterns.forEach(({ re, message }) => {
      if (re.test(content)) {
        addFailure(`${file}: ${message}`);
      }
    });
  }));
};

const checkRequiredPatterns = async () => {
  await Promise.all(requiredPatterns.map(async ({ file, re, message }) => {
    try {
      const content = await readUtf8(file);
      if (!re.test(content)) {
        addFailure(`${file}: ${message}`);
      }
    } catch {
      addFailure(`${file}: could not read file for required pattern check.`);
    }
  }));
};

const main = async () => {
  await ensureRequiredFiles();
  await ensureForbiddenFilesAbsent();
  await checkForbiddenPatterns();
  await checkRequiredPatterns();

  if (failures.length > 0) {
    failures.forEach((msg) => console.error(`[tools-scene-normalization] ${msg}`));
    process.exit(1);
    return;
  }

  console.log('[tools-scene-normalization] PASS: scene normalization guards are satisfied.');
};

main().catch((error) => {
  console.error('[tools-scene-normalization] Unexpected error:', error);
  process.exit(1);
});
