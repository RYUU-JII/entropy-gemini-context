import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { assertCanonicalCwsExtensionId, assertChromeWebStoreDetailUrl } from './scripts/release/cwsReleaseIdentity.mjs';

const repositoryRoot = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(repositoryRoot, 'src/apps/feed-landing');

function resolveStoreUrl(environment) {
  const value = environment.VITE_FEED_CHROME_STORE_URL;
  if (value === undefined || value === '') return null;
  const extensionId = assertCanonicalCwsExtensionId(environment.ENTROPY_CWS_EXTENSION_ID);
  return assertChromeWebStoreDetailUrl(value, { expectedExtensionId: extensionId }).url;
}

function licensePlugin() {
  return {
    name: 'feed-landing-licenses',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'licenses/OFL-NotoSansKR.txt', source: readFileSync(resolve(repositoryRoot, 'node_modules/@fontsource-variable/noto-sans-kr/LICENSE'), 'utf8') });
      this.emitFile({ type: 'asset', fileName: 'licenses/THIRD_PARTY_NOTICES.txt', source: readFileSync(resolve(repositoryRoot, 'public/THIRD_PARTY_NOTICES.txt'), 'utf8') });
    },
  };
}

export default defineConfig(({ mode }) => ({
  root: appRoot,
  base: './',
  appType: 'mpa',
  publicDir: false,
  plugins: [react(), licensePlugin()],
  define: {
    __ENTROPY_FEED_STORE_URL__: JSON.stringify(resolveStoreUrl({ ...loadEnv(mode, repositoryRoot, ['VITE_', 'ENTROPY_']), ...process.env })),
  },
  build: {
    outDir: resolve(repositoryRoot, 'dist-feed-landing'),
    emptyOutDir: true,
    target: 'chrome129',
    cssTarget: 'chrome129',
    rollupOptions: { input: { feed: resolve(appRoot, 'index.html'), privacy: resolve(appRoot, 'privacy/index.html') } },
  },
  server: { host: '127.0.0.1', open: false },
  preview: { host: '127.0.0.1', open: false },
}));
