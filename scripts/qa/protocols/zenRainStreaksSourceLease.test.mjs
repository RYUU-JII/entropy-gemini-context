import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { createZenRainStreaksSourceLease } from './zenRainStreaksSourceLease.mjs';
import { getQaTarget } from '../catalog/qaTargetRegistry.mjs';

const entryPath = 'scripts/dev/zen-weather-motion-research/browser.mjs';
const dependencyPath = 'scripts/dev/zen-weather-motion-research/dependency.mjs';
const dependency = 'export const value = "captured-rain-source </script> end";';
async function fixture(t) {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'entropy-rain-source-'));
  t.after(async () => {
    const normalized = path.resolve(rootDir);
    assert.ok(normalized.startsWith(path.join(os.tmpdir(), 'entropy-rain-source-')));
    await rm(normalized, { recursive: true, force: true });
  });
  await mkdir(path.dirname(path.join(rootDir, entryPath)), { recursive: true });
  await writeFile(path.join(rootDir, entryPath), 'import { value } from "./dependency.mjs"; window.rainStudy = value;');
  await writeFile(path.join(rootDir, dependencyPath), dependency);
  return rootDir;
}

test('rain research retains exclusive custom protocol and owned hidden WebGL requirements', () => {
  const target = getQaTarget('visual/zen/rain-streaks');
  assert.equal(target.protocolId, 'zen_rain_streaks');
  assert.equal(target.environmentId, 'visual');
  assert.equal(target.artifactId, 'source_render');
  assert.equal(target.browserRequirements.webgl, 'required');
  assert.equal(target.browserRequirements.extensionRuntime, 'none');
  assert.equal(target.browserRequirements.authentication, 'none');
  assert.equal(target.browserRequirements.defaultPresentation, 'hidden');
  assert.equal(target.browserRequirements.osFocus, 'never');
  assert.deepEqual(target.resourceClaims, ['runtime:visual-capture']);
});

test('source manifest identifies exact transitive bytes and serves only the frozen bundle', async t => {
  const rootDir = await fixture(t);
  const source = await createZenRainStreaksSourceLease({ rootDir, entryPath });
  t.after(() => source.close());
  assert.match(source.receipt.sourceHash, /^[a-f0-9]{64}$/);
  assert.equal(source.receipt.inputs.length, 2);
  const captured = source.receipt.inputs.find(input => input.path === dependencyPath);
  assert.equal(captured.bytes, Buffer.byteLength(dependency));
  assert.equal(captured.sha256, createHash('sha256').update(dependency).digest('hex'));
  assert.equal((await source.assertUnchanged()).unchanged, true);
  const bundleUrl = new URL('/study.js', source.url);
  const before = await (await fetch(bundleUrl)).text();
  assert.match(before, /captured-rain-source/);
  const previewReceipt = await source.exportPreview(path.join(rootDir, 'preview.html'));
  const preview = await readFile(previewReceipt.path, 'utf8');
  assert.equal(previewReceipt.sourceHash, source.receipt.sourceHash);
  assert.equal(previewReceipt.sha256, createHash('sha256').update(preview).digest('hex'));
  assert.equal(preview.match(/<\/script/gi).length, 1);
  assert.match(preview, /<script type="module">/);
  assert.doesNotMatch(preview, /src="\/study\.js"/);
  await writeFile(path.join(rootDir, dependencyPath), 'export const value = "later-live-source";');
  assert.equal(await (await fetch(bundleUrl)).text(), before);
  await assert.rejects(source.assertUnchanged(), /QA_RAIN_STREAKS_SOURCE_CHANGED/);
  assert.equal((await fetch(new URL(`/${dependencyPath}`, source.url))).status, 404);
  assert.equal(source.missingRequests.length, 1);
  await source.close();
  await assert.rejects(fetch(source.url));
});

test('rain source entry cannot be redirected outside its named fixture', async t => {
  const rootDir = await fixture(t);
  await assert.rejects(createZenRainStreaksSourceLease({ rootDir, entryPath: '../foreign.mjs' }),
    /QA_RAIN_STREAKS_ENTRY_BOUNDARY/);
});

test('browser-disabled implicit and explicit JS modules retain compiler-owned empty inputs', async t => {
  const rootDir = await fixture(t);
  const packageDir = path.join(rootDir, 'node_modules', 'disabled-browser');
  await mkdir(packageDir, { recursive: true });
  await writeFile(path.join(packageDir, 'package.json'), JSON.stringify({
    name: 'disabled-browser', main: 'index.js',
    browser: { './util.inspect.js': false, './explicit.js': false },
  }));
  await writeFile(path.join(packageDir, 'index.js'),
    'module.exports = { implicit: require("./util.inspect"), explicit: require("./explicit.js") };');
  for (const filename of ['util.inspect.js', 'explicit.js']) {
    await writeFile(path.join(packageDir, filename), 'throw Error("DISABLED_BROWSER_SOURCE_MUST_NOT_EXECUTE");');
  }
  await writeFile(path.join(rootDir, dependencyPath), 'import value from "disabled-browser"; export { value };');
  const source = await createZenRainStreaksSourceLease({ rootDir, entryPath });
  t.after(() => source.close());
  const disabled = source.receipt.inputs.filter(input => input.kind === 'browser_disabled');
  assert.equal(disabled.length, 2);
  for (const input of disabled) {
    assert.match(input.path, /^\(disabled\):/);
    assert.equal(input.bytes, 0);
    assert.equal(input.sha256, createHash('sha256').update(Buffer.alloc(0)).digest('hex'));
  }
  const bundle = await (await fetch(new URL('/study.js', source.url))).text();
  assert.doesNotMatch(bundle, /DISABLED_BROWSER_SOURCE_MUST_NOT_EXECUTE/);
  assert.equal((await source.assertUnchanged()).unchanged, true);
});

test('a real unsupported source type fails rather than becoming a virtual module', async t => {
  const rootDir = await fixture(t);
  await writeFile(path.join(rootDir, entryPath), 'import value from "./data.inspect"; window.rainStudy = value;');
  await writeFile(path.join(rootDir, path.dirname(entryPath), 'data.inspect'), 'must remain unsupported');
  await assert.rejects(createZenRainStreaksSourceLease({ rootDir, entryPath }), /No loader is configured.*\.inspect|QA_RAIN_STREAKS_SOURCE_TYPE/);
});
