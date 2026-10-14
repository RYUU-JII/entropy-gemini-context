import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BROWSER_ROOT, computeSourceRevision } from '../build.mjs';
import { createReviewRepository } from './reviewRepository.mjs';

const REVIEW_ROOT = fileURLToPath(new URL('../workspace/reviews/', import.meta.url));
const FILES = {
  '/': ['index.html', 'text/html'],
  '/index.html': ['index.html', 'text/html'],
  '/soundLabStyles.css': ['soundLabStyles.css', 'text/css'],
  '/soundLab.bundle.js': ['soundLab.bundle.js', 'text/javascript'],
};

export function createSoundLabServer({ browserRoot = BROWSER_ROOT, reviewRoot = REVIEW_ROOT,
  verifyRevision = computeSourceRevision } = {}) {
  const repository = createReviewRepository(reviewRoot);
  const json = (response, status, data) => {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(data));
  };
  return createServer(async (request, response) => {
    try {
      const expectedHost = `127.0.0.1:${request.socket.localPort}`;
      if (request.headers.host !== expectedHost) { json(response, 403, { error: 'SOUND_LAB_HOST_REJECTED' }); return; }
      if (request.method === 'GET' && Object.hasOwn(FILES, request.url)) {
        const [name, type] = FILES[request.url];
        const body = await readFile(resolve(browserRoot, name));
        response.writeHead(200, {
          'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
        });
        response.end(body); return;
      }
      if (!['/api/workspace', '/api/reviews'].includes(request.url)) { json(response, 404, { error: 'SOUND_LAB_ROUTE_UNKNOWN' }); return; }
      if ((request.url === '/api/workspace' && request.method !== 'GET')
        || (request.url === '/api/reviews' && request.method !== 'POST')) { json(response, 405, { error: 'SOUND_LAB_METHOD_REJECTED' }); return; }
      const build = JSON.parse(await readFile(resolve(browserRoot, 'soundLabBuild.json'), 'utf8'));
      if (build.schemaVersion !== 1 || await verifyRevision(build.inputs) !== build.revision) {
        json(response, 409, { error: '소스가 바뀌었습니다. npm run build:sound-lab 후 페이지를 새로고침하세요.' }); return;
      }
      if (request.method === 'GET') {
        json(response, 200, { revision: build.revision, reviews: await repository.read() }); return;
      }
      if (request.headers.origin !== `http://${expectedHost}` || request.headers['x-sound-lab'] !== 'review'
        || request.headers['content-type'] !== 'application/json') {
        json(response, 403, { error: 'SOUND_LAB_ORIGIN_REJECTED' }); return;
      }
      let bytes = 0;
      const chunks = [];
      for await (const chunk of request) {
        bytes += chunk.length;
        if (bytes > 32_768) { json(response, 413, { error: 'SOUND_LAB_REVIEW_TOO_LARGE' }); return; }
        chunks.push(chunk);
      }
      let payload;
      try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { json(response, 400, { error: 'SOUND_LAB_REVIEW_JSON_INVALID' }); return; }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        json(response, 400, { error: 'SOUND_LAB_REVIEW_FIELDS_INVALID' }); return;
      }
      const record = await repository.save(payload, build);
      json(response, 201, { record });
    } catch (error) {
      console.error('[sound-lab]', error);
      const status = error.message.startsWith('SOUND_LAB_REVIEW_') ? 400 : 500;
      json(response, status, { error: error.code === 'ENOENT'
        ? '연구소 파일이 없습니다. npm run build:sound-lab 및 workspace/reviews 경로를 확인하세요.' : error.message });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some(arg => !/^--port=\d+$/.test(arg))) throw new Error('SOUND_LAB_SERVER_ARGUMENT_INVALID');
  const port = args.length === 0 ? 4186 : Number(args[0].slice(7));
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('SOUND_LAB_SERVER_PORT_INVALID');
  const server = createSoundLabServer();
  server.on('error', error => { console.error(error); process.exitCode = 1; });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); server.closeIdleConnections(); });
  server.listen(port, '127.0.0.1', () => console.log(`Sound Lab: http://127.0.0.1:${port}/`));
}
