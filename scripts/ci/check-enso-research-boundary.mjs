import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ENSO_RESEARCH_DIRECTORY,
  ENSO_RESEARCH_SOURCE_FILES,
} from '../dev/enso-model-research/researchBoundaryContract.mjs';

const root = process.cwd();
const researchOwners = new Set(ENSO_RESEARCH_SOURCE_FILES);
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);
const failures = [];

async function walk(folder) {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory()
    ? walk(path.join(folder, entry.name)) : [path.join(folder, entry.name)]))).flat();
}

for (const owner of researchOwners) await fs.access(path.join(root, owner));
for (const absolute of await walk(path.join(root, 'src'))) {
  if (!sourceExtensions.has(path.extname(absolute))) continue;
  const file = path.relative(root, absolute).replaceAll('\\', '/');
  if (researchOwners.has(file)) continue;
  const source = await fs.readFile(absolute, 'utf8');
  // Covers static imports, re-exports, literal dynamic imports and require.
  // Blocking every incoming edge from active src also blocks transitive paths,
  // regardless of which dev/public bundler entrypoint reaches the importer.
  const imports = source.matchAll(/(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"]([^'"]+)['"]/g);
  for (const [, specifier] of imports) {
    const resolved = specifier.startsWith('@/')
      ? `src/${specifier.slice(2)}`
      : path.relative(root, path.resolve(path.dirname(absolute), specifier)).replaceAll('\\', '/');
    if (researchOwners.has(resolved) || resolved.startsWith(ENSO_RESEARCH_DIRECTORY)) {
      failures.push(`${file} imports research-only owner ${resolved}`);
    }
  }
}

const kernelFiles = [
  'src/apps/background/services/runtime/backgroundKernelCoreServices.js',
  'src/apps/background/services/runtime/BackgroundMessageRouter.js',
];
for (const file of kernelFiles) {
  const source = await fs.readFile(path.join(root, file), 'utf8');
  if (/feedTempoPersistentProfileService|createFeedTempoProfileMessageRoutes|FeedTempoProfileCheckpointRepository/.test(source)) {
    failures.push(`${file} restores a production tempo collector or checkpoint writer`);
  }
}

if (failures.length) {
  console.error(`[enso-research-boundary] FAIL:\n${failures.map((failure) => `- ${failure}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`[enso-research-boundary] PASS: ${researchOwners.size} research owners are unreachable from active source imports; no production tempo writer.`);
}
