import { defineConfig, transformWithEsbuild } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync } from 'node:fs';
import { File as NodeFile } from 'node:buffer';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import manifest from './src/manifest.json';
import { CHROME_COMPATIBILITY_CONTRACT } from './src/platform/extension/chromeCompatibilityContract.js';
import {
  EXTENSION_RELEASE_PROFILES,
  assertExtensionBuildOutputIsolation,
  createExtensionManifestProfile,
  isChromiumExtensionTarget,
  normalizeExtensionBuildTarget,
  normalizeExtensionReleaseProfile,
  resolveExtensionOutDir,
} from './src/platform/build/extensionManifestProfile.js';
import { isVisualHarnessViteServe } from './scripts/dev/visual-harness/visualHarnessViteContract.mjs';
import { createPrepaintVisualAssetsPlugin } from './scripts/release/prepaintVisualAssetsPlugin.mjs';
import { resolveRuntimeI18nManualChunk } from './scripts/i18n/runtimeI18nChunkContract.mjs';
import { resolveWorkerRuntimeManualChunk } from './scripts/release/workerRuntimeChunkContract.mjs';

if (typeof globalThis.File === 'undefined') {
  globalThis.File = NodeFile;
}

const rootDir = __dirname;
const srcDir = resolve(rootDir, 'src');
const pagesDir = resolve(srcDir, 'pages');
const contentDir = resolve(srcDir, 'apps/content');
const ARTIFACT_MODULE_INVENTORY_FILE = '.vite/entropy-module-inventory.json';
const WORKER_MODULE_INVENTORY_SCHEMA_VERSION = 2;
const WORKER_MODULE_INVENTORY_DIR = '.vite/entropy-worker-module-inventory';
const themePluginJsxPathPattern = /\/src\/themes\/plugins\/.+\.[jt]sx$/;
const envDevPort = Number.parseInt(process.env.VITE_DEV_PORT ?? process.env.PORT ?? '', 10);
const devPort = Number.isFinite(envDevPort) ? envDevPort : 5173;
const extensionBuildTarget = normalizeExtensionBuildTarget(process.env.ENTROPY_EXTENSION_TARGET);
const extensionUsesChromeCompatibilityContract = isChromiumExtensionTarget(extensionBuildTarget);
const extensionViteBuildTarget = extensionUsesChromeCompatibilityContract
  ? CHROME_COMPATIBILITY_CONTRACT.viteTarget
  : 'es2020';
const PIXI_NO_UNSAFE_EVAL_SHADER_UTILITY_SHIMS = Object.freeze({
  'generateUniformsSync.mjs': resolve(srcDir, 'platform/pixi/noUnsafeEval/generateUniformsSync.js'),
  'generateUniformsSync.js': resolve(srcDir, 'platform/pixi/noUnsafeEval/generateUniformsSync.js'),
  'generateUniformBufferSync.mjs': resolve(srcDir, 'platform/pixi/noUnsafeEval/generateUniformBufferSync.js'),
  'generateUniformBufferSync.js': resolve(srcDir, 'platform/pixi/noUnsafeEval/generateUniformBufferSync.js'),
  'unsafeEvalSupported.mjs': resolve(srcDir, 'platform/pixi/noUnsafeEval/unsafeEvalSupported.js'),
  'unsafeEvalSupported.js': resolve(srcDir, 'platform/pixi/noUnsafeEval/unsafeEvalSupported.js'),
});

function toPosixPath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function resolveCliOutDir(argv = process.argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const argument = String(argv[index] || '').trim();
    if (argument.startsWith('--outDir=')) {
      return argument.slice('--outDir='.length).trim();
    }
    if (argument === '--outDir') {
      return String(argv[index + 1] || '').trim();
    }
  }
  return '';
}

function readGitIdentity(revision) {
  try {
    return execFileSync('git', ['rev-parse', revision], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    throw new Error(
      `[build-provenance] Unable to resolve git revision ${revision}: ${error?.message || error}`,
    );
  }
}

function readGitDirtyState() {
  try {
    const status = execFileSync(
      'git',
      // Only the dirty bit is needed. Collapsing untracked directories keeps
      // the same dirty/clean result without listing every research snapshot.
      ['--no-optional-locks', 'status', '--porcelain=v1', '--untracked-files=normal'],
      {
        cwd: rootDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    return status.trim().length > 0;
  } catch (error) {
    throw new Error(`[build-provenance] Unable to read git dirty state: ${error?.message || error}`);
  }
}

function createBuildProvenance() {
  const createdAt = new Date().toISOString();
  const gitCommitSha = readGitIdentity('HEAD');
  const gitTreeSha = readGitIdentity('HEAD^{tree}');
  const dirty = readGitDirtyState();
  const lockfileSha256 = createHash('sha256')
    .update(readFileSync(resolve(rootDir, 'package-lock.json')))
    .digest('hex');
  const timestamp = createdAt.replace(/[-:.TZ]/g, '').slice(0, 14);

  return Object.freeze({
    createdAt,
    gitCommitSha,
    gitTreeSha,
    dirty,
    lockfileSha256,
    buildId: `${timestamp}-${gitCommitSha.slice(0, 12)}-${dirty ? 'dirty' : 'clean'}`,
  });
}

function normalizeReleaseProfile(value, fallback = EXTENSION_RELEASE_PROFILES.DEV) {
  return normalizeExtensionReleaseProfile(value, fallback);
}

function resolveReleaseProfile(command) {
  const explicit = normalizeReleaseProfile(process.env.ENTROPY_RELEASE_PROFILE, '');
  if (explicit) {
    return explicit;
  }
  return command === 'build'
    ? EXTENSION_RELEASE_PROFILES.PUBLIC
    : EXTENSION_RELEASE_PROFILES.DEV;
}

function resolveExplicitDevCapability(name) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === '') return false;
  const normalized = String(rawValue).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true') return true;
  if (normalized === '0' || normalized === 'false') return false;
  throw new Error(`${name} must be one of: 1, true, 0, false`);
}

function buildReleaseCapabilities(profile) {
  const includeDevExperiments = profile === EXTENSION_RELEASE_PROFILES.DEV;
  const enableSharedInterventionAdmission = includeDevExperiments
    && resolveExplicitDevCapability('ENTROPY_ENABLE_SHARED_INTERVENTION_ADMISSION');
  return Object.freeze({
    includeExperimentTab: includeDevExperiments,
    includeZenClassicExperiments: includeDevExperiments,
    includeZenVNext: includeDevExperiments,
    includeZenExperimentalWorkers: includeDevExperiments,
    includeClseLabs: includeDevExperiments,
    includeDebugTools: includeDevExperiments,
    enableSharedInterventionAdmission,
    enableContentFlowSignals: true,
    enableContentClseReporter: includeDevExperiments,
    enableContentClseAlertOverlay: includeDevExperiments,
    // Legacy skip-guard cooldown ledger: dormant until explicitly revived.
    enableVideoSkipCooldown: false,
  });
}

function buildRuntimeBuildInfo({
  command,
  releaseProfile,
  provenance,
} = {}) {
  return Object.freeze({
    schemaVersion: 1,
    buildId: provenance.buildId,
    command,
    releaseProfile,
    extensionTarget: extensionBuildTarget,
    createdAt: provenance.createdAt,
    gitCommitSha: provenance.gitCommitSha,
    gitTreeSha: provenance.gitTreeSha,
    dirty: provenance.dirty,
    lockfileSha256: provenance.lockfileSha256,
  });
}

function createBuildOutputIsolationPlugin({
  command,
  readOnlyViteConfigConsumer,
  releaseProfile,
  extensionOutDir,
} = {}) {
  return {
    name: 'entropy:extension-build-output-isolation',
    enforce: 'pre',
    configResolved(config) {
      if (command === 'serve' && readOnlyViteConfigConsumer) return;
      const resolvedOutputDir = resolve(config.root || rootDir, config.build.outDir || extensionOutDir);
      assertExtensionBuildOutputIsolation({
        targetInput: extensionBuildTarget,
        releaseProfile,
        outputDir: resolvedOutputDir,
        chromeDevOutputDir: resolve(rootDir, 'dist'),
      });
    },
  };
}

function isReadOnlyViteConfigConsumer({ mode, argv = process.argv } = {}) {
  if (mode === 'test') return true;
  return argv.some((entry) => (
    /(?:^|[/\\])vite-node(?:\.(?:mjs|cjs|js))?$/u.test(String(entry || ''))
  ));
}

function normalizeProjectModuleId(moduleId) {
  const normalizedModuleId = toPosixPath(moduleId).replaceAll('\0', '');
  const normalizedRootPrefix = `${toPosixPath(rootDir)}/`;
  if (!normalizedModuleId.startsWith(normalizedRootPrefix)) {
    return null;
  }
  return normalizedModuleId.slice(normalizedRootPrefix.length);
}

function createArtifactModuleInventoryPlugin(emittedWorkerInventoryEntries = null) {
  return {
    name: 'entropy:artifact-module-inventory',
    enforce: 'post',
    buildStart() {
      emittedWorkerInventoryEntries?.clear();
    },
    generateBundle(_outputOptions, bundle) {
      const chunks = {};
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        chunks[output.fileName] = Object.keys(output.modules)
          .map(normalizeProjectModuleId)
          .filter(Boolean)
          .sort();
      }
      this.emitFile({
        type: 'asset',
        fileName: ARTIFACT_MODULE_INVENTORY_FILE,
        source: JSON.stringify({ schemaVersion: 1, chunks }, null, 2),
      });
    },
  };
}

function createWorkerArtifactModuleInventoryPlugin(emittedEntryModuleIds) {
  return {
    name: 'entropy:worker-artifact-module-inventory',
    generateBundle(_outputOptions, bundle) {
      const outputChunks = Object.values(bundle).filter((output) => output.type === 'chunk');
      const entryChunks = outputChunks.filter((chunk) => chunk.isEntry === true);
      if (entryChunks.length !== 1) {
        this.error(
          `[worker-module-inventory] Expected exactly one worker entry chunk; found ${entryChunks.length}.`,
        );
      }

      const entryChunk = entryChunks[0];
      const entryModuleId = normalizeProjectModuleId(entryChunk.facadeModuleId);
      if (!entryModuleId) {
        this.error(
          `[worker-module-inventory] Worker entry must be project-owned: ${String(entryChunk.facadeModuleId || '')}`,
        );
      }
      if (emittedEntryModuleIds.has(entryModuleId)) {
        return;
      }
      emittedEntryModuleIds.add(entryModuleId);

      const chunks = Object.fromEntries(outputChunks.map((chunk) => {
        const moduleRecords = Object.entries(chunk.modules)
          .map(([moduleId, moduleInfo]) => ({
            moduleId: normalizeProjectModuleId(moduleId),
            renderedBytes: moduleInfo.renderedLength,
          }))
          .filter((record) => record.moduleId)
          .sort((left, right) => left.moduleId.localeCompare(right.moduleId));
        moduleRecords.forEach(({ moduleId, renderedBytes }) => {
          if (!Number.isSafeInteger(renderedBytes) || renderedBytes < 0) {
            this.error(
              `[worker-module-inventory] Invalid rendered byte count for ${moduleId}: ${String(renderedBytes)}.`,
            );
          }
        });
        return [
          chunk.fileName,
          {
            isEntry: chunk.isEntry === true,
            imports: [...chunk.imports].sort(),
            dynamicImports: [...chunk.dynamicImports].sort(),
            modules: moduleRecords.map((record) => record.moduleId),
            moduleRenderedBytes: moduleRecords.map((record) => record.renderedBytes),
          },
        ];
      }));
      const entryBaseName = entryModuleId.slice(entryModuleId.lastIndexOf('/') + 1)
        .replace(/[^A-Za-z0-9._-]/g, '_');
      const entryIdentity = createHash('sha256').update(entryModuleId).digest('hex').slice(0, 12);

      this.emitFile({
        type: 'asset',
        fileName: `${WORKER_MODULE_INVENTORY_DIR}/${entryBaseName}-${entryIdentity}.json`,
        source: JSON.stringify({
          schemaVersion: WORKER_MODULE_INVENTORY_SCHEMA_VERSION,
          entryModuleId,
          entryFile: entryChunk.fileName,
          chunks,
        }, null, 2),
      });
    },
  };
}

function resolveEntryFileName(chunkInfo) {
  const facadeModuleId = toPosixPath(chunkInfo?.facadeModuleId);
  if (facadeModuleId.endsWith('/src/apps/content/bootstrap.js')) {
    return 'assets/content-bootstrap.js';
  }
  if (facadeModuleId.endsWith('/src/apps/content/mediaFrameProbe.js')) {
    return 'src/apps/content/mediaFrameProbe.js';
  }
  if (facadeModuleId.endsWith('/src/platform/storage/bootstrap/contentLoaderRootVisualReader.js')) {
    return 'assets/content-loader-root-visual-reader.js';
  }
  return 'assets/[name]-[hash].js';
}

function resolveDashboardBootLowLevelManualChunk(cleanId) {
  if (
    cleanId.endsWith('/src/themes/core/ids.js')
    || cleanId.endsWith('/src/themes/core/runtime/pluginModulePath.js')
    || cleanId.endsWith('/src/themes/core/state/themePreferenceMirror.js')
    || cleanId.endsWith('/src/domains/settings/config/sidebarDisplayMode.js')
    || cleanId.includes('/src/lib/debug/zenTrace')
    || cleanId.endsWith('/src/platform/storage/internal/chrome-storage/storageKeyRegistry.js')
    || cleanId.endsWith('/src/platform/storage/internal/chrome-storage/localArea.js')
    || cleanId.endsWith('/src/platform/extension/extensionApi.js')
  ) {
    return 'dashboard-boot-low-level';
  }
  return null;
}

function resolveThemeSurfaceDescriptorManualChunk(cleanId) {
  if (
    cleanId.endsWith('/src/themes/core/surfaceDescriptor.js')
    || cleanId.endsWith('/src/themes/core/runtime/surfaceDescriptorCatalog.js')
    || cleanId.endsWith('/src/themes/core/runtime/createThemeSurfaceDescriptor.js')
    || (
      cleanId.includes('/src/themes/plugins/')
      && cleanId.endsWith('/surfaceDescriptor.js')
    )
  ) {
    return 'dashboard-boot-low-level';
  }
  return null;
}

function resolveThemeFrictionPresentationManualChunk(cleanId) {
  if (
    cleanId.includes('/src/themes/plugins/')
    && cleanId.endsWith('/frictionPresentation.js')
  ) {
    return 'theme-friction-presentations';
  }
  return null;
}

function resolveThemeDefinitionManualChunk(cleanId) {
  if (
    cleanId.endsWith('/src/themes/core/catalog.js')
    || cleanId.endsWith('/src/themes/core/base.js')
    || (
      cleanId.includes('/src/themes/plugins/')
      && cleanId.endsWith('/theme.js')
    )
  ) {
    return 'theme-definitions';
  }
  return null;
}

function resolveThemeProfileManualChunk(cleanId) {
  if (
    cleanId.endsWith('/src/themes/core/profile.js')
    || cleanId.endsWith('/src/themes/core/runtime/profileCatalog.js')
    || cleanId.endsWith('/src/themes/core/runtime/createThemeManifest.js')
    || (
      cleanId.includes('/src/themes/plugins/')
      && cleanId.endsWith('/profile.js')
    )
  ) {
    return 'theme-profiles';
  }
  return null;
}

function resolveThemePluginRuntimeManualChunk(cleanId) {
  if (
    cleanId.endsWith('/src/themes/core/toolsVisualPolicy.js')
    || cleanId.endsWith('/src/themes/core/runtime/pluginCatalog.js')
    || (
      cleanId.includes('/src/themes/plugins/')
      && cleanId.endsWith('/manifest.js')
    )
  ) {
    return 'pluginCatalog';
  }
  return null;
}

function resolveManualChunk(id) {
  const cleanId = toPosixPath(id);
  // Shared language metadata and translation definitions keep one pure artifact
  // owner. Dictionaries and Chrome/DOM/runtime instances retain their seams.
  const runtimeI18nChunk = resolveRuntimeI18nManualChunk(cleanId);
  if (runtimeI18nChunk) return runtimeI18nChunk;
  // Worker control and its typed telemetry store are admitted by worker users.
  // Popup and the dashboard entry need only the descriptor/base owner below.
  const workerRuntimeChunk = resolveWorkerRuntimeManualChunk(cleanId);
  if (workerRuntimeChunk) return workerRuntimeChunk;
  // Background, content and popup share these dependency-free wire contracts.
  // Group their protocol vocabulary without absorbing transport, storage or UI
  // owners, and keep the MV3 background graph entirely statically linked.
  if (
    cleanId.endsWith('/src/platform/messaging/contracts/messageTypes.js')
    || cleanId.endsWith('/src/domains/nudge/media/frameMediaProtocol.js')
    || cleanId.endsWith('/src/domains/schedule/contracts/scheduleRuntimeState.js')
    || cleanId.endsWith('/src/platform/storage/support/storageSupportTaskContract.js')
  ) return 'extension-message-contracts';
  // Generated notification/Sentinel copy leaves have no dependencies. Preserve
  // their shared background projection when UI dictionaries load per namespace;
  // full locale dictionaries and runtime translators keep their own admission.
  if (/\/src\/i18n\/locales\/[^/]+\/backgroundRuntime\.js$/.test(cleanId)) {
    return 'background-i18n-locales';
  }
  const themeSurfaceDescriptorChunk = resolveThemeSurfaceDescriptorManualChunk(cleanId);
  if (themeSurfaceDescriptorChunk) return themeSurfaceDescriptorChunk;
  const dashboardBootChunk = resolveDashboardBootLowLevelManualChunk(cleanId);
  if (dashboardBootChunk) return dashboardBootChunk;
  const themeFrictionPresentationChunk = resolveThemeFrictionPresentationManualChunk(cleanId);
  if (themeFrictionPresentationChunk) return themeFrictionPresentationChunk;
  const themeDefinitionChunk = resolveThemeDefinitionManualChunk(cleanId);
  if (themeDefinitionChunk) return themeDefinitionChunk;
  const themeProfileChunk = resolveThemeProfileManualChunk(cleanId);
  if (themeProfileChunk) return themeProfileChunk;
  const themePluginRuntimeChunk = resolveThemePluginRuntimeManualChunk(cleanId);
  if (themePluginRuntimeChunk) return themePluginRuntimeChunk;
  if (!cleanId.includes('node_modules')) return null;
  if (cleanId.includes('/pixi.js/') || cleanId.includes('/@pixi/')) return 'vendor-pixi';
  // The preparation-only SVG serializer must not inflate every React surface.
  if (cleanId.includes('/react-dom/') && /(?:react-dom-server|server\.browser)/.test(cleanId)) return 'vendor-react-static-svg';
  if (cleanId.includes('/react/') || cleanId.includes('/react-dom/')) return 'vendor-react';
  if (cleanId.includes('/framer-motion/')) return 'vendor-motion';
  if (cleanId.includes('/lucide-react/') || cleanId.includes('/date-fns/')) return 'vendor-ui';
  return null;
}

function createReactPlugins() {
  return react().map((plugin) => {
    if (!plugin?.name || !plugin.name.startsWith('vite:react-refresh')) {
      return plugin;
    }
    // Permanent CRX safeguard:
    // @vitejs/plugin-react injects an inline HTML preamble that declares
    // `injectIntoGlobalHook`. CRX's dev HTML pipeline can replay inline scripts
    // for extension pages, which makes that preamble run twice and blanks the
    // page with "Identifier 'injectIntoGlobalHook' has already been declared".
    // We disable the HTML-stage preamble here and initialize Fast Refresh from
    // the React page entry modules via `@vitejs/plugin-react/preamble`.
    const nextPlugin = { ...plugin };
    delete nextPlugin.transformIndexHtml;
    return nextPlugin;
  });
}

function createThemePluginServeJsxTransform() {
  return {
    name: 'crx:theme-plugin-serve-jsx-transform',
    apply: 'serve',
    enforce: 'pre',
    async transform(code, id) {
      const cleanId = toPosixPath(String(id || '').split('?', 1)[0]);
      if (!themePluginJsxPathPattern.test(cleanId)) {
        return null;
      }

      // CRXJS dev rebundles extension modules with only `crx:*` plugins, so
      // plugin-owned lazy widget chunks need an explicit JSX transform here.
      return transformWithEsbuild(code, cleanId, {
        loader: cleanId.endsWith('.tsx') ? 'tsx' : 'jsx',
        jsx: 'automatic',
        jsxDev: true,
        sourcemap: true,
      });
    },
  };
}

function createPixiNoUnsafeEvalShimPlugin() {
  const loadShim = (id) => {
    const cleanId = toPosixPath(String(id || '').split('?', 1)[0]);
    if (!cleanId.includes('/node_modules/@pixi/core/lib/shader/utils/')) {
      return null;
    }
    const fileName = cleanId.slice(cleanId.lastIndexOf('/') + 1);
    const shimPath = PIXI_NO_UNSAFE_EVAL_SHADER_UTILITY_SHIMS[fileName];
    return shimPath ? readFileSync(shimPath, 'utf8') : null;
  };

  return {
    name: 'entropy:pixi-no-unsafe-eval-shims',
    enforce: 'pre',
    resolveId(source) {
      const cleanSource = toPosixPath(String(source || '').split('?', 1)[0]);
      const fileName = cleanSource.slice(cleanSource.lastIndexOf('/') + 1);
      return PIXI_NO_UNSAFE_EVAL_SHADER_UTILITY_SHIMS[fileName] || null;
    },
    load(id) {
      return loadShim(id);
    },
  };
}

function createDevManifest(baseManifest, port) {
  const nextManifest = JSON.parse(JSON.stringify(baseManifest));
  const devConnectSrc = [
    "'self'",
    'https:',
    `http://localhost:${port}`,
    `ws://localhost:${port}`,
    `http://127.0.0.1:${port}`,
    `ws://127.0.0.1:${port}`,
  ].join(' ');
  const extensionPagesCsp = String(
    nextManifest?.content_security_policy?.extension_pages || ''
  );

  nextManifest.content_security_policy ||= {};
  nextManifest.content_security_policy.extension_pages = extensionPagesCsp.includes('connect-src')
    ? extensionPagesCsp.replace(/connect-src\s+[^;]+/i, `connect-src ${devConnectSrc}`)
    : `${extensionPagesCsp.replace(/;?\s*$/, ';')} connect-src ${devConnectSrc};`.trim();

  return nextManifest;
}

function createExtensionManifestFinalizePlugin(
  target,
  buildInfo,
  extensionOutDir,
  releaseProfile,
) {
  return {
    name: 'entropy-extension-manifest-finalize',
    enforce: 'post',
    writeBundle(outputOptions) {
      const manifestPath = resolve(outputOptions.dir || extensionOutDir, 'manifest.json');
      const manifestSource = readFileSync(manifestPath, 'utf8');
      writeFileSync(
        manifestPath,
        JSON.stringify(
          createExtensionManifestProfile(JSON.parse(manifestSource), target, {
            releaseProfile,
          }),
          null,
          2,
        ),
        'utf8',
      );
      writeFileSync(
        resolve(outputOptions.dir || extensionOutDir, 'entropy-build-info.json'),
        JSON.stringify(buildInfo, null, 2),
        'utf8',
      );
    },
  };
}

export default defineConfig(async ({ command, mode }) => {
  const visualHarnessServe = isVisualHarnessViteServe({ command, mode });
  const readOnlyViteConfigConsumer = isReadOnlyViteConfigConsumer({ mode });
  const releaseProfile = resolveReleaseProfile(command);
  const extensionOutDir = resolveExtensionOutDir(
    extensionBuildTarget,
    process.env.ENTROPY_EXTENSION_OUT_DIR,
    { releaseProfile },
  );
  if (!visualHarnessServe && !readOnlyViteConfigConsumer) {
    const preflightOutDir = resolveCliOutDir() || extensionOutDir;
    assertExtensionBuildOutputIsolation({
      targetInput: extensionBuildTarget,
      releaseProfile,
      outputDir: resolve(rootDir, preflightOutDir),
      chromeDevOutputDir: resolve(rootDir, 'dist'),
    });
  }
  const crx = visualHarnessServe || readOnlyViteConfigConsumer
    ? null
    : (await import('@crxjs/vite-plugin')).crx;
  const targetManifest = createExtensionManifestProfile(manifest, extensionBuildTarget, {
    releaseProfile,
  });
  const runtimeManifest = command === 'serve'
    ? createDevManifest(targetManifest, devPort)
    : targetManifest;
  const contentBootstrapDevSourceEntry = command === 'serve'
    ? 'src/apps/content/bootstrap.js'
    : '';
  const contentRootVisualReaderDevSourceEntry = command === 'serve'
    ? 'src/platform/storage/bootstrap/contentLoaderRootVisualReader.js'
    : '';
  const extensionRollupInput = {
    dashboard: resolve(pagesDir, 'dashboard.html'),
    gate: resolve(pagesDir, 'gate.html'),
    nudgeRenderHost: resolve(pagesDir, 'nudge-render-host.html'),
    popup: resolve(pagesDir, 'popup.html'),
    room478: resolve(pagesDir, 'room-478.html'),
    ...(releaseProfile === EXTENSION_RELEASE_PROFILES.DEV
      ? { offscreen: resolve(pagesDir, 'offscreen.html') }
      : {}),
    // Explicitly bundle content scripts used for dynamic injection.
    loader: resolve(contentDir, 'loader.js'),
    mediaFrameProbe: resolve(contentDir, 'mediaFrameProbe.js'),
    ...(command === 'build'
      ? {
          contentBootstrap: resolve(contentDir, 'bootstrap.js'),
          contentRootVisualReader: resolve(srcDir, 'platform/storage/bootstrap/contentLoaderRootVisualReader.js'),
        }
      : {}),
  };
  const releaseCapabilities = buildReleaseCapabilities(releaseProfile);
  const buildProvenance = createBuildProvenance();
  const emittedWorkerInventoryEntries = new Set();
  const runtimeBuildInfo = buildRuntimeBuildInfo({
    command,
    releaseProfile,
    provenance: buildProvenance,
  });
  const themeWidgetModuleMapPath = resolve(
    srcDir,
    'themes/core/loaders',
    releaseCapabilities.includeExperimentTab
      ? 'widgetModuleMap.dev.js'
      : 'widgetModuleMap.public.js',
  );
  const dashboardBootTelemetryModulePath = resolve(
    srcDir,
    'apps/dashboard/bootstrap',
    releaseCapabilities.includeDebugTools
      ? 'bootTelemetry.dev.js'
      : 'bootTelemetry.js',
  );
  const dashboardTabEntryTelemetryModulePath = resolve(
    srcDir,
    'apps/dashboard/loading',
    releaseCapabilities.includeDebugTools
      ? 'dashboardTabEntryTelemetry.dev.js'
      : 'dashboardTabEntryTelemetry.js',
  );
  const zenTraceModulePath = resolve(
    srcDir,
    'lib/debug',
    releaseCapabilities.includeDebugTools
      ? 'zenTrace.dev.js'
      : 'zenTrace.js',
  );
  const contentClseAlertOverlayModulePath = resolve(
    srcDir,
    'domains/behavior',
    releaseCapabilities.enableContentClseAlertOverlay
      ? 'clseAlertOverlayLoader.dev.js'
      : 'clseAlertOverlayLoader.js',
  );
  const contentClseReporterModulePath = resolve(
    srcDir,
    'domains/behavior/collectors',
    releaseCapabilities.enableContentClseReporter
      ? 'contentClseReporter.dev.js'
      : 'contentClseReporter.js',
  );
  const clseServiceRuntimeModulePath = resolve(
    srcDir,
    'domains/behavior',
    releaseCapabilities.includeClseLabs
      ? 'CLSEService.js'
      : 'CLSEService.public.js',
  );
  const dashboardExperimentTabEntryModulePath = resolve(
    srcDir,
    'apps/dashboard/labEntries',
    releaseCapabilities.includeExperimentTab
      ? 'experimentEntry.dev.js'
      : 'experimentEntry.public.js',
  );
  const dashboardFilterTabEntryModulePath = resolve(
    srcDir,
    'apps/dashboard/tabEntries',
    releaseCapabilities.includeDebugTools
      ? 'filterEntry.dev.js'
      : 'filterEntry.public.js',
  );
  const frictionDebugFlagsModulePath = resolve(
    srcDir,
    'platform/browser/dev',
    releaseCapabilities.includeDebugTools
      ? 'frictionDebugFlags.js'
      : 'frictionDebugFlags.public.js',
  );
  const runtimeDebuggerModulePath = resolve(
    srcDir,
    'domains/nudge/runtime-debugger',
    releaseCapabilities.includeDebugTools
      ? 'index.js'
      : 'runtimeDebugger.public.js',
  );
  const feedHorizonInspectionModulePath = resolve(
    srcDir,
    'domains/nudge/runtime-debugger/feed-horizon-inspection',
    releaseCapabilities.includeDebugTools
      ? 'feedHorizonInspection.dev.js'
      : 'feedHorizonInspection.public.js',
  );
  const runtimeDiscoveryLedgerModulePath = resolve(
    srcDir,
    'domains/nudge/runtime-debugger/discovery',
    releaseCapabilities.includeDebugTools
      ? 'runtimeDiscoveryLedger.dev.js'
      : 'runtimeDiscoveryLedger.public.js',
  );
  const runtimeContentionLedgerModulePath = resolve(
    srcDir,
    'domains/nudge/runtime-debugger/contention',
    releaseCapabilities.includeDebugTools
      ? 'runtimeContentionLedger.dev.js'
      : 'runtimeContentionLedger.public.js',
  );
  const shortFormTargetOutcomeModulePath = resolve(
    srcDir,
    'domains/nudge/short-form',
    releaseCapabilities.includeDebugTools
      ? 'shortFormTargetOutcome.dev.js'
      : 'shortFormTargetOutcome.public.js',
  );
  const interventionAdmissionRuntimeModulePath = resolve(
    srcDir,
    'domains/nudge/runtime',
    releaseCapabilities.enableSharedInterventionAdmission
      ? 'interventionAdmissionRuntime.dev.js'
      : 'interventionAdmissionRuntime.public.js',
  );
  const buildCapabilityContentRelayModulePath = releaseCapabilities.includeDebugTools
    ? resolve(
      srcDir,
      'domains/protection/content/buildCapabilityContentRelay.dev.js',
    )
    : resolve(
      srcDir,
      'domains/protection/content/buildCapabilityContentRelay.public.js',
    );
  const buildCapabilityMessageRoutesModulePath = releaseCapabilities.includeDebugTools
    ? resolve(
      srcDir,
      'apps/background/services/runtime/messageRoutes/buildCapabilityMessageRoutes.dev.js',
    )
    : resolve(
      srcDir,
      'apps/background/services/runtime/messageRoutes/buildCapabilityMessageRoutes.public.js',
    );
  const settingsPropagationQaFixtureModulePath = resolve(
    srcDir, 'apps/background/services/runtime/support',
    releaseCapabilities.includeDebugTools
      ? 'settingsPropagationQaFixture.dev.js'
      : 'settingsPropagationQaFixture.public.js',
  );
  const goalDeliveryQaStatsFixtureModulePath = resolve(
    srcDir, 'domains/stats/background/collection',
    releaseCapabilities.includeDebugTools
      ? 'goalDeliveryQaStatsFixture.dev.js'
      : 'goalDeliveryQaStatsFixture.public.js',
  );
  const progressionUnlockDebugControlModulePath = resolve(
    srcDir,
    'apps/dashboard/progression/dev',
    releaseCapabilities.includeDebugTools
      ? 'ProgressionUnlockDebugControl.dev.jsx'
      : 'ProgressionUnlockDebugControl.public.js',
  );
  const dashboardDevelopmentHudModulePath = resolve(
    srcDir,
    'apps/dashboard/components',
    releaseCapabilities.includeDebugTools
      ? 'DashboardDevelopmentHud.dev.jsx'
      : 'DashboardDevelopmentHud.public.js',
  );
  const firstVisionDevelopmentProjectionModulePath = resolve(
    srcDir,
    'apps/dashboard/progression/dev',
    releaseCapabilities.includeDebugTools
      ? 'FirstVisionDevelopmentProjection.dev.js'
      : 'FirstVisionDevelopmentProjection.public.js',
  );
  const progressionDebugActionsModulePath = resolve(
    srcDir,
    'domains/progression/debug',
    releaseCapabilities.includeDebugTools
      ? 'progressionDebugActions.dev.js'
      : 'progressionDebugActions.public.js',
  );
  const progressionDebugRepositoryModulePath = resolve(
    srcDir,
    'domains/progression/debug',
    releaseCapabilities.includeDebugTools
      ? 'progressionDebugRepository.dev.js'
      : 'progressionDebugRepository.public.js',
  );
  const progressionDebugContractModulePath = resolve(
    srcDir,
    'domains/progression/debug',
    releaseCapabilities.includeDebugTools
      ? 'progressionUnlockDebugContract.dev.js'
      : 'progressionUnlockDebugContract.public.js',
  );
  const qaProgressionProvisioningRoutesModulePath = resolve(
    srcDir,
    'apps/background/services/runtime/messageRoutes',
    releaseCapabilities.includeDebugTools
      ? 'qaProgressionProvisioningMessageRoutes.dev.js'
      : 'qaProgressionProvisioningMessageRoutes.public.js',
  );
  const zenMainCaptureProfileModulePath = resolve(
    srcDir,
    'apps/dashboard/qa',
    releaseCapabilities.includeDebugTools
      ? 'zenMainCaptureProfile.dev.js'
      : 'zenMainCaptureProfile.public.js',
  );
  const sitesIntelCaptureProfileModulePath = resolve(srcDir, 'apps/dashboard/qa',
    releaseCapabilities.includeDebugTools ? 'sitesIntelCaptureProfile.dev.js' : 'sitesIntelCaptureProfile.public.js');
  const disabledZenExperimentalWorkerPath = `${resolve(
    srcDir,
    'platform/workers/disabledZenExperimentalWorker.worker.js',
  )}?worker`;
  const resolveZenExperimentalWorkerPath = (fileName) => (
    releaseCapabilities.includeZenExperimentalWorkers
      ? `${resolve(srcDir, 'themes/plugins/zen/workers', fileName)}?worker`
      : disabledZenExperimentalWorkerPath
  );
  const zenVNextGrowthVMV3ModulePath = resolve(
    srcDir,
    'themes/plugins/zen/model/vnext/core',
    releaseCapabilities.includeZenVNext
      ? 'GrowthVMV3.dev.js'
      : 'GrowthVMV3.public.js',
  );
  const zenCoreStatusVNextEntryModulePath = resolve(
    srcDir,
    'themes/plugins/zen/runtime/buildEntries',
    releaseCapabilities.includeZenVNext
      ? 'zenCoreStatusVNext.dev.js'
      : 'zenCoreStatusVNext.public.js',
  );
  const zenCoreStatusClassicExperimentEntryModulePath = resolve(
    srcDir,
    'themes/plugins/zen/runtime/buildEntries',
    releaseCapabilities.includeZenClassicExperiments
      ? 'zenCoreStatusClassicExperiment.dev.js'
      : 'zenCoreStatusClassicExperiment.public.js',
  );
  const zenDevelopmentWorkspaceStateEntryModulePath = resolve(
    srcDir,
    'themes/plugins/zen/runtime/buildEntries',
    releaseCapabilities.includeDebugTools
      ? 'zenDevelopmentWorkspaceState.dev.js'
      : 'zenDevelopmentWorkspaceState.public.js',
  );

  return {
    // 프로젝트 루트를 기준으로 public 폴더를 지정합니다.
    publicDir: resolve(rootDir, 'public'),

    legacy: {
      skipWebSocketTokenCheck: true,
    },

    define: {
      // Keep the classic loader on a single canonical artifact path in
      // production. Dev injects a raw-source development candidate for serve sessions only.
      __CONTENT_BOOTSTRAP_DEV_SOURCE_ENTRY__: JSON.stringify(contentBootstrapDevSourceEntry),
      __CONTENT_ROOT_VISUAL_READER_DEV_SOURCE_ENTRY__: JSON.stringify(contentRootVisualReaderDevSourceEntry),
      __ENTROPY_RELEASE_PROFILE__: JSON.stringify(releaseProfile),
      __ENTROPY_BUILD_INCLUDE_EXPERIMENT_TAB__: JSON.stringify(releaseCapabilities.includeExperimentTab),
      __ENTROPY_BUILD_INCLUDE_ZEN_CLASSIC_EXPERIMENTS__: JSON.stringify(releaseCapabilities.includeZenClassicExperiments),
      __ENTROPY_BUILD_INCLUDE_ZEN_VNEXT__: JSON.stringify(releaseCapabilities.includeZenVNext),
      __ENTROPY_BUILD_INCLUDE_ZEN_EXPERIMENTAL_WORKERS__: JSON.stringify(releaseCapabilities.includeZenExperimentalWorkers),
      __ENTROPY_BUILD_INCLUDE_CLSE_LABS__: JSON.stringify(releaseCapabilities.includeClseLabs),
      __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__: JSON.stringify(releaseCapabilities.includeDebugTools),
      __ENTROPY_BUILD_ENABLE_SHARED_INTERVENTION_ADMISSION__: JSON.stringify(releaseCapabilities.enableSharedInterventionAdmission),
      __ENTROPY_BUILD_ENABLE_CONTENT_FLOW_SIGNALS__: JSON.stringify(releaseCapabilities.enableContentFlowSignals),
      __ENTROPY_BUILD_ENABLE_CONTENT_CLSE_REPORTER__: JSON.stringify(releaseCapabilities.enableContentClseReporter),
      __ENTROPY_BUILD_ENABLE_CONTENT_CLSE_ALERT_OVERLAY__: JSON.stringify(releaseCapabilities.enableContentClseAlertOverlay),
      __ENTROPY_BUILD_ENABLE_VIDEO_SKIP_COOLDOWN__: JSON.stringify(releaseCapabilities.enableVideoSkipCooldown),
      __ENTROPY_EXTENSION_TARGET__: JSON.stringify(extensionBuildTarget),
      __ENTROPY_BUILD_ID__: JSON.stringify(runtimeBuildInfo.buildId),
      __ENTROPY_BUILD_CREATED_AT__: JSON.stringify(runtimeBuildInfo.createdAt),
    },

    resolve: {
      alias: {
        // 매니페스트나 코드에서 '/apps' 등으로 시작하는 경로를 src 내부로 연결합니다.
        '/apps': resolve(srcDir, 'apps'),
        '/pages': resolve(srcDir, 'pages'),
        '@': srcDir,
        '@clse-service-runtime': clseServiceRuntimeModulePath,
        '@dashboard-boot-telemetry': dashboardBootTelemetryModulePath,
        '@dashboard-tab-entry-telemetry': dashboardTabEntryTelemetryModulePath,
        '@dashboard-experiment-tab-entry': dashboardExperimentTabEntryModulePath,
        '@dashboard-filter-tab-entry': dashboardFilterTabEntryModulePath,
        '@content-clse-alert-overlay': contentClseAlertOverlayModulePath,
        '@content-clse-reporter': contentClseReporterModulePath,
        '@friction-debug-flags': frictionDebugFlagsModulePath,
        '@feed-horizon-inspection': feedHorizonInspectionModulePath,
        '@runtime-debugger': runtimeDebuggerModulePath,
        '@runtime-contention-ledger': runtimeContentionLedgerModulePath,
        '@runtime-discovery-ledger': runtimeDiscoveryLedgerModulePath,
        '@short-form-target-outcome': shortFormTargetOutcomeModulePath,
        '@intervention-admission-runtime': interventionAdmissionRuntimeModulePath,
        '@build-capability-content-relay': buildCapabilityContentRelayModulePath,
        '@build-capability-message-routes': buildCapabilityMessageRoutesModulePath,
        '@settings-propagation-qa-fixture': settingsPropagationQaFixtureModulePath,
        '@goal-delivery-qa-stats-fixture': goalDeliveryQaStatsFixtureModulePath,
        '@first-vision-development-projection': firstVisionDevelopmentProjectionModulePath,
        '@progression-debug-actions': progressionDebugActionsModulePath,
        '@progression-debug-contract': progressionDebugContractModulePath,
        '@progression-debug-repository': progressionDebugRepositoryModulePath,
        '@progression-unlock-debug-control': progressionUnlockDebugControlModulePath,
        '@dashboard-development-hud': dashboardDevelopmentHudModulePath,
        '@qa-progression-provisioning-routes': qaProgressionProvisioningRoutesModulePath,
        '@theme-widget-module-map': themeWidgetModuleMapPath,
        '@zen-main-capture-profile': zenMainCaptureProfileModulePath,
        '@sites-intel-capture-profile': sitesIntelCaptureProfileModulePath,
        '@zen-trace': zenTraceModulePath,
        '@zen-ab-trial-worker': resolveZenExperimentalWorkerPath('zenAbTrialEvaluator.worker.js'),
        '@zen-core-status-classic-experiment-entry': zenCoreStatusClassicExperimentEntryModulePath,
        '@zen-core-status-vnext-entry': zenCoreStatusVNextEntryModulePath,
        '@zen-development-workspace-state-entry': zenDevelopmentWorkspaceStateEntryModulePath,
        '@zen-latent-optimizer-worker': resolveZenExperimentalWorkerPath('zenLatentOptimizer.worker.js'),
        '@zen-vnext-growth-vm-v3': zenVNextGrowthVMV3ModulePath,
        '@zen-vnext-optimizer-worker': resolveZenExperimentalWorkerPath('zenVNextOptimizer.worker.js'),
        '@zen-vnext-preference-trainer-worker': resolveZenExperimentalWorkerPath('zenVNextPreferenceTrainer.worker.js'),
        url: resolve(srcDir, 'platform/browserNodeShims/url.js'),
      },
    },

    optimizeDeps: {
      ...(visualHarnessServe ? { entries: ['src/apps/visual-harness/main.jsx'] } : {}),
      include: ['eventemitter3', 'earcut', ...(visualHarnessServe ? ['react-dom/server'] : [])],
      exclude: ['pixi.js', '@pixi/core', '@pixi/unsafe-eval'],
    },

    build: {
      outDir: extensionOutDir,
      emptyOutDir: true,
      manifest: true,
      minify: releaseProfile === EXTENSION_RELEASE_PROFILES.DEV ? false : 'esbuild',
      target: extensionViteBuildTarget,
      ...(extensionUsesChromeCompatibilityContract
        ? { cssTarget: CHROME_COMPATIBILITY_CONTRACT.viteTarget }
        : {}),
      modulePreload: false,
      chunkSizeWarningLimit: 1500,
      // The MV3 background entry is intentionally kept statically reachable.
      // Context-closure budgets and the service-worker contract are the hard
      // gates; background modules stay in Rollup's natural static graph so a
      // manual chunk cannot absorb UI-shared dependencies.
      rollupOptions: {
        // The classic content loader dynamically imports the built bootstrap entry
        // and requires its named export contract to survive bundling.
        preserveEntrySignatures: 'exports-only',
        plugins: [
          createPixiNoUnsafeEvalShimPlugin(),
        ],
        output: {
          entryFileNames: resolveEntryFileName,
          manualChunks: resolveManualChunk,
        },
        input: extensionRollupInput,
      },
    },

    worker: {
      format: 'es',
      plugins: () => [
        createWorkerArtifactModuleInventoryPlugin(emittedWorkerInventoryEntries),
      ],
    },

    plugins: visualHarnessServe
      ? [
          ...tailwindcss(),
          createPixiNoUnsafeEvalShimPlugin(),
          ...createReactPlugins(),
        ]
      : [
          ...tailwindcss(),
          createBuildOutputIsolationPlugin({
            command,
            readOnlyViteConfigConsumer,
            releaseProfile,
            extensionOutDir,
          }),
          createPixiNoUnsafeEvalShimPlugin(),
          createThemePluginServeJsxTransform(),
          ...createReactPlugins(),
          ...(crx ? [crx({ manifest: runtimeManifest })] : []),
          createPrepaintVisualAssetsPlugin(),
          createArtifactModuleInventoryPlugin(emittedWorkerInventoryEntries),
          createExtensionManifestFinalizePlugin(
            extensionBuildTarget,
            runtimeBuildInfo,
            extensionOutDir,
            releaseProfile,
          ),
        ],

    server: {
      host: '127.0.0.1',
      port: devPort,
      strictPort: true,
      cors: {
        origin: [
          /chrome-extension:\/\//,
          `http://localhost:${devPort}`,
          `http://127.0.0.1:${devPort}`,
        ],
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
      },
      // The dashboard is an extension-owned surface. Opening its source HTML
      // over HTTP strips the chrome-extension origin and makes canonical
      // settings/runtime relays fail by contract. Load dist/ as an unpacked
      // extension and open its options page instead.
      open: false,
    },
    preview: {
      host: '127.0.0.1',
      open: false,
    },
  };
});
