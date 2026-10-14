import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const TYPES = Object.freeze({
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
});
const sha256 = value => createHash('sha256').update(value).digest('hex');

/** The study's actual verifier determines the closure, including predecessor
 * manifests. The owned server serves these captured bytes only, never live disk.
 * This source-render lease is independent of the operator's port-4184 host. */
export async function createZenCherryPlumeLiveSourceLease({ rootDir, studyPath, sourceHash }) {
  if (!/^[a-f0-9]{64}$/.test(sourceHash)) throw Error('QA_PLUME_SOURCE_HASH_REQUIRED');
  const studyRoot = path.resolve(rootDir, studyPath);
  const allowedRoot = path.resolve(rootDir,
    'scripts/dev/zen-bonsai-morphology-research/g15-4-typed-developmental-scheduler');
  const rootPrefix = `${allowedRoot}${path.sep}`;
  if (!studyRoot.startsWith(rootPrefix)) throw Error('QA_PLUME_STUDY_BOUNDARY');
  const captured = new Map();
  const readText = async url => {
    if (!(url instanceof URL) || url.protocol !== 'file:') throw Error('QA_PLUME_SOURCE_URL');
    const filename = fileURLToPath(url);
    if (!filename.startsWith(rootPrefix)) throw Error('QA_PLUME_SOURCE_BOUNDARY');
    const route = `/g15-4/${path.relative(allowedRoot, filename).split(path.sep).join('/')}`;
    if (captured.has(route)) return captured.get(route).body.toString('utf8');
    const body = await readFile(filename);
    const type = TYPES[path.extname(filename)];
    if (!type) throw Error(`QA_PLUME_SOURCE_TYPE:${route}`);
    captured.set(route, { body, type, sha256: sha256(body) });
    return body.toString('utf8');
  };
  const versionUrl = pathToFileURL(path.join(studyRoot, 'version.js'));
  const { readZenCherryPlumeLiveVersion } = await import(versionUrl.href);
  if (typeof readZenCherryPlumeLiveVersion !== 'function') throw Error('QA_PLUME_VERIFIER_REQUIRED');
  const manifest = await readZenCherryPlumeLiveVersion(readText);
  if (manifest.model !== 'zen_cherry_plume_live_v1' || manifest.sourceHash !== sourceHash) {
    throw Error('QA_PLUME_SOURCE_PIN_MISMATCH');
  }
  const entryPath = `/g15-4/${path.relative(allowedRoot, studyRoot).split(path.sep).join('/')}/index.html`;
  if (!captured.has(entryPath)) throw Error('QA_PLUME_SOURCE_ENTRY_MISSING');
  const missingRequests = [];
  const server = createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    const entry = captured.get(pathname);
    if (!entry) {
      missingRequests.push(pathname);
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Source is not in this verified research closure.'); return;
    }
    response.writeHead(200, { 'Content-Type': `${entry.type}; charset=utf-8`,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : entry.body);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('QA_PLUME_SOURCE_ADDRESS');
  let closed = false;
  return Object.freeze({
    url: `http://127.0.0.1:${address.port}${entryPath}`,
    receipt: { sourceHash, model: manifest.model, entryPath, port: address.port,
      files: [...captured].map(([route, entry]) => ({ route, bytes: entry.body.byteLength, sha256: entry.sha256 })) },
    missingRequests,
    async close() {
      if (closed) return;
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
      closed = true;
      if (server.listening) throw Error('QA_PLUME_SOURCE_CLEANUP_FAILED');
    },
  });
}
