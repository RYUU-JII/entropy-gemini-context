import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { build, version as esbuildVersion } from 'esbuild';

const ENTRY_PATH = 'scripts/dev/zen-weather-motion-research/browser.mjs';
const DISABLED_INPUT_PREFIX = '(disabled):';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const LOADERS = Object.freeze({
  '.js': 'js', '.mjs': 'js', '.cjs': 'js', '.jsx': 'jsx',
  '.ts': 'ts', '.tsx': 'tsx', '.json': 'json',
});
const HTML = Buffer.from('<!doctype html><html><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1">'
  + '<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}</style>'
  + '</head><body><script type="module" src="/study.js"></script></body></html>');

// esbuild reads the exact bytes captured here. The server never reads live
// repository paths and cannot serve an import outside the compiled closure.
export async function createZenRainStreaksSourceLease({ rootDir, entryPath }) {
  if (entryPath !== ENTRY_PATH) throw Error('QA_RAIN_STREAKS_ENTRY_BOUNDARY');
  const root = path.resolve(rootDir);
  const captured = new Map();
  const insideRoot = filename => filename.startsWith(`${root}${path.sep}`);
  const compileOptions = {
    absWorkingDir: root,
    entryPoints: [path.join(root, entryPath)],
    outfile: 'rain-study.js',
    write: false,
    bundle: true,
    metafile: true,
    platform: 'browser',
    format: 'esm',
    target: 'es2022',
    alias: { '@': path.join(root, 'src') },
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'silent',
  };
  // A browser:false package mapping remains esbuild's virtual empty module,
  // even when onLoad receives a file-looking path that exists on disk. Discover
  // those exact paths first so the capture loader cannot replace their meaning.
  const discovery = await build(compileOptions);
  const browserDisabled = new Map();
  for (const [input, metadata] of Object.entries(discovery.metafile.inputs)) {
    if (!input.startsWith(DISABLED_INPUT_PREFIX)) continue;
    const filename = path.resolve(root, input.slice(DISABLED_INPUT_PREFIX.length));
    if (!insideRoot(filename) || metadata.bytes !== 0 || metadata.imports.length !== 0) {
      throw Error(`QA_RAIN_STREAKS_DISABLED_INPUT_BOUNDARY:${input}`);
    }
    browserDisabled.set(filename, input);
  }
  const result = await build({
    ...compileOptions,
    plugins: [{
      name: 'capture-rain-study-source',
      setup(builder) {
        builder.onLoad({ filter: /.*/, namespace: 'file' }, async ({ path: filename }) => {
          if (!insideRoot(filename)) throw Error(`QA_RAIN_STREAKS_SOURCE_BOUNDARY:${filename}`);
          if (browserDisabled.has(filename)) return undefined;
          const loader = LOADERS[path.extname(filename)];
          if (!loader) throw Error(`QA_RAIN_STREAKS_SOURCE_TYPE:${filename}`);
          const body = await readFile(filename);
          const digest = sha256(body);
          const previous = captured.get(filename);
          if (previous && previous.sha256 !== digest) throw Error('QA_RAIN_STREAKS_SOURCE_CHANGED_DURING_BUILD');
          captured.set(filename, { body, sha256: digest });
          return { contents: body, loader, resolveDir: path.dirname(filename) };
        });
      },
    }],
  });
  if (result.outputFiles.length !== 1 || !result.outputFiles[0].path.endsWith('.js')) {
    throw Error('QA_RAIN_STREAKS_SINGLE_ESM_BUNDLE_REQUIRED');
  }
  const bundle = Buffer.from(result.outputFiles[0].contents);
  const inputs = Object.keys(result.metafile.inputs).sort().map(input => {
    if (input.startsWith(DISABLED_INPUT_PREFIX)) {
      const filename = path.resolve(root, input.slice(DISABLED_INPUT_PREFIX.length));
      const metadata = result.metafile.inputs[input];
      if (browserDisabled.get(filename) !== input || metadata.bytes !== 0 || metadata.imports.length !== 0) {
        throw Error(`QA_RAIN_STREAKS_DISABLED_INPUT_CHANGED:${input}`);
      }
      return { kind: 'browser_disabled', path: input, bytes: 0, sha256: sha256(Buffer.alloc(0)) };
    }
    const filename = path.resolve(root, input);
    const source = captured.get(filename);
    if (!source) throw Error(`QA_RAIN_STREAKS_UNCAPTURED_INPUT:${input}`);
    return { kind: 'file', path: path.relative(root, filename).split(path.sep).join('/'),
      bytes: source.body.byteLength, sha256: source.sha256 };
  });
  if (!inputs.length) throw Error('QA_RAIN_STREAKS_EMPTY_SOURCE_CLOSURE');
  const manifest = Object.freeze({
    contract: 'zen_rain_streaks_source_v1', entryPath, compiler: `esbuild@${esbuildVersion}`,
    inputs, bundle: { bytes: bundle.byteLength, sha256: sha256(bundle) },
  });
  const sourceHash = sha256(JSON.stringify(manifest));
  const assertUnchanged = async () => {
    for (const input of inputs) {
      if (input.kind === 'browser_disabled') continue;
      if (sha256(await readFile(path.join(root, input.path))) !== input.sha256) {
        throw Error(`QA_RAIN_STREAKS_SOURCE_CHANGED:${input.path}`);
      }
    }
    return { unchanged: true, sourceHash, checkedInputs: inputs.length };
  };
  await assertUnchanged();
  const missingRequests = [];
  const server = createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
    const resource = pathname === '/' ? { body: HTML, type: 'text/html' }
      : pathname === '/study.js' ? { body: bundle, type: 'text/javascript' } : null;
    if (!resource) {
      missingRequests.push(pathname);
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Not part of this captured rain study.'); return;
    }
    response.writeHead(200, { 'Content-Type': `${resource.type}; charset=utf-8`,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : resource.body);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    throw Error('QA_RAIN_STREAKS_SOURCE_ADDRESS');
  }
  let closed = false;
  return Object.freeze({
    url: `http://127.0.0.1:${address.port}/`,
    receipt: Object.freeze({ ...manifest, sourceHash, port: address.port }),
    missingRequests,
    assertUnchanged,
    async exportPreview(filename) {
      const inlineBundle = bundle.toString('utf8').replace(/<\/script/gi, '<\\/script');
      const preview = Buffer.from(HTML.toString('utf8').replace(
        '<script type="module" src="/study.js"></script>',
        () => `<script type="module">${inlineBundle}\n</script>`,
      ));
      await writeFile(filename, preview);
      return { path: filename, bytes: preview.byteLength, sha256: sha256(preview), sourceHash };
    },
    async close() {
      if (closed) return;
      await new Promise((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve());
        server.closeAllConnections();
      });
      closed = true;
      if (server.listening) throw Error('QA_RAIN_STREAKS_SOURCE_CLEANUP_FAILED');
    },
  });
}
