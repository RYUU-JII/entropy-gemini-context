import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getVisualSceneManifest } from '../../../src/apps/visual-harness/sceneCatalog.js';
import { buildVisualHarnessSceneUrl, startVisualHarnessServer } from './visualHarnessServer.mjs';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const args = process.argv.slice(2);
if (args.length !== 1 || args[0].startsWith('-')) {
  throw new Error('Usage: npm run visual:preview -- <scene-id>');
}
const manifest = getVisualSceneManifest(args[0]);
let stop;
const stopped = new Promise(resolveStop => { stop = resolveStop; });
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

const server = await startVisualHarnessServer(rootDir, [manifest.id]);
try {
  const url = buildVisualHarnessSceneUrl(server.origin, manifest.id);
  const receiptDir = resolve(rootDir, '.artifacts', 'visual-preview',
    new Date().toISOString().replaceAll(/[:.]/g, '-'));
  await mkdir(receiptDir, { recursive: true });
  await writeFile(resolve(receiptDir, 'server.json'), JSON.stringify({
    sceneId: manifest.id, url, pid: process.pid,
    sourceAdmission: server.sourceAdmission,
    purpose: 'operator_preview_without_product_storage',
  }, null, 2));
  process.stdout.write(`[visual-preview] READY ${url}\n`);
  process.stdout.write('[visual-preview] Ctrl-C closes this preview server. Browser tabs remain operator-owned.\n');
  await stopped;
} finally {
  await server.close();
  process.removeListener('SIGINT', stop);
  process.removeListener('SIGTERM', stop);
}
