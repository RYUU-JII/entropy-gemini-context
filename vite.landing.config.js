import react from '@vitejs/plugin-react';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

import { CHROME_COMPATIBILITY_CONTRACT } from './src/platform/extension/chromeCompatibilityContract.js';
import {
  LANDING_SUPPORT_URL_TOKEN,
  injectLandingSupportUrl,
  resolveLandingSupportUrl,
} from './scripts/release/landingSupportContact.mjs';
import {
  assertCanonicalCwsExtensionId,
  assertChromeWebStoreDetailUrl,
} from './scripts/release/cwsReleaseIdentity.mjs';

const repositoryRoot = dirname(fileURLToPath(import.meta.url));
const landingRoot = resolve(repositoryRoot, 'src/apps/landing');
const landingOutDir = resolve(repositoryRoot, 'dist-landing');
const sunflowerLicensePath = resolve(
  landingRoot,
  'assets/fonts/OFL-Sunflower.txt',
);
const notoSansKrLicensePath = resolve(
  repositoryRoot,
  'node_modules/@fontsource-variable/noto-sans-kr/LICENSE',
);
const sharedThirdPartyNoticesPath = resolve(
  repositoryRoot,
  'public/THIRD_PARTY_NOTICES.txt',
);
const LANDING_DEV_CHROME_STORE_URL = '#entropy-landing-store-link-development';
const LANDING_BUILD_INFO_FILE = 'entropy-landing-build-info.json';
const LANDING_DEBUG_QUERY_MARKER = 'landingDebug';
const LANDING_DEBUG_MODULE_SUFFIX = '/src/apps/landing/components/LandingDebugHud.jsx';

const landingPageCandidates = Object.freeze({
  landing: resolve(landingRoot, 'index.html'),
  privacy: resolve(landingRoot, 'privacy/index.html'),
  support: resolve(landingRoot, 'support/index.html'),
});

function resolveLandingPageInputs() {
  if (!existsSync(landingPageCandidates.landing)) {
    throw new Error(
      `[landing-build] Missing canonical HTML entry: ${landingPageCandidates.landing}`,
    );
  }

  return Object.fromEntries(
    Object.entries(landingPageCandidates)
      .filter(([, entryPath]) => existsSync(entryPath)),
  );
}

function resolveChromeStoreIdentity({ command, environment }) {
  const configuredUrl = environment.VITE_CHROME_STORE_URL?.trim();

  if (command === 'build') {
    const extensionId = assertCanonicalCwsExtensionId(
      environment.ENTROPY_CWS_EXTENSION_ID,
    );
    return assertChromeWebStoreDetailUrl(configuredUrl, {
      expectedExtensionId: extensionId,
    });
  }

  if (configuredUrl) {
    return assertChromeWebStoreDetailUrl(configuredUrl, {
      expectedExtensionId: environment.ENTROPY_CWS_EXTENSION_ID || undefined,
    });
  }
  return Object.freeze({ extensionId: null, url: LANDING_DEV_CHROME_STORE_URL });
}

function readGitIdentity(args) {
  const result = spawnSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(
      `[landing-build] Git identity unavailable: git ${args.join(' ')}: ${String(result.stderr || '').trim()}`,
    );
  }
  return String(result.stdout || '').trim();
}

function createLandingBuildInfo({ chromeStoreIdentity, supportUrl }) {
  const createdAt = new Date().toISOString();
  const gitCommitSha = readGitIdentity(['rev-parse', 'HEAD']);
  const gitTreeSha = readGitIdentity(['rev-parse', 'HEAD^{tree}']);
  const dirty = Boolean(readGitIdentity([
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ]));
  const lockfileSha256 = createHash('sha256')
    .update(readFileSync(resolve(repositoryRoot, 'package-lock.json')))
    .digest('hex');
  const timestamp = createdAt.replace(/[-:.TZ]/gu, '').slice(0, 14);
  return Object.freeze({
    schemaVersion: 1,
    kind: 'entropy-public-landing-build',
    buildId: `${timestamp}-${gitCommitSha.slice(0, 12)}-${dirty ? 'dirty' : 'clean'}`,
    createdAt,
    dirty,
    gitCommitSha,
    gitTreeSha,
    lockfileSha256,
    chromeWebStore: {
      extensionId: chromeStoreIdentity.extensionId,
      url: chromeStoreIdentity.url,
    },
    supportUrl,
  });
}

function createLandingReleaseSurfacePlugin({ command, chromeStoreIdentity, supportUrl }) {
  if (command !== 'build') return null;
  const buildInfo = createLandingBuildInfo({ chromeStoreIdentity, supportUrl });
  return {
    name: 'entropy-landing-release-surface',
    generateBundle(_outputOptions, bundle) {
      const debugChunks = Object.values(bundle)
        .filter((entry) => entry.type === 'chunk' && (
          entry.code.includes(LANDING_DEBUG_QUERY_MARKER)
          || Object.keys(entry.modules || {}).some((moduleId) => (
            moduleId.replaceAll('\\', '/').endsWith(LANDING_DEBUG_MODULE_SUFFIX)
          ))
        ))
        .map((entry) => entry.fileName);
      if (debugChunks.length > 0) {
        throw new Error(
          `[landing-build] Production landing contains debug runtime surface: ${debugChunks.join(', ')}`,
        );
      }
      this.emitFile({
        type: 'asset',
        fileName: LANDING_BUILD_INFO_FILE,
        source: `${JSON.stringify(buildInfo, null, 2)}\n`,
      });
    },
  };
}

function createLandingSupportContactPlugin(supportUrl) {
  injectLandingSupportUrl(
    readFileSync(landingPageCandidates.support, 'utf8'),
    supportUrl,
  );

  return {
    name: 'entropy-landing-support-contact',
    transformIndexHtml(html) {
      if (!html.includes(LANDING_SUPPORT_URL_TOKEN)) return html;
      return injectLandingSupportUrl(html, supportUrl);
    },
  };
}

function createLandingFontLicensePlugin() {
  if (!existsSync(sunflowerLicensePath)) {
    throw new Error(`[landing-build] Missing bundled font license: ${sunflowerLicensePath}`);
  }
  if (!existsSync(notoSansKrLicensePath)) {
    throw new Error(`[landing-build] Missing bundled font license: ${notoSansKrLicensePath}`);
  }
  if (!existsSync(sharedThirdPartyNoticesPath)) {
    throw new Error(`[landing-build] Missing shared third-party notices: ${sharedThirdPartyNoticesPath}`);
  }

  return {
    name: 'entropy-landing-font-license',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'licenses/OFL-Sunflower.txt',
        source: readFileSync(sunflowerLicensePath),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'licenses/OFL-NotoSansKR.txt',
        source: readFileSync(notoSansKrLicensePath),
      });
      this.emitFile({
        type: 'asset',
        fileName: 'licenses/THIRD_PARTY_NOTICES.txt',
        source: readFileSync(sharedThirdPartyNoticesPath),
      });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const environment = {
    ...loadEnv(mode, repositoryRoot, 'VITE_'),
    ...process.env,
  };
  const chromeStoreIdentity = resolveChromeStoreIdentity({ command, environment });
  const supportUrl = resolveLandingSupportUrl({ command, environment });

  return {
    root: landingRoot,
    base: './',
    appType: 'mpa',
    publicDir: false,

    define: {
      __ENTROPY_LANDING_CHROME_STORE_URL__: JSON.stringify(chromeStoreIdentity.url),
      __ENTROPY_LANDING_DEBUG_ENABLED__: JSON.stringify(command !== 'build'),
    },

    plugins: [
      react(),
      createLandingSupportContactPlugin(supportUrl),
      createLandingFontLicensePlugin(),
      createLandingReleaseSurfacePlugin({ command, chromeStoreIdentity, supportUrl }),
    ].filter(Boolean),

    build: {
      outDir: landingOutDir,
      emptyOutDir: true,
      target: CHROME_COMPATIBILITY_CONTRACT.viteTarget,
      cssTarget: CHROME_COMPATIBILITY_CONTRACT.viteTarget,
      rollupOptions: {
        input: resolveLandingPageInputs(),
      },
    },

    server: {
      host: '127.0.0.1',
      open: false,
    },

    preview: {
      host: '127.0.0.1',
      open: false,
    },
  };
});
