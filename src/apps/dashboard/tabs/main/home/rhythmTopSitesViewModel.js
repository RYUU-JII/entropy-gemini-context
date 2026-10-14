import { STATUS_DOMAIN_CANDIDATE_DISPOSITIONS } from '@/domains/stats/analysis/index.js';

const TOP_SITE_LIMIT = 5;
const PRESSURE_DISPOSITIONS = new Set(Object.values(STATUS_DOMAIN_CANDIDATE_DISPOSITIONS));

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const normalizeDomain = (value) => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

function requirePressureShare(candidate, domain) {
  const pressureShare = Number(candidate?.pressureShare);
  if (!Number.isFinite(pressureShare) || pressureShare < 0 || pressureShare > 1) {
    throw new Error(`RHYTHM_TOP_SITE_PRESSURE_SHARE_INVALID:${domain}`);
  }
  return pressureShare;
}

function requireWeightedPressureMs(candidate, domain) {
  const weightedPressureMs = Number(candidate?.weightedPressureMs);
  if (!Number.isFinite(weightedPressureMs) || weightedPressureMs < 0) {
    throw new Error(`RHYTHM_TOP_SITE_WEIGHTED_PRESSURE_INVALID:${domain}`);
  }
  return weightedPressureMs;
}

function requireVisibleRank(candidate, domain) {
  const visibleRank = Number(candidate?.visibleRank);
  if (!Number.isInteger(visibleRank) || visibleRank < 1) {
    throw new Error(`RHYTHM_TOP_SITE_VISIBLE_RANK_INVALID:${domain}`);
  }
  return visibleRank;
}

function requirePolicyDisposition(candidate, domain) {
  const disposition = typeof candidate?.policyDisposition === 'string'
    ? candidate.policyDisposition.trim().toLowerCase()
    : '';
  if (!PRESSURE_DISPOSITIONS.has(disposition)) {
    throw new Error(`RHYTHM_TOP_SITE_POLICY_DISPOSITION_INVALID:${domain}`);
  }
  return disposition;
}

function projectVisibleCandidate(candidate, index, selectedDomain) {
  const domain = normalizeDomain(candidate?.domain);
  if (!domain) {
    throw new Error(`RHYTHM_TOP_SITE_DOMAIN_INVALID:${index}`);
  }
  const weightedPressureMs = requireWeightedPressureMs(candidate, domain);
  const pressureShare = requirePressureShare(candidate, domain);
  const policyDisposition = requirePolicyDisposition(candidate, domain);
  const visibleRank = requireVisibleRank(candidate, domain);
  const blocked = policyDisposition === STATUS_DOMAIN_CANDIDATE_DISPOSITIONS.PROTECTED;
  const managed = blocked
    || policyDisposition === STATUS_DOMAIN_CANDIDATE_DISPOSITIONS.MANAGED_ALLOWED;

  return {
    ...candidate,
    domain,
    activeMs: weightedPressureMs,
    todayActiveMs: Math.max(0, toNumber(candidate?.todayActiveMs)),
    rawWindowMs: Math.max(0, toNumber(candidate?.rawWindowMs)),
    weightedPressureMs,
    visibleUsageMs: Math.max(0, toNumber(candidate?.visibleUsageMs)),
    pressureShare,
    shareOfDay: pressureShare,
    visibleRank,
    policyDisposition,
    cohort: blocked ? 'blocked' : (managed ? 'managed' : 'unmanaged'),
    policyStatus: blocked ? 'blocked' : 'allowed',
    blocked,
    managed,
    selected: Boolean(selectedDomain && domain === selectedDomain),
  };
}

export function buildRhythmTopSitesViewModel({
  lensDomain = '',
  visibleDomainCandidates = [],
} = {}) {
  if (!Array.isArray(visibleDomainCandidates)) {
    throw new Error('RHYTHM_TOP_SITE_VISIBLE_CANDIDATES_INVALID');
  }
  const selectedDomain = normalizeDomain(lensDomain);

  return visibleDomainCandidates
    .map((candidate, index) => projectVisibleCandidate(candidate, index, selectedDomain))
    .filter((entry) => entry.activeMs > 0 && entry.pressureShare > 0)
    .sort((left, right) => {
      const rankDiff = left.visibleRank - right.visibleRank;
      if (rankDiff !== 0) return rankDiff;
      return left.domain.localeCompare(right.domain);
    })
    .slice(0, TOP_SITE_LIMIT);
}
