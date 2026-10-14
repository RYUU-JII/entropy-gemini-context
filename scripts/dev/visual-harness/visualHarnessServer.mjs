import { createServer as createNetServer } from 'node:net';
import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';

import { createServer as createViteServer } from 'vite';

import { VISUAL_HARNESS_VITE_MODE } from './visualHarnessViteContract.mjs';
import { pinnedG15ResearchPlugin } from './servePinnedG15Research.mjs';
import { createVisualHarnessSelectedScenes } from './visualHarnessSelectedScene.mjs';

export const VISUAL_HARNESS_PATH = '/__entropy_visual_harness';

const harnessHtml = (entryPath) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <link rel="icon" href="data:," />
    <title>Entropy Visual Harness</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${entryPath}"></script>
  </body>
</html>`;

async function reserveLoopbackPort() {
  return new Promise((resolvePort, rejectPort) => {
    const probe = createNetServer();
    // Startup awaits this bind/close handshake; keep it alive until it settles.
    probe.once('error', rejectPort);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close();
        rejectPort(new Error('[VisualHarness] could not reserve a loopback port.'));
        return;
      }
      probe.close((closeError) => {
        if (closeError) {
          rejectPort(closeError);
          return;
        }
        resolvePort(address.port);
      });
    });
  });
}

export function buildVisualHarnessSceneUrl(origin, sceneId) {
  const url = new URL(VISUAL_HARNESS_PATH, origin);
  url.searchParams.set('scene', sceneId);
  return url.toString();
}

export async function startVisualHarnessServer(rootDir, sceneIds) {
  const startedAt = performance.now();
  const selectedScenes = createVisualHarnessSelectedScenes(sceneIds);
  const port = await reserveLoopbackPort();
  const cacheRoot = path.resolve(rootDir, '.artifacts', 'visual-harness-cache');
  const cacheDir = path.join(cacheRoot, randomUUID());
  const removeCache = async () => {
    if (path.dirname(cacheDir) !== cacheRoot) throw new Error('VISUAL_HARNESS_CACHE_PATH_INVALID');
    await rm(cacheDir, { recursive: true, force: true });
  };
  const server = await createViteServer({
    root: rootDir,
    appType: 'custom',
    logLevel: 'error',
    mode: VISUAL_HARNESS_VITE_MODE,
    cacheDir,
    plugins: [selectedScenes.plugin, pinnedG15ResearchPlugin(rootDir)],
    optimizeDeps: { entries: selectedScenes.optimizeEntries },
    server: {
      host: '127.0.0.1',
      port,
      strictPort: true,
      open: false,
      hmr: false,
      // Finite captures do not reload source; avoid crawling build/profile output.
      watch: null,
    },
  }).catch(async (error) => {
    try { await removeCache(); } catch (cleanupError) {
      throw Object.assign(new AggregateError([error, cleanupError],
        'VISUAL_HARNESS_CACHE_STARTUP_CLEANUP_FAILED', { cause: error }),
      { code: 'VISUAL_HARNESS_SERVER_CLEANUP_INCOMPLETE' });
    }
    throw error;
  });
  const close = async () => {
    await server.close();
    await removeCache();
  };

  server.middlewares.use((request, response, next) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    if (requestUrl.pathname !== VISUAL_HARNESS_PATH) {
      next();
      return;
    }

    let entryPath;
    try {
      entryPath = selectedScenes.entryPathForScene(requestUrl.searchParams.get('scene'));
    } catch (error) {
      next(error);
      return;
    }
    void server.transformIndexHtml(requestUrl.pathname, harnessHtml(entryPath))
      .then((html) => {
        response.statusCode = 200;
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(html);
      })
      .catch(next);
  });

  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === 'string') {
      throw new Error('[VisualHarness] Vite did not expose a TCP server address.');
    }
    const initializedAt = performance.now();
    const roots = [...new Set([
      ...selectedScenes.optimizeEntries.map((entry) => `/${entry}`),
      ...selectedScenes.sceneIds.map(selectedScenes.entryPathForScene),
      '/@vite/client',
    ])];
    // Admit every actual HTML/source root before the first static crawl ends.
    // Settle the whole finite batch before rollback so no owned transform is
    // still running when startup closes this server.
    const transformations = await Promise.allSettled(roots.map(async (root) => {
      const transformed = await server.transformRequest(root);
      if (transformed === null) {
        const error = new Error(`[VisualHarness] admitted source root '${root}' could not be transformed.`);
        error.code = 'VISUAL_HARNESS_SOURCE_TRANSFORM_MISSING';
        throw error;
      }
    }));
    const failedTransformation = transformations.find((result) => result.status === 'rejected');
    if (failedTransformation) throw failedTransformation.reason;
    const transformedAt = performance.now();
    await server.waitForRequestsIdle();
    const admittedAt = performance.now();

    return {
      origin: `http://127.0.0.1:${address.port}`,
      server,
      close,
      sourceCachePath: '/' + path.relative(rootDir, cacheDir).split(path.sep).join('/') + '/',
      sourceAdmission: Object.freeze({
        schemaVersion: 1,
        selectedSceneIds: Object.freeze([...selectedScenes.sceneIds]),
        cacheDir,
        transformedRoots: Object.freeze(roots),
        serverInitializationMs: initializedAt - startedAt,
        rootTransformMs: transformedAt - initializedAt,
        staticImportIdleMs: admittedAt - transformedAt,
        totalMs: admittedAt - startedAt,
      }),
    };
  } catch (error) {
    try {
      await close();
    } catch (closeError) {
      throw Object.assign(new AggregateError(
        [error, closeError],
        '[VisualHarness] Vite startup failed and its server could not be closed cleanly.',
        { cause: error },
      ), { code: 'VISUAL_HARNESS_SERVER_CLEANUP_INCOMPLETE' });
    }
    throw error;
  }
}
