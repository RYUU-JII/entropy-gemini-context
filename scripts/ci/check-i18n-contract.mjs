import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  I18N_NAMESPACES,
  I18N_SUPPORTED_LOCALES,
} from '../../src/i18n/metadata.js';
import { PROTECTION_CANONICAL_ARTIFACT_ID_LIST } from '../../src/domains/protection/catalog/artifactFamilyCatalog.js';
import { INSTALLATION_PRESENTATION_SHOTS } from '../../src/themes/core/presentation/installationPresentationContract.js';

const rootDir = process.cwd();
const localesDir = path.resolve(rootDir, 'src/i18n/locales');
const sourceDir = path.resolve(rootDir, 'src');
const supportedLocales = I18N_SUPPORTED_LOCALES;
const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const explicitTranslationWrappers = new Set(['tRuntime', 'translate']);
const failures = [];

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getLineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function flattenLocaleKeys(value, prefix = '', keys = new Set()) {
  if (typeof value === 'string') {
    keys.add(prefix);
    return keys;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return keys;
  }

  Object.entries(value).forEach(([childKey, childValue]) => {
    const nextPrefix = prefix ? `${prefix}.${childKey}` : childKey;
    flattenLocaleKeys(childValue, nextPrefix, keys);
  });

  return keys;
}

async function walkSourceFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (absolutePath.startsWith(localesDir)) return [];
      return walkSourceFiles(absolutePath);
    }
    if (!entry.isFile()) return [];
    if (!sourceExtensions.has(path.extname(entry.name))) return [];
    return [absolutePath];
  }));
  return nested.flat();
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

function splitKeyReference(rawKey, defaultNamespace, knownNamespaces) {
  const namespacedMatch = rawKey.match(/^([A-Za-z0-9_]+):(.*)$/s);
  if (namespacedMatch && knownNamespaces.has(namespacedMatch[1])) {
    return {
      namespace: namespacedMatch[1],
      key: namespacedMatch[2],
    };
  }

  return {
    namespace: defaultNamespace,
    key: rawKey,
  };
}

function filterKeys(localeKeys, matcher) {
  return [...localeKeys].filter((key) => matcher.test(key)).sort();
}

const dynamicContracts = [
  {
    name: 'tools Furin configured time status and continuation',
    pattern: /^artifacts\.sentinel_flare\.control_status\.\$\{(?:reason|action)\}$/,
    expand() {
      return ['off', 'paused', 'no_sites', 'unconfigured', 'mode_off', 'consent_required',
        'excluded', 'global_only', 'site_only', 'global_and_site',
        'open_sites', 'open_recording', 'open_exclusions']
        .map(key => `artifacts.sentinel_flare.control_status.${key}`);
    },
  },
  {
    name: 'guidance canonical artifact names and descriptions',
    pattern: /^(families|family_descriptions)\.\$\{[^}]+\}$/,
    expand(_localeKeys, match) {
      return PROTECTION_CANONICAL_ARTIFACT_ID_LIST.map((familyId) => `${match[1]}.${familyId}`);
    },
  },
  {
    name: 'guidance installation presentation shots',
    pattern: /^installation\.phase\.\$\{[^}]+\}$/,
    expand() {
      return INSTALLATION_PRESENTATION_SHOTS.map((shot) => `installation.phase.${shot.id}`);
    },
  },
  {
    name: 'common named friction profiles',
    pattern: /^friction_profiles\.\$\{[^}]+\}$/,
    expand() {
      return ['friction_profiles.relaxed', 'friction_profiles.normal', 'friction_profiles.reinforced'];
    },
  },
  {
    name: 'tabs.top-level metadata',
    pattern: /^\$\{[^}]+\}\.(nav|title|desc)$/,
    expand(localeKeys, match) {
      return filterKeys(localeKeys, new RegExp(`^[^.]+\\.${escapeRegex(match[1])}$`));
    },
  },
  {
    name: 'tabs.filter scenario descriptions',
    pattern: /^filter\.\$\{[^}]+\}_desc$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^filter\..*_desc$/);
    },
  },
  {
    name: 'tabs.main site state variants',
    pattern: /^main\.home_site_state_\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^main\.home_site_state_.+$/);
    },
  },
  {
    name: 'tabs.main bonsai ambient variants',
    pattern: /^main\.bonsai_ambient_\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^main\.bonsai_ambient_.+$/);
    },
  },
  {
    name: 'tabs.runtime insight card variants',
    pattern: /^runtime_insights\.card_\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^runtime_insights\.card_.+$/);
    },
  },
  {
    name: 'tabs.runtime insight armed title variants',
    pattern: /^runtime_insights\.intervention_armed_title_\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^runtime_insights\.intervention_armed_title_.+$/);
    },
  },
  {
    name: 'tabs.runtime insight armed body variants',
    pattern: /^runtime_insights\.intervention_armed_body_\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^runtime_insights\.intervention_armed_body_.+$/);
    },
  },
  {
    name: 'tools.experiment lab section fields',
    pattern: /^experiment\.lab_sections\.\$\{[^}]+\}\.(label|title|desc)$/,
    expand(localeKeys, match) {
      return filterKeys(localeKeys, new RegExp(`^experiment\\.lab_sections\\.[^.]+\\.${escapeRegex(match[1])}$`));
    },
  },
  {
    name: 'tools.pond lab control and runtime families',
    pattern: /^experiment\.pond_lab\.(effect_groups|effect_controls|runtime)\.\$\{[^}]+\}$/,
    expand(localeKeys, match) {
      return filterKeys(localeKeys, new RegExp(`^experiment\\.pond_lab\\.${escapeRegex(match[1])}\\.[^.]+$`));
    },
  },
  {
    name: 'tools.pond lab visual profile axes',
    pattern: /^experiment\.pond_lab\.visual_profile\.axes\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^experiment\.pond_lab\.visual_profile\.axes\.[^.]+$/);
    },
  },
  {
    name: 'tools.pond lab visual profile options',
    pattern: /^experiment\.pond_lab\.visual_profile\.options\.\$\{[^}]+\}\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^experiment\.pond_lab\.visual_profile\.options\.[^.]+\.[^.]+$/);
    },
  },
  {
    name: 'tools.experiment artifacts',
    pattern: /^experiment\.artifacts\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^experiment\.artifacts\.[^.]+$/);
    },
  },
  {
    name: 'tools.koi tuner model options',
    pattern: /^koi_tuner\.model_options\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^koi_tuner\.model_options\.[^.]+$/);
    },
  },
  {
    name: 'tools.koi tuner palette options',
    pattern: /^koi_tuner\.palette_options\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^koi_tuner\.palette_options\.[^.]+$/);
    },
  },
  {
    name: 'tools.koi tuner reflection algorithm options',
    pattern: /^koi_tuner\.reflection_algorithm_options\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^koi_tuner\.reflection_algorithm_options\.[^.]+$/);
    },
  },
  {
    name: 'tools.koi tuner badges',
    pattern: /^koi_tuner\.badges\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^koi_tuner\.badges\.[^.]+$/);
    },
  },
  {
    name: 'tools.koi tuner targets',
    pattern: /^koi_tuner\.targets\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^koi_tuner\.targets\.[^.]+$/);
    },
  },
  {
    name: 'tools.koi tuner modes',
    pattern: /^koi_tuner\.modes\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^koi_tuner\.modes\.[^.]+$/);
    },
  },
  {
    name: 'tools.koi tuner groups',
    pattern: /^koi_tuner\.groups\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^koi_tuner\.groups\.[^.]+$/);
    },
  },
  {
    name: 'tools.koi tuner sections',
    pattern: /^koi_tuner\.sections\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^koi_tuner\.sections\.[^.]+$/);
    },
  },
  {
    name: 'tools.koi tuner params',
    pattern: /^koi_tuner\.params\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^koi_tuner\.params\.[^.]+$/);
    },
  },
  {
    name: 'tools.koi tuner env channel groups',
    pattern: /^koi_tuner\.env_channels\.group\.\$\{[^}]+\}\.(label|hint)$/,
    expand(localeKeys, match) {
      return filterKeys(localeKeys, new RegExp(`^koi_tuner\\.env_channels\\.group\\.[^.]+\\.${escapeRegex(match[1])}$`));
    },
  },
  {
    name: 'tools.koi tuner env channels',
    pattern: /^koi_tuner\.env_channels\.\$\{[^}]+\}\.label$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^koi_tuner\.env_channels\.[^.]+\.label$/);
    },
  },
  {
    name: 'tools.furin tuner tabs',
    pattern: /^furin_tuner\.tabs\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^furin_tuner\.tabs\.[^.]+$/);
    },
  },
  {
    name: 'tools.furin tuner sub tabs',
    pattern: /^furin_tuner\.sub_tabs\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^furin_tuner\.sub_tabs\.[^.]+$/);
    },
  },
  {
    name: 'tools.furin tuner wind debug modes',
    pattern: /^furin_tuner\.wind_debug\.modes\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^furin_tuner\.wind_debug\.modes\.[^.]+$/);
    },
  },
  {
    name: 'tools.furin tuner params',
    pattern: /^furin_tuner\.params\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^furin_tuner\.params\.[^.]+$/);
    },
  },
  {
    name: 'tools.shishi tuner tabs',
    pattern: /^shishi_tuner\.tabs\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^shishi_tuner\.tabs\.[^.]+$/);
    },
  },
  {
    name: 'tools.shishi tuner params',
    pattern: /^shishi_tuner\.params\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^shishi_tuner\.params\.[^.]+$/);
    },
  },
  {
    name: 'tools.artifact runtime states',
    pattern: /^artifacts\.runtime\.states\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^artifacts\.runtime\.states\.[^.]+$/);
    },
  },
  {
    name: 'tools.artifact copy variants',
    pattern: /^artifacts\.\$\{[^}]+\}\.(title|subtitle|desc)$/,
    expand(localeKeys, match) {
      return filterKeys(localeKeys, new RegExp(`^artifacts\\.[^.]+\\.${escapeRegex(match[1])}$`));
    },
  },
  {
    name: 'tools.shortform blocker copy',
    pattern: /^shortform_blocker\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^shortform_blocker\.[^.]+$/);
    },
  },
  {
    name: 'tools.worker runtime fields',
    pattern: /^worker_runtime\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^worker_runtime\.[^.]+$/);
    },
  },
  {
    name: 'tools.sentinel flare runtime telemetry variants',
    pattern: /^sentinel_flare_protocol\.telemetry_runtime_\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^sentinel_flare_protocol\.telemetry_runtime_.+$/);
    },
  },
  {
    name: 'tools.sentinel flare quality telemetry variants',
    pattern: /^sentinel_flare_protocol\.telemetry_quality_\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^sentinel_flare_protocol\.telemetry_quality_.+$/);
    },
  },
  {
    name: 'schedule.days',
    pattern: /^days\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^days\.[^.]+$/);
    },
  },
  {
    name: 'sites.errors',
    pattern: /^errors\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^errors\.[^.]+$/);
    },
  },
  {
    name: 'sites.target panel variants',
    pattern: /^target_panel\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^target_panel\.[^.]+$/);
    },
  },
  {
    name: 'sites.preset posture variants',
    pattern: /^preset_studio\.posture_\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^preset_studio\.posture_.+$/);
    },
  },
  {
    name: 'sites.preset artifact variants',
    pattern: /^preset_studio\.artifact_\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^preset_studio\.artifact_.+$/);
    },
  },
  {
    name: 'settings.permission types',
    pattern: /^permissions\.types\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^permissions\.types\.[^.]+$/);
    },
  },
  {
    name: 'settings.preview signal test pattern fields',
    pattern: /^preview\.signal_test_pattern\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^preview\.signal_test_pattern\.[^.]+$/);
    },
  },
  {
    name: 'settings.preview instagram fields',
    pattern: /^preview\.instagram\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^preview\.instagram\..+$/);
    },
  },
  {
    name: 'settings.preview tiktok fields',
    pattern: /^preview\.tiktok\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^preview\.tiktok\..+$/);
    },
  },
  {
    name: 'settings.preview x fields',
    pattern: /^preview\.x\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^preview\.x\..+$/);
    },
  },
  {
    name: 'settings.preview youtube fields',
    pattern: /^preview\.youtube\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^preview\.youtube\..+$/);
    },
  },
  {
    name: 'common.popup artifacts',
    pattern: /^popup\.artifacts\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^popup\.artifacts\.[^.]+$/);
    },
  },
  {
    name: 'common.clse panels',
    pattern: /^clse\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^clse\.[^.]+$/);
    },
  },
  {
    name: 'main.matrix signal statuses',
    pattern: /^matrix\.signal_scanner\.status\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^matrix\.signal_scanner\.status\.[^.]+$/);
    },
  },
  {
    name: 'main.cyberpunk signal statuses',
    pattern: /^cyberpunk\.signal_scanner\.status\.\$\{[^}]+\}$/,
    expand(localeKeys) {
      return filterKeys(localeKeys, /^cyberpunk\.signal_scanner\.status\.[^.]+$/);
    },
  },
];

function resolveDynamicKeys(keyPattern, localeKeys) {
  for (const contract of dynamicContracts) {
    const match = keyPattern.match(contract.pattern);
    if (match) {
      return {
        contract: contract.name,
        keys: contract.expand(localeKeys, match),
      };
    }
  }

  return null;
}

const expectedLocaleFiles = I18N_NAMESPACES
  .map((namespace) => `${namespace}.json`)
  .sort();
const knownNamespaces = new Set(I18N_NAMESPACES);

for (const locale of supportedLocales) {
  const localePath = path.resolve(localesDir, locale);
  const filenames = (await readdir(localePath))
    .filter((entry) => entry.endsWith('.json'))
    .sort();
  const missingInLocale = expectedLocaleFiles.filter((filename) => !filenames.includes(filename));
  const unexpectedInLocale = filenames.filter((filename) => !expectedLocaleFiles.includes(filename));

  missingInLocale.forEach((filename) => {
    failures.push(`src/i18n/locales/${locale}/${filename} is missing but declared in src/i18n/metadata.js.`);
  });
  unexpectedInLocale.forEach((filename) => {
    failures.push(`src/i18n/locales/${locale}/${filename} is not declared in src/i18n/metadata.js.`);
  });
}
const localeKeys = new Map();

for (const locale of supportedLocales) {
  const keysByNamespace = new Map();
  for (const namespace of I18N_NAMESPACES) {
    const filePath = path.resolve(localesDir, locale, `${namespace}.json`);
    try {
      const fileJson = JSON.parse(await readFile(filePath, 'utf8'));
      keysByNamespace.set(namespace, flattenLocaleKeys(fileJson));
    } catch (error) {
      failures.push(`Failed to read ${toPosix(path.relative(rootDir, filePath))}: ${String(error?.message || error)}`);
      keysByNamespace.set(namespace, new Set());
    }
  }
  localeKeys.set(locale, keysByNamespace);
}

const sourceFiles = await walkSourceFiles(sourceDir);
const staticReferences = new Map();
const dynamicReferences = new Map();

for (const absolutePath of sourceFiles) {
  const relativePath = toPosix(path.relative(rootDir, absolutePath));
  const source = await readFile(absolutePath, 'utf8');
  const aliases = extractTranslationAliases(source);

  aliases.forEach((namespace) => {
    if (!knownNamespaces.has(namespace)) {
      failures.push(`${relativePath} uses unknown i18n namespace "${namespace}".`);
    }
  });

  const callPattern = /\b([A-Za-z_$][\w$]*)\s*\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/g;
  let match = callPattern.exec(source);
  while (match) {
    const identifier = match[1];
    const rawKey = match[2] ?? match[3] ?? match[4] ?? '';
    const defaultNamespace = aliases.get(identifier) || null;
    const isHookAlias = Boolean(defaultNamespace);
    const isExplicitWrapper = explicitTranslationWrappers.has(identifier);
    if (!isHookAlias && !isExplicitWrapper) {
      match = callPattern.exec(source);
      continue;
    }
    const explicitNamespaceMatch = rawKey.match(/^([A-Za-z0-9_]+):(.*)$/s);
    if (isExplicitWrapper && !explicitNamespaceMatch) {
      match = callPattern.exec(source);
      continue;
    }
    if (explicitNamespaceMatch && !knownNamespaces.has(explicitNamespaceMatch[1])) {
      const lineNumber = getLineNumber(source, match.index);
      failures.push(`${relativePath}:${lineNumber} references unknown explicit i18n namespace "${explicitNamespaceMatch[1]}".`);
      match = callPattern.exec(source);
      continue;
    }
    const namespacedPrefix = rawKey.match(/^([A-Za-z0-9_]+):/);
    const usesKnownNamespacePrefix = namespacedPrefix && knownNamespaces.has(namespacedPrefix[1]);

    if (!defaultNamespace && !usesKnownNamespacePrefix) {
      match = callPattern.exec(source);
      continue;
    }

    const resolved = splitKeyReference(rawKey, defaultNamespace, knownNamespaces);
    const lineNumber = getLineNumber(source, match.index);
    if (!resolved.namespace) {
      failures.push(`${relativePath}:${lineNumber} uses i18n key "${rawKey}" without a resolvable namespace.`);
      match = callPattern.exec(source);
      continue;
    }

    if (!knownNamespaces.has(resolved.namespace)) {
      failures.push(`${relativePath}:${lineNumber} references unknown i18n namespace "${resolved.namespace}".`);
      match = callPattern.exec(source);
      continue;
    }

    const bucketKey = `${resolved.namespace}::${resolved.key}`;
    const bucket = resolved.key.includes('${')
      ? dynamicReferences
      : staticReferences;

    if (!bucket.has(bucketKey)) {
      bucket.set(bucketKey, {
        namespace: resolved.namespace,
        key: resolved.key,
        refs: [],
      });
    }
    bucket.get(bucketKey).refs.push(`${relativePath}:${lineNumber}`);
    match = callPattern.exec(source);
  }

  const memberCallPattern = /\bi18n\.t\s*\(\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/g;
  match = memberCallPattern.exec(source);
  while (match) {
    const rawKey = match[1] ?? match[2] ?? match[3] ?? '';
    const explicitNamespaceMatch = rawKey.match(/^([A-Za-z0-9_]+):(.*)$/s);
    if (!explicitNamespaceMatch) {
      match = memberCallPattern.exec(source);
      continue;
    }
    if (!knownNamespaces.has(explicitNamespaceMatch[1])) {
      const lineNumber = getLineNumber(source, match.index);
      failures.push(`${relativePath}:${lineNumber} references unknown explicit i18n namespace "${explicitNamespaceMatch[1]}".`);
      match = memberCallPattern.exec(source);
      continue;
    }

    const resolved = splitKeyReference(rawKey, null, knownNamespaces);
    const lineNumber = getLineNumber(source, match.index);
    const bucketKey = `${resolved.namespace}::${resolved.key}`;
    const bucket = resolved.key.includes('${')
      ? dynamicReferences
      : staticReferences;

    if (!bucket.has(bucketKey)) {
      bucket.set(bucketKey, {
        namespace: resolved.namespace,
        key: resolved.key,
        refs: [],
      });
    }
    bucket.get(bucketKey).refs.push(`${relativePath}:${lineNumber}`);
    match = memberCallPattern.exec(source);
  }

  const resolveTextPattern = /\bresolveText\s*\(\s*([A-Za-z_$][\w$]*)\s*,\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/g;
  match = resolveTextPattern.exec(source);
  while (match) {
    const identifier = match[1];
    const defaultNamespace = aliases.get(identifier) || null;
    if (!defaultNamespace) {
      match = resolveTextPattern.exec(source);
      continue;
    }

    const rawKey = match[2] ?? match[3] ?? match[4] ?? '';
    const resolved = splitKeyReference(rawKey, defaultNamespace, knownNamespaces);
    const lineNumber = getLineNumber(source, match.index);
    if (!resolved.namespace) {
      failures.push(`${relativePath}:${lineNumber} uses i18n key "${rawKey}" without a resolvable namespace.`);
      match = resolveTextPattern.exec(source);
      continue;
    }

    if (!knownNamespaces.has(resolved.namespace)) {
      failures.push(`${relativePath}:${lineNumber} references unknown i18n namespace "${resolved.namespace}".`);
      match = resolveTextPattern.exec(source);
      continue;
    }

    const bucketKey = `${resolved.namespace}::${resolved.key}`;
    const bucket = resolved.key.includes('${')
      ? dynamicReferences
      : staticReferences;

    if (!bucket.has(bucketKey)) {
      bucket.set(bucketKey, {
        namespace: resolved.namespace,
        key: resolved.key,
        refs: [],
      });
    }
    bucket.get(bucketKey).refs.push(`${relativePath}:${lineNumber}`);
    match = resolveTextPattern.exec(source);
  }
}

const enLocaleKeys = localeKeys.get('en');
const koLocaleKeys = localeKeys.get('ko');

for (const reference of staticReferences.values()) {
  const enKeys = enLocaleKeys.get(reference.namespace) || new Set();
  const koKeys = koLocaleKeys.get(reference.namespace) || new Set();
  if (!enKeys.has(reference.key) || !koKeys.has(reference.key)) {
    const missing = [];
    if (!enKeys.has(reference.key)) missing.push(`en/${reference.namespace}.json`);
    if (!koKeys.has(reference.key)) missing.push(`ko/${reference.namespace}.json`);
    failures.push(`${reference.refs[0]} references missing i18n key "${reference.namespace}:${reference.key}" in ${missing.join(', ')}.`);
  }
}

for (const reference of dynamicReferences.values()) {
  const enKeys = enLocaleKeys.get(reference.namespace) || new Set();
  const koKeys = koLocaleKeys.get(reference.namespace) || new Set();
  const resolved = resolveDynamicKeys(reference.key, enKeys);

  if (!resolved) {
    failures.push(`${reference.refs[0]} uses dynamic i18n key "${reference.namespace}:${reference.key}" without an approved contract pattern.`);
    continue;
  }

  if (resolved.keys.length <= 0) {
    failures.push(`${reference.refs[0]} uses dynamic i18n key "${reference.namespace}:${reference.key}" but the "${resolved.contract}" contract resolves no locale keys.`);
    continue;
  }

  for (const key of resolved.keys) {
    if (!enKeys.has(key) || !koKeys.has(key)) {
      const missing = [];
      if (!enKeys.has(key)) missing.push(`en/${reference.namespace}.json`);
      if (!koKeys.has(key)) missing.push(`ko/${reference.namespace}.json`);
      failures.push(`${reference.refs[0]} depends on dynamic i18n contract "${resolved.contract}" but key "${reference.namespace}:${key}" is missing in ${missing.join(', ')}.`);
    }
  }
}

if (failures.length > 0) {
  console.error('[check-i18n-contract] Contract violation detected:');
  failures.forEach((failure) => {
    console.error(`- ${failure}`);
  });
  process.exit(1);
}
