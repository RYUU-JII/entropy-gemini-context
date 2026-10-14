#!/usr/bin/env node

import process from 'node:process';

import { getThemePluginList } from '../../src/themes/core/runtime/pluginCatalog.js';

const violations = [];

for (const manifest of getThemePluginList()) {
  const activeVariant = typeof manifest?.profile?.bootLoaderVariant === 'string' && manifest.profile.bootLoaderVariant.trim()
    ? manifest.profile.bootLoaderVariant.trim()
    : 'soft';
  const bootLoaders = manifest?.bootLoaders;
  const bootShells = manifest?.bootShells;

  if (!bootLoaders || typeof bootLoaders !== 'object') {
    violations.push(`${manifest?.id || 'unknown'}: bootLoaders capability is missing.`);
    continue;
  }

  if (Object.prototype.hasOwnProperty.call(bootLoaders, 'fallbacks')) {
    violations.push(`${manifest.id}: bootLoaders.fallbacks is forbidden.`);
  }

  if (bootShells && typeof bootShells === 'object' && Object.prototype.hasOwnProperty.call(bootShells, 'fallbacks')) {
    violations.push(`${manifest.id}: bootShells.fallbacks is forbidden.`);
  }

  if (typeof bootLoaders[activeVariant] !== 'string' || !bootLoaders[activeVariant].trim()) {
    violations.push(`${manifest.id}: active boot loader variant "${activeVariant}" must resolve to an explicit plugin-owned module path.`);
  }

  if (bootShells && typeof bootShells === 'object' && Object.prototype.hasOwnProperty.call(bootShells, activeVariant)) {
    const bootShellPath = bootShells[activeVariant];
    if (typeof bootShellPath !== 'string' || !bootShellPath.trim()) {
      violations.push(`${manifest.id}: declared boot shell variant "${activeVariant}" must resolve to an explicit plugin-owned module path.`);
    }
  }
}

if (violations.length > 0) {
  console.error('[theme-boot-loader-contract] Contract violation detected:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('[theme-boot-loader-contract] PASS: theme manifests declare explicit active boot loader variants and visible boot shell declarations without cross-theme fallback.');
