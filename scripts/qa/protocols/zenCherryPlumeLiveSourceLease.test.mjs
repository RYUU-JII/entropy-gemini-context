import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createZenCherryPlumeLiveSourceLease } from './zenCherryPlumeLiveSourceLease.mjs';
import { getQaTarget } from '../catalog/qaTargetRegistry.mjs';
import { normalizeQaTargetParameters } from '../contracts/qaTargetContract.mjs';

const sourceHash = 'a'.repeat(64);
const studyPath = 'scripts/dev/zen-bonsai-morphology-research/g15-4-typed-developmental-scheduler/current/research/cherry-plume-live';
async function fixture(t, { outside = false } = {}) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'entropy-plume-source-'));
  t.after(async () => {
    const normalized = path.resolve(rootDir);
    assert.ok(normalized.startsWith(path.join(os.tmpdir(), 'entropy-plume-source-')));
    await rm(normalized, { recursive: true, force: true });
  });
  const studyRoot = path.join(rootDir, studyPath);
  await mkdir(studyRoot, { recursive: true });
  await writeFile(path.join(rootDir, 'package.json'), '{"type":"module"}');
  await writeFile(path.join(studyRoot, 'index.html'), '<p>captured study</p>');
  await writeFile(path.join(studyRoot, 'version.js'), `export async function readZenCherryPlumeLiveVersion(read) {
    await read(new URL(${JSON.stringify(outside ? '../../../../../../../outside.txt' : './index.html')}, import.meta.url));
    return { model: 'zen_cherry_plume_live_v1', sourceHash: '${sourceHash}' };
  }`);
  return { rootDir, studyRoot };
}

test('target requires an explicit source pin and preserves visual/WebGL ownership', () => {
  const target = getQaTarget('visual/zen/cherry-plume-live');
  assert.equal(target.environmentId, 'visual');
  assert.equal(target.artifactId, 'source_render');
  assert.equal(target.browserRequirements.webgl, 'required');
  assert.equal(target.browserRequirements.extensionRuntime, 'none');
  assert.throws(() => normalizeQaTargetParameters(target, {}), /REQUIRED/);
});

test('verified source bytes remain frozen; undeclared source is not served; owned server closes', async t => {
  const { rootDir, studyRoot } = await fixture(t);
  const lease = await createZenCherryPlumeLiveSourceLease({ rootDir, studyPath, sourceHash });
  t.after(() => lease.close());
  await writeFile(path.join(studyRoot, 'index.html'), '<p>later edit</p>');
  assert.equal(await (await fetch(lease.url)).text(), '<p>captured study</p>');
  assert.equal((await fetch(new URL('not-in-closure.js', lease.url))).status, 404);
  assert.equal(lease.missingRequests.length, 1);
  await lease.close();
  await assert.rejects(fetch(lease.url));
});

test('wrong requested pin and out-of-bound verification reads fail before server admission', async t => {
  const first = await fixture(t);
  await assert.rejects(createZenCherryPlumeLiveSourceLease({ rootDir: first.rootDir, studyPath,
    sourceHash: 'b'.repeat(64) }), /SOURCE_PIN_MISMATCH/);
  const second = await fixture(t, { outside: true });
  await assert.rejects(createZenCherryPlumeLiveSourceLease({ rootDir: second.rootDir, studyPath,
    sourceHash }), /SOURCE_BOUNDARY/);
});
