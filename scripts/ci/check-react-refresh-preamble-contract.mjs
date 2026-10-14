import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const rootDir = process.cwd();

const CONTRACT_FILES = {
  viteConfig: 'vite.config.js',
  sharedPreamble: 'src/platform/chrome/dev/reactRefreshPreamble.js',
  dashboardHtmlEntry: 'src/pages/dashboard.html',
  dashboardPageEntry: 'src/apps/dashboard/dashboardPageEntry.js',
  entryFiles: [
    'src/apps/dashboard/main.jsx',
    'src/apps/popup/main.jsx',
    'src/apps/visual-harness/main.jsx',
  ],
  forbiddenEntryFiles: [
    'src/apps/background/index.js',
    'src/apps/content/bootstrap.js',
    'src/apps/content/bootstrapController.js',
    'src/apps/content/loader.js',
    'src/apps/dashboard/bootShell.js',
  ],
};

async function readText(relativePath) {
  const filePath = path.resolve(rootDir, relativePath);
  return readFile(filePath, 'utf8');
}

const failures = [];

function assertIncludes(content, needle, failureMessage) {
  if (!content.includes(needle)) {
    failures.push(failureMessage);
  }
}

const viteConfig = await readText(CONTRACT_FILES.viteConfig);
assertIncludes(
  viteConfig,
  "plugin.name.startsWith('vite:react-refresh')",
  'vite.config.js must detect vite:react-refresh plugins before stripping HTML preambles.',
);
assertIncludes(
  viteConfig,
  'delete nextPlugin.transformIndexHtml;',
  'vite.config.js must remove transformIndexHtml from vite:react-refresh plugins.',
);
assertIncludes(
  viteConfig,
  'injectIntoGlobalHook',
  'vite.config.js must document the CRX/react-refresh injectIntoGlobalHook collision.',
);
assertIncludes(
  viteConfig,
  'open: false,',
  'vite.config.js must not auto-open an HTTP dashboard without extension runtime/storage ownership.',
);
if (viteConfig.includes("open: '/src/pages/dashboard.html'")) {
  failures.push('vite.config.js must not open the extension-owned dashboard as a localhost source page.');
}

const sharedPreamble = await readText(CONTRACT_FILES.sharedPreamble);
assertIncludes(
  sharedPreamble,
  "import '@vitejs/plugin-react/preamble';",
  'src/platform/chrome/dev/reactRefreshPreamble.js must import @vitejs/plugin-react/preamble.',
);

const dashboardHtmlEntry = await readText(CONTRACT_FILES.dashboardHtmlEntry);
assertIncludes(
  dashboardHtmlEntry,
  '/src/apps/dashboard/dashboardPageEntry.js',
  'src/pages/dashboard.html must load /src/apps/dashboard/dashboardPageEntry.js as the module entry.',
);

const dashboardPageEntry = await readText(CONTRACT_FILES.dashboardPageEntry);
assertIncludes(
  dashboardPageEntry,
  "import '../../platform/chrome/dev/reactRefreshPreamble.js';",
  'src/apps/dashboard/dashboardPageEntry.js must import the shared reactRefreshPreamble helper before boot shell startup.',
);
assertIncludes(
  dashboardPageEntry,
  "import './bootShell.js';",
  'src/apps/dashboard/dashboardPageEntry.js must import ./bootShell.js after the shared reactRefreshPreamble helper.',
);

for (const entryFile of CONTRACT_FILES.entryFiles) {
  const source = await readText(entryFile);
  assertIncludes(
    source,
    "import '../../platform/chrome/dev/reactRefreshPreamble.js';",
    `${entryFile} must import ../../platform/chrome/dev/reactRefreshPreamble.js before React renders.`,
  );
  if (source.includes("@vitejs/plugin-react/preamble")) {
    failures.push(`${entryFile} must use the shared reactRefreshPreamble helper instead of importing @vitejs/plugin-react/preamble directly.`);
  }
}

for (const entryFile of CONTRACT_FILES.forbiddenEntryFiles) {
  const source = await readText(entryFile);
  if (source.includes('reactRefreshPreamble') || source.includes('@vitejs/plugin-react/preamble')) {
    failures.push(`${entryFile} must not import React refresh preambles because it is not an HTML React page entry.`);
  }
}

if (failures.length > 0) {
  console.error('[check-react-refresh-preamble-contract] Contract violation detected:');
  failures.forEach((failure) => {
    console.error(`- ${failure}`);
  });
  process.exit(1);
}
