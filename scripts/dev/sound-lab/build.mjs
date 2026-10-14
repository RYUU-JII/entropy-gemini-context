import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createSoundWorkspace } from './workspace/soundWorkspace.js';

export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const BROWSER_ROOT = fileURLToPath(new URL('./browser/', import.meta.url));

export async function computeSourceRevision(inputs) {
  const hash = createHash('sha256');
  for (const input of [...inputs].sort()) {
    hash.update(input).update('\0').update(await readFile(resolve(REPO_ROOT, input))).update('\0');
  }
  return hash.digest('hex');
}

export async function buildSoundLab() {
  const targets = createSoundWorkspace();
  const result = await build({
    absWorkingDir: REPO_ROOT, entryPoints: ['scripts/dev/sound-lab/browser/src/main.js'],
    bundle: true, format: 'iife', write: false, metafile: true,
  });
  const inputs = [...new Set([...Object.keys(result.metafile.inputs),
    'scripts/dev/sound-lab/browser/index.html', 'scripts/dev/sound-lab/browser/soundLabStyles.css',
  ])];
  for (const target of targets) for (const candidate of target.candidates) {
    if (!inputs.includes(candidate.sourcePath)) throw new Error(`SOUND_LAB_CANDIDATE_SOURCE_NOT_BUNDLED:${candidate.sourcePath}`);
  }
  const revision = await computeSourceRevision(inputs);
  const body = `globalThis.ENTROPY_SOUND_LAB_BUILD_REVISION = ${JSON.stringify(revision)};\n${result.outputFiles[0].text}`;
  await writeFile(resolve(BROWSER_ROOT, 'soundLab.bundle.js'), body);
  await writeFile(resolve(BROWSER_ROOT, 'soundLabBuild.json'), `${JSON.stringify({ schemaVersion: 1, revision, inputs, targets }, null, 2)}\n`);
  console.log(`Sound Lab built: ${targets.length} targets, revision ${revision.slice(0, 12)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildSoundLab();
