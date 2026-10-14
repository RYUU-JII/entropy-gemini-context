const normalizeDomain = (value) => (
  typeof value === 'string' && value.trim()
    ? value.trim().toLowerCase()
    : ''
);

const toNonNegativeNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
};

const compareRepresentedSites = (left, right) => {
  const pressureDiff = right.weightedPressureMs - left.weightedPressureMs;
  if (pressureDiff !== 0) return pressureDiff;
  const selectionDiff = right.selectionScore - left.selectionScore;
  if (selectionDiff !== 0) return selectionDiff;
  return left.registrationIndex - right.registrationIndex;
};

export function buildProtectedSiteKoiCandidatePool({
  registeredSiteDomains = [],
  domainCandidates = [],
  blockedDomains = [],
} = {}) {
  const blockedDomainSet = new Set(
    (Array.isArray(blockedDomains) ? blockedDomains : [])
      .map(normalizeDomain)
      .filter(Boolean),
  );
  const candidateByDomain = new Map(
    (Array.isArray(domainCandidates) ? domainCandidates : [])
      .map((candidate) => [normalizeDomain(candidate?.domain), candidate])
      .filter(([domain]) => Boolean(domain)),
  );
  return (Array.isArray(registeredSiteDomains) ? registeredSiteDomains : [])
    .map(normalizeDomain)
    .filter(Boolean)
    .map((domain, index) => {
      const source = candidateByDomain.get(domain) || {};
      const blocked = blockedDomainSet.has(domain);
      const weightedPressureMs = toNonNegativeNumber(source.weightedPressureMs);
      const rawWindowMs = toNonNegativeNumber(source.rawWindowMs);
      const pressureShare = Math.min(1, toNonNegativeNumber(source.pressureShare));
      return {
        ...source,
        domain,
        cohort: blocked ? 'blocked' : 'managed',
        policyStatus: blocked ? 'blocked' : 'allowed',
        blocked,
        managed: true,
        policyDisposition: blocked ? 'protected' : 'managed_allowed',
        rawWindowMs,
        weightedPressureMs,
        pressureShare,
        selectionScore: Number.isFinite(Number(source.selectionScore))
          ? Number(source.selectionScore)
          : Math.max(1, 5 - index),
        registrationIndex: index,
      };
    })
    .sort(compareRepresentedSites)
    .map((candidate, index) => ({ ...candidate, pressureRank: index + 1 }));
}

export function buildProtectedSiteKoiCandidates(input) {
  return buildProtectedSiteKoiCandidatePool(input).slice(0, 5)
    .map(({ registrationIndex: _registrationIndex, ...candidate }, index) => ({
      ...candidate,
      visibleRank: index + 1,
    }));
}
