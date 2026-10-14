const orderedRegistryArrays = new WeakMap();

function readAverage(siteRegistry, domain) {
  const average = siteRegistry?.byDomain?.[domain]?.usageAverage;
  if (!average || average.averageMs === null) return -1;
  if (!Number.isFinite(average.averageMs) || average.averageMs < 0) throw new Error('SITES_REGISTRY_AVERAGE_INVALID');
  return average.averageMs;
}

export function compareSitesRegistryDomains(left, right, { siteRegistry } = {}) {
  return readAverage(siteRegistry, right) - readAverage(siteRegistry, left) || left.localeCompare(right);
}

export function sortSitesRegistryDomains(domains, options = {}) {
  const source = Array.isArray(domains) ? domains : [];
  if (orderedRegistryArrays.has(source) && orderedRegistryArrays.get(source) === options.siteRegistry) return source;
  const ordered = [...source].sort((left, right) => compareSitesRegistryDomains(left, right, options));
  orderedRegistryArrays.set(ordered, options.siteRegistry);
  return ordered;
}
