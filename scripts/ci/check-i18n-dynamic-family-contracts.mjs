import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { I18N_FALLBACK_LANGUAGE, I18N_SUPPORTED_LOCALES } from '../../src/i18n/metadata.js';
import {
  collectDashboardTabMetadata,
  DASHBOARD_TAB_METADATA_SOURCE_PATHS,
  findDashboardTabMetadataViolations,
} from './dashboardTabMetadataContract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASE_LANGUAGE = I18N_FALLBACK_LANGUAGE;
const SUPPORTED_I18N_LANGUAGES = I18N_SUPPORTED_LOCALES;
const violations = [];

function readLocaleNamespace(language, namespace) {
  const filePath = path.join(ROOT, 'src/i18n/locales', language, `${namespace}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getValue(root, dottedPath) {
  if (!dottedPath) return root;
  return dottedPath.split('.').reduce((current, segment) => current?.[segment], root);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function compareTree(baseValue, candidateValue, label) {
  if (typeof baseValue === 'string') {
    if (typeof candidateValue !== 'string') {
      violations.push(`${label}: expected string leaf`);
      return;
    }
    if (!baseValue.trim()) violations.push(`${label}: base locale string is empty`);
    if (!candidateValue.trim()) violations.push(`${label}: localized string is empty`);
    return;
  }

  if (!isPlainObject(baseValue) || !isPlainObject(candidateValue)) {
    violations.push(`${label}: expected matching object shapes`);
    return;
  }

  const baseKeys = Object.keys(baseValue).sort();
  const candidateKeys = Object.keys(candidateValue).sort();
  if (baseKeys.join('|') !== candidateKeys.join('|')) {
    violations.push(
      `${label}: key shape mismatch (${baseKeys.join(', ') || '<empty>'} vs ${candidateKeys.join(', ') || '<empty>'})`,
    );
    return;
  }

  if (baseKeys.length === 0) {
    violations.push(`${label}: dynamic family is empty`);
    return;
  }

  for (const key of baseKeys) {
    compareTree(baseValue[key], candidateValue[key], `${label}.${key}`);
  }
}

function flattenLeafPaths(value, prefix = '', output = new Map()) {
  if (typeof value === 'string') {
    output.set(prefix, value);
    return output;
  }
  if (!isPlainObject(value)) return output;
  for (const [key, child] of Object.entries(value)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    flattenLeafPaths(child, nextPrefix, output);
  }
  return output;
}

function assertRecursiveFamily(namespace, dottedPath) {
  const baseNamespace = readLocaleNamespace(BASE_LANGUAGE, namespace);
  const baseValue = getValue(baseNamespace, dottedPath);
  const label = `${namespace}:${dottedPath || '<root>'}`;

  if (!isPlainObject(baseValue)) {
    violations.push(`${label}: base locale family is missing or not an object`);
    return;
  }

  if (Object.keys(baseValue).length === 0) {
    violations.push(`${label}: base locale family is empty`);
    return;
  }

  for (const language of SUPPORTED_I18N_LANGUAGES) {
    const candidateNamespace = readLocaleNamespace(language, namespace);
    const candidateValue = getValue(candidateNamespace, dottedPath);
    compareTree(baseValue, candidateValue, `${language}:${label}`);
  }
}

function assertFlatPrefixFamily(namespace, prefix) {
  const baseMap = flattenLeafPaths(readLocaleNamespace(BASE_LANGUAGE, namespace));
  const baseEntries = [...baseMap.entries()].filter(([key]) => key.startsWith(prefix));

  if (baseEntries.length === 0) {
    violations.push(`${namespace}:${prefix}: base locale family is empty`);
    return;
  }

  const baseSuffixes = baseEntries.map(([key]) => key.slice(prefix.length)).sort();
  for (const [key, value] of baseEntries) {
    if (!value.trim()) {
      violations.push(`${BASE_LANGUAGE}:${namespace}:${key}: base locale string is empty`);
    }
  }

  for (const language of SUPPORTED_I18N_LANGUAGES) {
    const candidateMap = flattenLeafPaths(readLocaleNamespace(language, namespace));
    const candidateEntries = [...candidateMap.entries()].filter(([key]) => key.startsWith(prefix));
    const candidateSuffixes = candidateEntries.map(([key]) => key.slice(prefix.length)).sort();

    if (baseSuffixes.join('|') !== candidateSuffixes.join('|')) {
      violations.push(
        `${language}:${namespace}:${prefix}: suffix mismatch (${baseSuffixes.join(', ')} vs ${candidateSuffixes.join(', ')})`,
      );
      continue;
    }

    for (const [key, value] of candidateEntries) {
      if (!value.trim()) {
        violations.push(`${language}:${namespace}:${key}: localized string is empty`);
      }
    }
  }
}

function assertDashboardTabMeta() {
  const baseValue = readLocaleNamespace(BASE_LANGUAGE, 'dashboard');
  const metadata = collectDashboardTabMetadata(DASHBOARD_TAB_METADATA_SOURCE_PATHS.map(filePath => ({
    filePath,
    source: fs.readFileSync(path.join(ROOT, filePath), 'utf8'),
  })));

  if (!isPlainObject(baseValue) || Object.keys(baseValue).length === 0) {
    violations.push('dashboard:<root>: dashboard tab metadata family is empty');
    return;
  }

  for (const language of SUPPORTED_I18N_LANGUAGES) {
    const candidateValue = readLocaleNamespace(language, 'dashboard');
    compareTree(baseValue, candidateValue, `${language}:dashboard:<root>`);

    violations.push(...findDashboardTabMetadataViolations(candidateValue, metadata, language));
  }
}

function assertArtifactCardFamily() {
  const baseArtifacts = getValue(readLocaleNamespace(BASE_LANGUAGE, 'tools'), 'artifacts');
  if (!isPlainObject(baseArtifacts)) {
    violations.push('tools:artifacts: missing base artifact copy family');
    return;
  }

  const artifactIds = Object.keys(baseArtifacts).filter(
    (key) => key !== 'runtime' && isPlainObject(baseArtifacts[key]),
  );
  if (artifactIds.length === 0) {
    violations.push('tools:artifacts: no artifact card entries found');
    return;
  }

  for (const language of SUPPORTED_I18N_LANGUAGES) {
    const artifacts = getValue(readLocaleNamespace(language, 'tools'), 'artifacts');
    if (!isPlainObject(artifacts)) {
      violations.push(`${language}:tools.artifacts: missing artifact copy family`);
      continue;
    }

    const candidateIds = Object.keys(artifacts).filter(
      (key) => key !== 'runtime' && isPlainObject(artifacts[key]),
    ).sort();
    if (artifactIds.slice().sort().join('|') !== candidateIds.join('|')) {
      violations.push(
        `${language}:tools.artifacts: artifact id mismatch (${artifactIds.join(', ')} vs ${candidateIds.join(', ')})`,
      );
      continue;
    }

    for (const artifactId of artifactIds) {
      const copy = artifacts[artifactId];
      for (const key of ['title', 'subtitle', 'desc']) {
        if (!isPlainObject(copy) || typeof copy[key] !== 'string' || !copy[key].trim()) {
        violations.push(`${language}:tools.artifacts.${artifactId}.${key}: missing artifact card leaf`);
      }
    }
  }
}
}

function assertExperimentLabSections() {
  const pathName = 'experiment.lab_sections';
  const baseValue = getValue(readLocaleNamespace(BASE_LANGUAGE, 'tools'), pathName);

  if (!isPlainObject(baseValue) || Object.keys(baseValue).length === 0) {
    violations.push(`tools:${pathName}: base lab sections family is empty`);
    return;
  }

  for (const language of SUPPORTED_I18N_LANGUAGES) {
    const candidateValue = getValue(readLocaleNamespace(language, 'tools'), pathName);
    compareTree(baseValue, candidateValue, `${language}:tools:${pathName}`);
    if (!isPlainObject(candidateValue)) continue;

    for (const [sectionId, copy] of Object.entries(candidateValue)) {
      for (const key of ['label', 'title', 'desc']) {
        if (!isPlainObject(copy) || typeof copy[key] !== 'string' || !copy[key].trim()) {
          violations.push(`${language}:tools.${pathName}.${sectionId}.${key}: missing lab section leaf`);
        }
      }
    }
  }
}

assertDashboardTabMeta();
assertRecursiveFamily('tools', 'experiment.artifacts');
assertExperimentLabSections();
assertArtifactCardFamily();

for (const [namespace, pathName] of [
  ['sites', 'errors'],
  ['filter', 'runtime_insights'],
  ['tools', 'worker_runtime'],
  ['tools', 'artifacts.runtime.states'],
  ['tools', 'artifacts.sentinel_flare.control_status'],
  ['tools', 'shortform_blocker'],
  ['tools', 'koi_tuner.model_options'],
  ['tools', 'koi_tuner.palette_options'],
  ['tools', 'koi_tuner.sections'],
  ['tools', 'koi_tuner.params'],
  ['tools', 'koi_tuner.env_channels'],
  ['tools', 'furin_tuner.tabs'],
  ['tools', 'furin_tuner.sub_tabs'],
  ['tools', 'furin_tuner.wind_debug.modes'],
  ['tools', 'furin_tuner.params'],
  ['tools', 'shishi_tuner.tabs'],
  ['tools', 'shishi_tuner.params'],
  ['settings', 'permissions.types'],
  ['settings', 'preview.instagram'],
  ['settings', 'preview.signal_test_pattern'],
  ['settings', 'preview.tiktok'],
  ['settings', 'preview.x'],
  ['settings', 'preview.youtube'],
  ['schedule', 'days'],
  ['common', 'popup.artifacts'],
  ['common', 'friction_profiles'],
  ['main', 'cyberpunk.signal_scanner.status'],
  ['main', 'matrix.signal_scanner.status'],
]) {
  assertRecursiveFamily(namespace, pathName);
}

for (const [namespace, prefix] of [
  ['guidance', 'families.'],
  ['guidance', 'family_descriptions.'],
  ['guidance', 'installation.phase.'],
  ['main', 'main.home_site_state_'],
  ['main', 'main.bonsai_ambient_'],
  ['filter', 'runtime_insights.card_'],
  ['tools', 'koi_tuner.badges.'],
  ['tools', 'koi_tuner.groups.'],
  ['sites', 'preset_studio.posture_'],
  ['sites', 'preset_studio.artifact_'],
  ['tools', 'sentinel_flare_protocol.telemetry_runtime_'],
  ['tools', 'sentinel_flare_protocol.telemetry_quality_'],
]) {
  assertFlatPrefixFamily(namespace, prefix);
}

if (violations.length > 0) {
  console.error('[check-i18n-dynamic-family-contracts] Contract violation detected:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('[check-i18n-dynamic-family-contracts] PASS: validated runtime-driven dynamic i18n families.');
