#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const failures = [];

const governedFiles = Object.freeze([
  {
    file: 'src/apps/dashboard/tabs/filter/preview/PreviewMockupTop.jsx',
    requiredKeys: ['preview.chrome.select_platform', 'preview.chrome.protocol_prefix', 'preview.chrome.domain_suffix'],
  },
  {
    file: 'src/apps/dashboard/tabs/filter/preview/platforms/SignalTestPattern.jsx',
    requiredKeys: [
      "pt('calibration_signal'",
      "pt('readability_test'",
      "pt('live_signal'",
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/filter/preview/platforms/Instagram.jsx',
    requiredKeys: [
      "pi('sidebar.threats'",
      "pi('suggestion.for_you'",
      "pi('suggestion.see_all'",
      "pi('suggestion.switch'",
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/filter/preview/platforms/TikTok.jsx',
    requiredKeys: [
      "tt('header.search_placeholder'",
      "tt('header.upload'",
      "tt('header.login'",
      "tt('nav.for_you'",
      "tt('sidebar.suggested_accounts'",
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/filter/preview/platforms/X.jsx',
    requiredKeys: [
      "tx('nav.home'",
      "tx('compose.post'",
      "tx('compose.placeholder'",
      "tx('search.placeholder'",
      "tx('trends.show_more'",
    ],
  },
  {
    file: 'src/apps/dashboard/tabs/filter/preview/platforms/Youtube.jsx',
    requiredKeys: [
      "preview.youtube.actions.reply",
      "preview.youtube.actions.delete",
      "preview.youtube.actions.add_reply_placeholder",
      "preview.youtube.actions.cancel",
      "yt('search.placeholder'",
      "yt('comments.sort_top'",
      "yt('comments.sort_newest'",
      "yt('dialogs.delete_comment_title'",
      "yt('dialogs.delete_comment_body'",
    ],
  },
]);

async function main() {
  for (const entry of governedFiles) {
    const source = await fs.readFile(path.resolve(rootDir, entry.file), 'utf8');
    if (!source.includes("useAppTranslation('settings')") && !source.includes('useAppTranslation("settings")')) {
      failures.push(`${entry.file} must use useAppTranslation('settings') for preview chrome copy.`);
    }
    entry.requiredKeys.forEach((snippet) => {
      if (!source.includes(snippet)) {
        failures.push(`${entry.file} must reference locale key "${snippet}".`);
      }
    });
  }

  const constantsSource = await fs.readFile(
    path.resolve(rootDir, 'src/apps/dashboard/tabs/filter/preview/constants.js'),
    'utf8'
  );
  if (!constantsSource.includes('labelKey:')) {
    failures.push('src/apps/dashboard/tabs/filter/preview/constants.js must define labelKey for preview platforms.');
  }

  if (failures.length > 0) {
    console.error('[settings-preview-i18n-contract] Contract violation detected:');
    failures.forEach((failure) => {
      console.error(`- ${failure}`);
    });
    process.exit(1);
    return;
  }

  console.log('[settings-preview-i18n-contract] PASS: preview/mock chrome copy is governed by locale-backed contracts.');
}

main().catch((error) => {
  console.error('[settings-preview-i18n-contract] Unexpected error:', error);
  process.exit(1);
});
