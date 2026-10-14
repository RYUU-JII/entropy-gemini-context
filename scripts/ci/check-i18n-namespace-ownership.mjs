#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const supportedFileRe = /\.(js|jsx|ts|tsx)$/;
const failures = [];

const localeContracts = Object.freeze([
  {
    file: 'src/i18n/locales/en/filter.json',
    requiredRoots: ['filter', 'runtime_insights'],
    forbiddenRoots: ['main', 'garden', 'target_protocol'],
  },
  {
    file: 'src/i18n/locales/ko/filter.json',
    requiredRoots: ['filter', 'runtime_insights'],
    forbiddenRoots: ['main', 'garden', 'target_protocol'],
  },
  {
    file: 'src/i18n/locales/en/dashboard.json',
    requiredRoots: ['main', 'experiment', 'sites', 'settings', 'theme', 'tools', 'filter', 'schedule'],
    forbiddenRoots: ['runtime_insights', 'target_protocol', 'clse'],
  },
  {
    file: 'src/i18n/locales/ko/dashboard.json',
    requiredRoots: ['main', 'experiment', 'sites', 'settings', 'theme', 'tools', 'filter', 'schedule'],
    forbiddenRoots: ['runtime_insights', 'target_protocol', 'clse'],
  },
  {
    file: 'src/i18n/locales/en/tools.json',
    requiredRoots: ['tools', 'header', 'artifacts', 'matrix', 'status', 'units', 'sentinel_flare_protocol'],
    forbiddenRoots: ['main', 'garden', 'filter', 'runtime_insights', 'target_protocol', 'theme'],
  },
  {
    file: 'src/i18n/locales/ko/tools.json',
    requiredRoots: ['tools', 'header', 'artifacts', 'matrix', 'status', 'units', 'sentinel_flare_protocol'],
    forbiddenRoots: ['main', 'garden', 'filter', 'runtime_insights', 'target_protocol', 'theme'],
  },
  {
    file: 'src/i18n/locales/en/theme.json',
    requiredRoots: ['theme'],
    forbiddenRoots: ['main', 'garden', 'filter', 'runtime_insights', 'target_protocol', 'tools'],
  },
  {
    file: 'src/i18n/locales/ko/theme.json',
    requiredRoots: ['theme'],
    forbiddenRoots: ['main', 'garden', 'filter', 'runtime_insights', 'target_protocol', 'tools'],
  },
  {
    file: 'src/i18n/locales/en/sites.json',
    requiredRoots: ['target_protocol'],
    forbiddenRoots: ['main', 'filter', 'garden', 'runtime_insights'],
  },
  {
    file: 'src/i18n/locales/ko/sites.json',
    requiredRoots: ['target_protocol'],
    forbiddenRoots: ['main', 'filter', 'garden', 'runtime_insights'],
  },
  {
    file: 'src/i18n/locales/en/main.json',
    requiredRoots: ['target_protocol', 'main'],
    forbiddenRoots: ['filter', 'runtime_insights'],
  },
  {
    file: 'src/i18n/locales/ko/main.json',
    requiredRoots: ['target_protocol', 'main'],
    forbiddenRoots: ['filter', 'runtime_insights'],
  },
]);

const sourceContracts = Object.freeze([
  {
    id: 'dashboard-shell-metadata',
    roots: ['src/apps/dashboard/DashboardPage.jsx'],
    families: {
      main: 'dashboard',
      experiment: 'dashboard',
      sites: 'dashboard',
      settings: 'dashboard',
      theme: 'dashboard',
      tools: 'dashboard',
      filter: 'dashboard',
      schedule: 'dashboard',
    },
  },
  {
    id: 'dashboard-main-tab',
    keyOwners: { 'main.title': 'dashboard' },
    roots: ['src/apps/dashboard/tabs/main'],
    families: {
      main: 'main',
      runtime_insights: 'filter',
    },
  },
  {
    id: 'dashboard-filter-tab',
    roots: ['src/apps/dashboard/tabs/filter'],
    families: {
      filter: 'filter',
      runtime_insights: 'filter',
    },
  },
  {
    id: 'dashboard-sites-tab',
    roots: ['src/apps/dashboard/tabs/sites'],
    families: {
      target_protocol: 'sites',
      runtime_insights: 'filter',
    },
  },
  {
    id: 'theme-main-widgets',
    roots: ['src/themes/core/loaders/widgets.js'],
    include: /\/main\//,
    families: {
      target_protocol: 'main',
    },
  },
  {
    id: 'theme-sites-widgets',
    roots: ['src/themes/core/loaders/widgets.js'],
    include: /\/sites\//,
    families: {
      target_protocol: 'sites',
    },
  },
  {
    id: 'dashboard-settings-tab',
    roots: ['src/apps/dashboard/tabs/settings'],
    families: {
      clse: 'settings',
      common: 'settings',
      confirm: 'settings',
      data: 'settings',
      dialogs: 'settings',
      display: 'settings',
      header: 'settings',
      language: 'settings',
      permissions: 'settings',
      preview: 'settings',
      sections: 'settings',
      security: 'settings',
      settings_overview: 'settings',
      settings_permissions: 'settings',
      settings_safety: 'settings',
      settings_workspace: 'settings',
      settings_workspace_panel: 'settings',
      solar_location: 'settings',
      status: 'settings',
    },
  },
  {
    id: 'dashboard-tools-tab',
    roots: ['src/apps/dashboard/tabs/tools'],
    families: {
      tools: 'tools',
      artifacts: 'tools',
      experiment: 'tools',
      furin_tuner: 'tools',
      header: 'tools',
      history_modal: 'tools',
      koi_tuner: 'tools',
      matrix: 'tools',
      sentinel_flare_protocol: 'tools',
      shishi_tuner: 'tools',
      shortform_blocker: 'tools',
      status: 'tools',
      support: 'tools',
      units: 'tools',
      worker_runtime: 'tools',
    },
  },
  {
    id: 'dashboard-experiment-tab',
    roots: ['src/apps/dashboard/tabs/experiment'],
    families: {
      experiment: 'tools',
      worker_runtime: 'tools',
      tools: 'tools',
    },
  },
  {
    id: 'common-ui-shells',
    roots: ['src/apps/dashboard/layout', 'src/apps/popup'],
    families: {
      action: 'common',
      app: 'common',
      boot: 'common',
      clse_alert: 'common',
      controls: 'common',
      dashboard: 'common',
      error_boundary: 'common',
      gatekeeper: 'common',
      indicator: 'common',
      navigation: 'common',
      popup: 'common',
      social: 'common',
      status: 'common',
      toast: 'common',
    },
  },
]);

function absolute(relativePath) {
  return path.resolve(rootDir, relativePath);
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

async function walkFiles(relativePath) {
  const abs = absolute(relativePath);
  const stats = await fs.stat(abs);

  if (stats.isFile()) {
    return supportedFileRe.test(relativePath) ? [toPosix(relativePath)] : [];
  }

  const entries = await fs.readdir(abs, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const nestedPath = path.join(relativePath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(nestedPath)));
      continue;
    }
    if (entry.isFile() && supportedFileRe.test(entry.name)) {
      files.push(toPosix(nestedPath));
    }
  }
  return files;
}

function extractTranslationAliases(source) {
  const aliases = new Map();
  const hookPattern = /\{([\s\S]*?)\}\s*=\s*use(?:App|Theme)?Translation\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match = hookPattern.exec(source);

  while (match) {
    const objectBody = match[1];
    const namespace = match[2];
    const aliasMatch = objectBody.match(/\bt\s*(?::\s*([A-Za-z_$][\w$]*))?\b/);
    if (aliasMatch) {
      aliases.set(aliasMatch[1] || 't', namespace);
    }
    match = hookPattern.exec(source);
  }

  return aliases;
}

function getLineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function resolveNamespaceAndKey(rawKey, defaultNamespace) {
  const explicitMatch = rawKey.match(/^([A-Za-z0-9_]+):(.*)$/s);
  if (explicitMatch) {
    return {
      namespace: explicitMatch[1],
      key: explicitMatch[2],
    };
  }

  return {
    namespace: defaultNamespace,
    key: rawKey,
  };
}

function collectOwnershipReferences(source, aliases) {
  const references = [];
  const callPattern = /\b([A-Za-z_$][\w$]*)\s*\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/g;
  let match = callPattern.exec(source);

  while (match) {
    const alias = match[1];
    const defaultNamespace = aliases.get(alias);
    if (!defaultNamespace) {
      match = callPattern.exec(source);
      continue;
    }

    const rawKey = match[2] ?? match[3] ?? match[4] ?? '';
    references.push({
      line: getLineNumber(source, match.index),
      ...resolveNamespaceAndKey(rawKey, defaultNamespace),
    });
    match = callPattern.exec(source);
  }

  const resolveTextPattern = /\bresolveText\s*\(\s*([A-Za-z_$][\w$]*)\s*,\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/g;
  match = resolveTextPattern.exec(source);
  while (match) {
    const alias = match[1];
    const defaultNamespace = aliases.get(alias);
    if (!defaultNamespace) {
      match = resolveTextPattern.exec(source);
      continue;
    }

    const rawKey = match[2] ?? match[3] ?? match[4] ?? '';
    references.push({
      line: getLineNumber(source, match.index),
      ...resolveNamespaceAndKey(rawKey, defaultNamespace),
    });
    match = resolveTextPattern.exec(source);
  }

  return references;
}

async function checkLocaleContracts() {
  for (const contract of localeContracts) {
    const json = JSON.parse(await fs.readFile(absolute(contract.file), 'utf8'));
    contract.requiredRoots.forEach((key) => {
      if (!(key in json)) {
        failures.push(`${contract.file} is missing required top-level namespace root "${key}".`);
      }
    });
    contract.forbiddenRoots.forEach((key) => {
      if (key in json) {
        failures.push(`${contract.file} must not define top-level namespace root "${key}".`);
      }
    });
  }
}

async function checkSourceContracts() {
  for (const contract of sourceContracts) {
    const files = [];
    for (const root of contract.roots) {
      try {
        files.push(...(await walkFiles(root)));
      } catch {
        // Ignore absent roots in current branch.
      }
    }

    const uniqueFiles = [...new Set(files)]
      .filter((relativePath) => (contract.include ? contract.include.test(relativePath) : true));

    for (const relativePath of uniqueFiles) {
      const source = await fs.readFile(absolute(relativePath), 'utf8');
      const aliases = extractTranslationAliases(source);
      const references = collectOwnershipReferences(source, aliases);

      references.forEach((reference) => {
        const family = String(reference.key || '').split('.').filter(Boolean)[0];
        if (!family || !(family in contract.families)) {
          return;
        }

        const expectedNamespace = contract.keyOwners?.[reference.key] ?? contract.families[family];
        if (reference.namespace !== expectedNamespace) {
          failures.push(
            `${relativePath}:${reference.line} must resolve ${family}.* through ${expectedNamespace}, not ${reference.namespace}.`
          );
        }
      });
    }
  }
}

async function main() {
  await checkLocaleContracts();
  await checkSourceContracts();

  if (failures.length > 0) {
    console.error('[i18n-namespace-ownership] Contract violation detected:');
    failures.forEach((failure) => {
      console.error(`- ${failure}`);
    });
    process.exit(1);
    return;
  }

  console.log('[i18n-namespace-ownership] PASS: dashboard/sites/main/theme/tools ownership boundaries are stable.');
}

main().catch((error) => {
  console.error('[i18n-namespace-ownership] Unexpected error:', error);
  process.exit(1);
});
