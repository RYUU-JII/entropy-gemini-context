import { useId, useMemo } from 'react';

function sanitizeSvgIdFragment(value, fallback = 'artifact') {
  const normalized = String(value ?? '')
    .trim()
    .replace(/:/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
}

export function createArtifactSvgIdScope(prefix = 'artifact', seed = '') {
  const scope = `${sanitizeSvgIdFragment(prefix)}-${sanitizeSvgIdFragment(seed, 'scope')}`;
  const resolvedIds = new Map();

  return Object.freeze({
    scope,
    get(token) {
      const safeToken = sanitizeSvgIdFragment(token, 'node');
      if (!resolvedIds.has(safeToken)) {
        resolvedIds.set(safeToken, `${scope}-${safeToken}`);
      }
      return resolvedIds.get(safeToken);
    },
    url(token) {
      return `url(#${this.get(token)})`;
    },
  });
}

export function useArtifactSvgIdScope(prefix = 'artifact') {
  const seed = useId();
  return useMemo(() => createArtifactSvgIdScope(prefix, seed), [prefix, seed]);
}
