#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { executeDevExtensionBuild } from './build-dev-extension.mjs';
import { DEV_EXTENSION_INPUT_PATHS } from './devExtensionArtifactPublisher.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(scriptPath), '../..');
const generatedAssetPath = path.normalize(
  'src/themes/plugins/zen/pond/renderers/pixi/visualProfiles/assets/generated',
);
const inputPaths = DEV_EXTENSION_INPUT_PATHS.map((input) => path.normalize(input));
const rootFiles = new Set(inputPaths.filter((input) => path.dirname(input) === '.'));

let buildRunning = false;
let rebuildPending = false;
let stopping = false;
let debounceTimer = null;
const watchers = [];

function closeWatchers() {
  for (const watcher of watchers.splice(0)) watcher.close();
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = null;
}

function scheduleBuild(reason) {
  if (stopping) return;
  rebuildPending = true;
  if (buildRunning) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void drainBuilds(reason);
  }, 180);
}

async function drainBuilds(reason) {
  if (buildRunning || stopping) return;
  buildRunning = true;
  try {
    while (rebuildPending && !stopping) {
      rebuildPending = false;
      console.log(`[dev-extension-watch] Building isolated artifact (${reason})...`);
      try {
        const result = await executeDevExtensionBuild({ verification: 'artifact' });
        console.log(
          `[dev-extension-watch] Published ${result.buildId} to ${path.relative(rootDir, result.activeDir)}.`,
        );
      } catch (error) {
        if (stopping && error?.code === 'DEV_EXTENSION_BUILD_COMMAND_SIGNALED') break;
        if (error?.code === 'DEV_EXTENSION_INPUT_CAPTURE_BUSY') {
          console.log('[dev-extension-watch] Source capture was busy; active publication retained. The next edit will request another capture.');
          rebuildPending = false;
          break;
        }
        console.error(`[dev-extension-watch] Build failed; active publication retained. ${error?.stack || error}`);
      }
    }
  } finally {
    buildRunning = false;
    if (stopping) process.exit(0);
  }
}

function watchDirectory(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  const watcher = fs.watch(absolutePath, { recursive: true }, (_eventType, filename) => {
    const changedPath = path.normalize(path.join(relativePath, String(filename || '')));
    if (changedPath === generatedAssetPath || changedPath.startsWith(`${generatedAssetPath}${path.sep}`)) {
      return;
    }
    if (!inputPaths.some((input) => changedPath === input || changedPath.startsWith(`${input}${path.sep}`))) return;
    scheduleBuild(changedPath);
  });
  watchers.push(watcher);
}

function startWatching() {
  watchDirectory('src');
  watchDirectory('public');
  watchDirectory('scripts');
  const rootWatcher = fs.watch(rootDir, { recursive: false }, (_eventType, filename) => {
    const changedName = String(filename || '');
    if (rootFiles.has(changedName)) scheduleBuild(changedName);
  });
  watchers.push(rootWatcher);
  console.log('[dev-extension-watch] Watching source. Each complete version uses the canonical publication destination.');
  scheduleBuild('initial');
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stopping = true;
    closeWatchers();
    if (!buildRunning) process.exit(0);
  });
}

startWatching();
