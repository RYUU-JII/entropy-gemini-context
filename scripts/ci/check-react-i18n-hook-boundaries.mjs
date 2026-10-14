import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, 'src');
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const ignoredCompatibilityRoots = [
  path.join(srcRoot, 'entries'),
  path.join(srcRoot, 'features'),
  path.join(srcRoot, 'shared'),
];

const governedEntries = [
  { file: 'src/apps/dashboard/tabs/settings/SettingsTab.jsx', namespace: 'settings' },
  { file: 'src/apps/dashboard/tabs/settings/components/DataLifecyclePanel.jsx', namespace: 'settings' },
  { file: 'src/apps/dashboard/tabs/settings/components/PermissionGate.jsx', namespace: 'settings' },
  { file: 'src/apps/dashboard/tabs/settings/components/LanguagePanel.jsx', namespace: 'settings' },
  { file: 'src/apps/dashboard/tabs/settings/components/SecurityPanel.jsx', namespace: 'settings' },
  { file: 'src/apps/dashboard/tabs/experiment/clse/CLSELab.jsx', namespace: 'settings' },
  { file: 'src/apps/dashboard/tabs/main/MainTab.jsx', namespace: 'main' },
  { file: 'src/apps/dashboard/tabs/main/home/HomeScanWorkspace.jsx', namespace: 'main' },
  { file: 'src/apps/dashboard/tabs/filter/FilterTab.jsx', namespace: 'filter' },
  { file: 'src/apps/dashboard/tabs/tools/ToolsTab.jsx', namespace: 'tools' },
  { file: 'src/apps/dashboard/tabs/experiment/ExperimentWorkspace.jsx', namespace: 'tools' },
  { file: 'src/apps/dashboard/tabs/experiment/ExperimentHubTab.jsx', namespace: 'tools' },
  { file: 'src/apps/dashboard/tabs/experiment/WorkerRuntimePanel.jsx', namespace: 'tools' },
  { file: 'src/apps/dashboard/DashboardPage.jsx', namespace: 'dashboard' },
  { file: 'src/apps/popup/PopupApp.jsx', namespace: 'common' },
  { file: 'src/themes/core/appearance/transitions/BootSequence.jsx', namespace: 'common' },
  { file: 'src/apps/dashboard/layout/Sidebar.jsx', namespace: 'common' },
  { file: 'src/ui-kit/BootLoader.jsx', namespace: 'common' },
  { file: 'src/ui-kit/ShadowPicker.jsx', namespace: 'common' },
  { file: 'src/ui-kit/ToastProvider.jsx', namespace: 'common' },
  { file: 'src/themes/plugins/zen/pond/app/ZenSignalScannerSurface.jsx', namespace: 'tools' },
  { file: 'src/themes/plugins/zen/pond/app/ZenKoiTunerPanel.jsx', namespace: 'tools' },
  { file: 'src/themes/plugins/zen/widgets/tools/FurinTuner.jsx', namespace: 'tools' },
  { file: 'src/themes/plugins/zen/widgets/tools/ShishiOdoshiTuner.jsx', namespace: 'tools' },
];

const failures = [];

function walkSourceFiles(dirPath) {
  if (ignoredCompatibilityRoots.some((ignoredRoot) => dirPath === ignoredRoot)) {
    return [];
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSourceFiles(absolutePath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!sourceExtensions.has(path.extname(entry.name))) continue;
    files.push(absolutePath);
  }

  return files;
}

for (const entry of governedEntries) {
  const absPath = path.join(repoRoot, entry.file);
  const source = fs.readFileSync(absPath, 'utf8');
  const expectedSingle = `useAppTranslation('${entry.namespace}')`;
  const expectedDouble = `useAppTranslation("${entry.namespace}")`;

  if (!source.includes(expectedSingle) && !source.includes(expectedDouble)) {
    failures.push(`${entry.file} must use useAppTranslation('${entry.namespace}') as its React i18n entrypoint.`);
  }

  if (source.includes("from 'react-i18next'") || source.includes('from "react-i18next"')) {
    failures.push(`${entry.file} must not import useTranslation directly from react-i18next.`);
  }

  if (source.includes('useThemeTranslation(')) {
    failures.push(`${entry.file} must not use useThemeTranslation directly in governed UI.`);
  }
}

for (const absolutePath of walkSourceFiles(srcRoot)) {
  const relativePath = path.relative(repoRoot, absolutePath).split(path.sep).join('/');

  const source = fs.readFileSync(absolutePath, 'utf8');
  if (source.includes('useThemeTranslation(') || source.includes('useThemeTranslation.js')) {
    failures.push(`${relativePath} must not use retired useThemeTranslation; use useAppTranslation instead.`);
  }
}

if (failures.length > 0) {
  console.error('[react-i18n-hook-boundaries] Contract violation detected:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[react-i18n-hook-boundaries] PASS: governed React UI surfaces use useAppTranslation consistently.');
