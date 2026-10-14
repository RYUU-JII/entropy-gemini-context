import { normalizeDomain } from './domain.js';

const RAW_SITE_ALIAS_GROUPS = Object.freeze([
  Object.freeze(['youtube.com', 'youtu.be']),
  Object.freeze(['twitter.com', 'x.com']),
]);

function normalizeAliasGroup(group) {
  const source = Array.isArray(group) ? group : [];
  const seen = new Set();
  const normalizedGroup = [];

  source.forEach((entry) => {
    const normalized = normalizeDomain(entry);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    normalizedGroup.push(normalized);
  });

  return normalizedGroup.length > 1 ? Object.freeze(normalizedGroup) : null;
}

export const SITE_ALIAS_GROUPS = Object.freeze(
  RAW_SITE_ALIAS_GROUPS
    .map((group) => normalizeAliasGroup(group))
    .filter(Boolean),
);

const SITE_ALIAS_LOOKUP = (() => {
  const lookup = new Map();

  SITE_ALIAS_GROUPS.forEach((group) => {
    group.forEach((host) => {
      lookup.set(host, group);
    });
  });

  return lookup;
})();

export function getSiteAliasGroup(hostname) {
  const normalized = normalizeDomain(hostname);
  if (!normalized) return [];
  return SITE_ALIAS_LOOKUP.get(normalized) || [];
}

export function getSiteAliasHosts(hostname) {
  const normalized = normalizeDomain(hostname);
  if (!normalized) return [];

  const group = SITE_ALIAS_LOOKUP.get(normalized);
  if (!group) return [];

  return group.filter((host) => host !== normalized);
}

