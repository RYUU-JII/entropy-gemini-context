#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();

const fail = (message) => {
  console.error(`[content-script-injection-ownership] FAIL: ${message}`);
  process.exit(1);
};

const toPosix = (targetPath) => path.relative(rootDir, targetPath).split(path.sep).join('/');

const walkFiles = async (dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.resolve(dirPath, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(absolutePath);
    }
    if (!entry.isFile()) return [];
    if (!absolutePath.endsWith('.js') && !absolutePath.endsWith('.jsx')) return [];
    return [absolutePath];
  }));
  return nested.flat();
};

const readUtf8 = async (relativePath) => fs.readFile(path.resolve(rootDir, relativePath), 'utf8');

const main = async () => {
  const srcDir = path.resolve(rootDir, 'src');
  const sourceFiles = await walkFiles(srcDir);
  const allowedExecuteScriptFiles = new Set([
    'src/platform/chrome/ChromeService.js',
    'src/domains/tracking/background/ContentScriptOrchestrator.js',
  ]);

  for (const filePath of sourceFiles) {
    const relPath = toPosix(filePath);
    const source = await fs.readFile(filePath, 'utf8');

    if (source.includes('chrome.scripting.executeScript') && relPath !== 'src/platform/chrome/ChromeService.js') {
      fail(`${relPath} must use ChromeService scriptingExecuteScript() instead of raw chrome.scripting.executeScript.`);
    }

    if (source.includes('scriptingExecuteScript(') && !allowedExecuteScriptFiles.has(relPath)) {
      fail(`${relPath} must not call scriptingExecuteScript(); content script injection belongs to ContentScriptOrchestrator only.`);
    }

    if (source.includes('scriptingExecuteScriptWithResults(') && !allowedExecuteScriptFiles.has(relPath)) {
      fail(`${relPath} must not call scriptingExecuteScriptWithResults(); MAIN-world injection belongs to ContentScriptOrchestrator only.`);
    }
  }

  const managedSyncSource = await readUtf8('src/domains/tracking/background/ManagedContentScriptSync.js');
  if (managedSyncSource.includes('scriptingExecuteScript(')) {
    fail('src/domains/tracking/background/ManagedContentScriptSync.js must not inject content scripts directly.');
  }

  const dashboardHookSource = await readUtf8('src/apps/dashboard/hooks/useProtectionNudgeDispatchControl.js');
  if (dashboardHookSource.includes('scriptingExecuteScript(')) {
    fail('src/apps/dashboard/hooks/useProtectionNudgeDispatchControl.js must delegate nudge debug injection through background runtime actions.');
  }

  console.log('[content-script-injection-ownership] PASS: executeScript ownership stays inside the content script orchestrator seam.');
};

main().catch((error) => {
  console.error('[content-script-injection-ownership] Unexpected error:', error);
  process.exit(1);
});
