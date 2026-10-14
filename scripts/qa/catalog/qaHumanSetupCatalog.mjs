const SITE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const FEATURE_ID_PATTERN = /^[a-z][a-z0-9_]*$/u;
const TARGET_ID_PATTERN = /^[a-z0-9]+(?:[/-][a-z0-9]+)*$/u;

export const QA_HUMAN_SETUP_DEFAULT_SITE_ID = 'youtube';

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function freezeAliases(values, code) {
  if (
    !Array.isArray(values)
    || values.some((value) => (
      typeof value !== 'string'
      || !value
      || value !== value.trim()
      || value !== value.toLowerCase()
    ))
    || new Set(values).size !== values.length
  ) {
    fail(code);
  }
  return Object.freeze([...values]);
}

function defineSite({ id, defaultUrl, aliases = [] }) {
  if (typeof id !== 'string' || !SITE_ID_PATTERN.test(id)) {
    fail('QA_HUMAN_SETUP_SITE_ID_INVALID', String(id || 'missing'));
  }
  let parsed;
  try {
    parsed = new URL(defaultUrl);
  } catch (cause) {
    throw new Error(`QA_HUMAN_SETUP_SITE_DEFAULT_URL_INVALID:${id}`, { cause });
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
  ) {
    fail('QA_HUMAN_SETUP_SITE_DEFAULT_URL_FORBIDDEN', id);
  }
  return Object.freeze({
    id,
    defaultUrl: parsed.href,
    allowedOrigin: parsed.origin,
    aliases: freezeAliases(aliases, 'QA_HUMAN_SETUP_SITE_ALIASES_INVALID'),
  });
}

function defineFeature({ id, targetId, aliases = [] }) {
  if (typeof id !== 'string' || !FEATURE_ID_PATTERN.test(id)) {
    fail('QA_HUMAN_SETUP_FEATURE_ID_INVALID', String(id || 'missing'));
  }
  if (typeof targetId !== 'string' || !TARGET_ID_PATTERN.test(targetId)) {
    fail('QA_HUMAN_SETUP_FEATURE_TARGET_ID_INVALID', String(targetId || 'missing'));
  }
  return Object.freeze({
    id,
    targetId,
    aliases: freezeAliases(aliases, 'QA_HUMAN_SETUP_FEATURE_ALIASES_INVALID'),
  });
}

export const QA_HUMAN_SETUP_SITES = Object.freeze([
  defineSite({
    id: 'youtube',
    defaultUrl: 'https://www.youtube.com/',
  }),
  defineSite({
    id: 'youtube-shorts',
    defaultUrl: 'https://www.youtube.com/shorts/',
  }),
  defineSite({
    id: 'x',
    defaultUrl: 'https://x.com/home',
  }),
  defineSite({
    id: 'instagram',
    defaultUrl: 'https://www.instagram.com/',
  }),
  defineSite({
    id: 'instagram-reels',
    defaultUrl: 'https://www.instagram.com/reels/',
  }),
  defineSite({
    id: 'tiktok',
    defaultUrl: 'https://www.tiktok.com/',
  }),
  defineSite({
    id: 'reddit',
    defaultUrl: 'https://www.reddit.com/r/popular/',
  }),
  defineSite({
    id: 'facebook',
    defaultUrl: 'https://www.facebook.com/',
  }),
]);

export const QA_HUMAN_SETUP_SITE_IDS = Object.freeze(
  QA_HUMAN_SETUP_SITES.map((site) => site.id),
);

export const QA_HUMAN_SETUP_FEATURES = Object.freeze([
  defineFeature({
    id: 'site_furin',
    targetId: 'human/site-furin',
    aliases: ['site-furin', 'furin'],
  }),
  defineFeature({
    id: 'global_sentinel',
    targetId: 'human/global-furin',
    aliases: ['global-sentinel', 'global-furin'],
  }),
  defineFeature({
    id: 'shishi_odoshi',
    targetId: 'human/shishi-odoshi',
    aliases: ['shishi-odoshi'],
  }),
  defineFeature({
    id: 'enso_gate',
    targetId: 'human/enso-gate',
    aliases: ['enso-gate'],
  }),
  defineFeature({
    id: 'detour_spread_guard',
    targetId: 'human/detour-spread-guard',
    aliases: ['detour-spread-guard', 'tab-spread-guard'],
  }),
]);

export const QA_HUMAN_SETUP_FEATURE_IDS = Object.freeze(
  QA_HUMAN_SETUP_FEATURES.map((feature) => feature.id),
);

function normalizeLookupInput(input, code) {
  if (typeof input !== 'string' || !input.trim()) {
    fail(code);
  }
  return input.trim().toLowerCase();
}

function buildLookup(entries, kind) {
  const lookup = new Map();
  entries.forEach((entry) => {
    const keys = kind === 'feature'
      ? [entry.id, entry.targetId, ...entry.aliases]
      : [entry.id, ...entry.aliases];
    keys.forEach((key) => {
      if (lookup.has(key)) {
        fail(`QA_HUMAN_SETUP_${kind.toUpperCase()}_ALIAS_DUPLICATE`, key);
      }
      lookup.set(key, entry);
    });
  });
  return lookup;
}

const SITE_BY_INPUT = buildLookup(QA_HUMAN_SETUP_SITES, 'site');
const FEATURE_BY_INPUT = buildLookup(QA_HUMAN_SETUP_FEATURES, 'feature');

export function resolveQaHumanSetupSite(input) {
  const normalized = normalizeLookupInput(
    input,
    'QA_HUMAN_SETUP_SITE_REQUIRED',
  );
  const site = SITE_BY_INPUT.get(normalized);
  if (!site) fail('QA_HUMAN_SETUP_SITE_UNKNOWN', normalized);
  return site;
}

export function resolveQaHumanSetupFeature(input) {
  const normalized = normalizeLookupInput(
    input,
    'QA_HUMAN_SETUP_FEATURE_REQUIRED',
  );
  const feature = FEATURE_BY_INPUT.get(normalized);
  if (!feature) fail('QA_HUMAN_SETUP_FEATURE_UNKNOWN', normalized);
  return feature;
}

export function resolveQaHumanSetupUrl({ siteId, url = null } = {}) {
  const site = resolveQaHumanSetupSite(siteId);
  if (url === null || url === undefined) return site.defaultUrl;
  if (typeof url !== 'string' || !url.trim() || url !== url.trim()) {
    fail('QA_HUMAN_SETUP_URL_INVALID', site.id);
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch (cause) {
    throw new Error(`QA_HUMAN_SETUP_URL_INVALID:${site.id}`, { cause });
  }
  if (
    parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
  ) {
    fail('QA_HUMAN_SETUP_URL_FORBIDDEN', site.id);
  }
  if (parsed.origin !== site.allowedOrigin) {
    fail(
      'QA_HUMAN_SETUP_URL_ORIGIN_MISMATCH',
      `${site.id}:${parsed.origin}`,
    );
  }
  return parsed.href;
}

export function resolveQaHumanSetupInvocation(positionals) {
  if (!Array.isArray(positionals) || ![1, 2].includes(positionals.length)) {
    fail(
      'QA_HUMAN_SETUP_INVOCATION_POSITIONALS_INVALID',
      Array.isArray(positionals) ? String(positionals.length) : 'not_array',
    );
  }
  const site = resolveQaHumanSetupSite(
    positionals.length === 1
      ? QA_HUMAN_SETUP_DEFAULT_SITE_ID
      : positionals[0],
  );
  const feature = resolveQaHumanSetupFeature(positionals.at(-1));
  return Object.freeze({
    siteId: site.id,
    featureId: feature.id,
    targetId: feature.targetId,
    url: site.defaultUrl,
  });
}
