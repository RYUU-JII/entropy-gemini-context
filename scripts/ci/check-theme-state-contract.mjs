#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getCanonicalThemeIds } from '../../src/themes/core/ids.js';
import {
  THEME_STATE_EVOLUTION,
  THEME_STATE_REGISTRY,
} from '../../src/themes/core/state/themeStateRegistry.js';
import { ZEN_WORKSPACE_STORAGE_KEYS } from '../../src/themes/plugins/zen/state/ZenWorkspaceState.js';
import { ZEN_THEME_MODEL_STATE_KEYS } from '../../src/themes/plugins/zen/state/ZenThemeModelState.js';
import {
  getABStyleProfileStorageKey,
  getABQueryTuningStorageKey,
  getRedundancyTuningStorageKey,
  getCanopyDistributionTuningStorageKey,
  getOptimizationObjectiveModeStorageKey,
} from '../../src/themes/plugins/zen/model/ZenCoreConfig.js';
import { ZEN_SITE_KOI_COLOR_STRATEGY_STORAGE_KEY } from '../../src/themes/plugins/zen/pond/storage/repositories/zenTuningRepository.js';
import { ZEN_POND_TUNING_STORAGE_KEY } from '../../src/themes/plugins/zen/pond/storage/zenPondStorage/tuningStore.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const fail = (message) => {
  console.error(`[theme-state-contract] FAIL: ${message}`);
  process.exit(1);
};

function buildExpectedThemeStorageKeys() {
  return new Set([
    'app-theme',
    'zen_artifacts',
    ...Object.values(ZEN_WORKSPACE_STORAGE_KEYS),
    ...Object.values(ZEN_THEME_MODEL_STATE_KEYS),
    getABStyleProfileStorageKey('sakura'),
    getABQueryTuningStorageKey('sakura'),
    getRedundancyTuningStorageKey('sakura'),
    getCanopyDistributionTuningStorageKey('sakura'),
    getOptimizationObjectiveModeStorageKey('sakura'),
    ZEN_SITE_KOI_COLOR_STRATEGY_STORAGE_KEY,
    ZEN_POND_TUNING_STORAGE_KEY,
  ]);
}

async function assertEntrypointExists(relativePath) {
  try {
    await fs.access(path.resolve(rootDir, relativePath));
  } catch (_error) {
    fail(`canonicalEntrypoint does not exist: ${relativePath}`);
  }
}

async function main() {
  const validThemeIds = new Set(['*', ...getCanonicalThemeIds()]);
  const validEvolutionModes = new Set([
    THEME_STATE_EVOLUTION.EXACT,
    THEME_STATE_EVOLUTION.RESET,
    THEME_STATE_EVOLUTION.REBUILD,
  ]);
  const seenEntryIds = new Set();
  const seenKeys = new Map();

  if (Object.prototype.hasOwnProperty.call(THEME_STATE_EVOLUTION, 'MIGRATE')) {
    fail('THEME_STATE_EVOLUTION must not retain a speculative pre-release migration mode.');
  }

  if (!Array.isArray(THEME_STATE_REGISTRY) || THEME_STATE_REGISTRY.length < 10) {
    fail('THEME_STATE_REGISTRY must declare the active theme persistence surfaces.');
  }

  for (const entry of THEME_STATE_REGISTRY) {
    if (!entry || typeof entry !== 'object') {
      fail('THEME_STATE_REGISTRY entries must be plain objects.');
    }

    if (typeof entry.id !== 'string' || !entry.id.trim()) {
      fail('Every theme state entry must provide a non-empty id.');
    }
    if (seenEntryIds.has(entry.id)) {
      fail(`Duplicate theme state id detected: ${entry.id}`);
    }
    seenEntryIds.add(entry.id);

    if (!validThemeIds.has(entry.themeId)) {
      fail(`Non-canonical themeId detected in THEME_STATE_REGISTRY: ${entry.themeId}`);
    }

    if (typeof entry.owner !== 'string' || !entry.owner.trim()) {
      fail(`${entry.id}: owner is required.`);
    }

    if (typeof entry.canonicalEntrypoint !== 'string' || !entry.canonicalEntrypoint.trim()) {
      fail(`${entry.id}: canonicalEntrypoint is required.`);
    }
    await assertEntrypointExists(entry.canonicalEntrypoint);

    if (!validEvolutionModes.has(entry.evolutionMode)) {
      fail(`${entry.id}: evolutionMode must be exact, reset, or rebuild for the release V1 baseline.`);
    }

    if (!Array.isArray(entry.keys) || entry.keys.length === 0) {
      fail(`${entry.id}: keys must be a non-empty array.`);
    }

    for (const key of entry.keys) {
      if (typeof key !== 'string' || !key.trim()) {
        fail(`${entry.id}: keys must contain only non-empty strings.`);
      }
      const existingOwner = seenKeys.get(key);
      if (existingOwner && existingOwner !== entry.id) {
        fail(`Theme state key "${key}" is claimed by both ${existingOwner} and ${entry.id}.`);
      }
      seenKeys.set(key, entry.id);
    }

    if (entry.backend === 'window.localStorage' && entry.crossContextVisibility !== 'page-local') {
      fail(`${entry.id}: localStorage-backed theme state must remain page-local.`);
    }

    if (entry.backend === 'ModelStateStore' && entry.crossContextVisibility !== 'cross-context') {
      fail(`${entry.id}: ModelStateStore-backed theme state must be cross-context.`);
    }
  }

  const expectedKeys = buildExpectedThemeStorageKeys();
  for (const key of expectedKeys) {
    if (!seenKeys.has(key)) {
      fail(`Theme state registry is missing expected storage key coverage for "${key}".`);
    }
  }

  const forbiddenPreReleaseKeys = new Set([
    'zen_pond_tuning_v2',
    'zen_sakura_v2_runtime_flags',
    'zen_sakura_v2_sobol_pool_cache_v2',
    'neural_zen_brain_v5',
  ]);
  for (const key of forbiddenPreReleaseKeys) {
    if (seenKeys.has(key)) {
      fail(`Theme state registry must not retain pre-release key "${key}".`);
    }
  }

  const retiredBonsaiSplitStateKeys = new Set([
    'zen_bonsai_type',
    'zen_bonsai_seed_sakura',
    'zen_bonsai_structure_mode_sakura',
    'zen_bonsai_structure_depth_sakura',
    'zen_bonsai_identity_revision',
    'zen_sakura_v2_latent_state',
    'zen_bonsai_classic2_lineage_state_v1',
  ]);
  for (const key of retiredBonsaiSplitStateKeys) {
    if (seenKeys.has(key)) {
      fail(`Theme state registry must not retain retired split bonsai state key "${key}".`);
    }
  }

  const bonsaiProfileEntries = THEME_STATE_REGISTRY.filter((entry) => (
    entry.keys.includes('zen_bonsai_profile_aggregate_v1')
  ));
  if (
    bonsaiProfileEntries.length !== 1
    || bonsaiProfileEntries[0].id !== 'zen.model.bonsai_profile_aggregate'
    || bonsaiProfileEntries[0].owner !== 'ZenBonsaiProfileAggregateRepository'
    || bonsaiProfileEntries[0].backend !== 'ModelStateStore'
    || bonsaiProfileEntries[0].evolutionMode !== THEME_STATE_EVOLUTION.EXACT
  ) {
    fail('Zen bonsai profile state must have exactly one exact ModelStateStore aggregate owner.');
  }

  console.log('[theme-state-contract] PASS: themeStateRegistry covers the canonical theme persistence surfaces.');
}

main().catch((error) => {
  console.error('[theme-state-contract] Unexpected error:', error);
  process.exit(1);
});
