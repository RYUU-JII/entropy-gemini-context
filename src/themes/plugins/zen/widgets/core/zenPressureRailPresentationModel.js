const OTHER_TARGET_ID = 'other';
const PRESSURE_SHARE_EPSILON = 0.000001;

export const ZEN_PRESSURE_MIN_SEGMENT_WIDTH_PX = 32;
export const ZEN_PRESSURE_FAVICON_SIZE_PX = 24;
export const ZEN_PRESSURE_FAVICON_SOURCE_SIZE_PX = 64;

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function normalizeZenPressureDomain(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function requirePressureSite(site, index) {
  const domain = normalizeZenPressureDomain(site?.domain);
  if (!domain) throw new Error(`ZEN_PRESSURE_SITE_DOMAIN_INVALID:${index}`);
  const activeMs = Number(site?.weightedPressureMs);
  if (!Number.isFinite(activeMs) || activeMs <= 0) {
    throw new Error(`ZEN_PRESSURE_SITE_ACTIVE_INVALID:${domain}`);
  }
  const pressureShare = Number(site?.pressureShare);
  if (!Number.isFinite(pressureShare) || pressureShare <= 0 || pressureShare > 1) {
    throw new Error(`ZEN_PRESSURE_SITE_SHARE_INVALID:${domain}`);
  }
  const policyDisposition = typeof site?.policyDisposition === 'string'
    ? site.policyDisposition.trim().toLowerCase()
    : '';
  if (!policyDisposition) {
    throw new Error(`ZEN_PRESSURE_SITE_DISPOSITION_MISSING:${domain}`);
  }
  const rawWindowMs = Number(site?.rawWindowMs);
  if (!Number.isFinite(rawWindowMs) || rawWindowMs < 0) {
    throw new Error(`ZEN_PRESSURE_SITE_RAW_USAGE_INVALID:${domain}`);
  }
  return {
    ...site,
    domain,
    activeMs,
    weightedPressureMs: activeMs,
    rawWindowMs,
    pressureShare,
    policyDisposition,
    pressureRank: Math.max(0, Math.floor(toNumber(site.pressureRank))),
  };
}

function buildOtherAggregate({ sites, pressureSummary, otherShare }) {
  if (otherShare <= PRESSURE_SHARE_EPSILON) return null;
  const totalMs = Math.max(0, toNumber(pressureSummary?.totalMs));
  const protectedMs = Math.max(0, toNumber(pressureSummary?.protectedMs));
  const visibleMs = sites.reduce((sum, site) => sum + site.activeMs, 0);
  const visibleProtectedMs = sites.reduce(
    (sum, site) => sum + (site.policyDisposition === 'protected' ? site.activeMs : 0),
    0,
  );
  const activeMs = totalMs > 0 ? Math.max(0, totalMs - visibleMs) : 0;
  const protectedRemainderMs = Math.min(activeMs, Math.max(0, protectedMs - visibleProtectedMs));
  return {
    activeMs,
    protectedMs: protectedRemainderMs,
    protectedRatio: activeMs > 0 ? Math.min(1, protectedRemainderMs / activeMs) : 0,
  };
}

export function buildZenPressureRailPresentationModel(pressureSites, pressureSummary) {
  const sites = (Array.isArray(pressureSites) ? pressureSites : []).map(requirePressureSite);
  const domainSet = new Set();
  sites.forEach((site) => {
    if (domainSet.has(site.domain)) throw new Error(`ZEN_PRESSURE_SITE_DUPLICATED:${site.domain}`);
    domainSet.add(site.domain);
  });
  const usedShare = sites.reduce((sum, site) => sum + site.pressureShare, 0);
  if (usedShare > 1 + PRESSURE_SHARE_EPSILON) {
    throw new Error(`ZEN_PRESSURE_SHARE_TOTAL_INVALID:${usedShare}`);
  }

  const segments = sites;
  const otherShare = Math.max(0, 1 - usedShare);
  const otherAggregate = buildOtherAggregate({ sites, pressureSummary, otherShare });
  const otherSegment = otherAggregate
    ? {
        id: OTHER_TARGET_ID,
        pressureShare: otherShare,
        aggregate: otherAggregate,
      }
    : null;

  return {
    segments,
    otherShare,
    otherSegment,
  };
}

// Only undersized segments hit the floor. Remaining domains keep their pressure
// ratios; Other is aggregated from actual shares before this visual allocation.
export function layoutZenPressureRail(model, dataWidth) {
  if (!Number.isFinite(dataWidth) || dataWidth <= 0) throw new Error('ZEN_PRESSURE_DATA_WIDTH_INVALID');
  const items = [...model.segments, ...(model.otherSegment ? [{ ...model.otherSegment, pressureShare: model.otherShare }] : [])];
  const width = Math.max(dataWidth, items.length * ZEN_PRESSURE_MIN_SEGMENT_WIDTH_PX);
  const widths = items.map(() => 0);
  let remaining = width;
  let free = items.map((_, i) => i);
  while (free.length) {
    const total = free.reduce((sum, i) => sum + items[i].pressureShare, 0);
    const small = free.filter(i => remaining * items[i].pressureShare / total < ZEN_PRESSURE_MIN_SEGMENT_WIDTH_PX);
    if (!small.length) {
      free.forEach(i => { widths[i] = remaining * items[i].pressureShare / total; });
      break;
    }
    small.forEach(i => { widths[i] = ZEN_PRESSURE_MIN_SEGMENT_WIDTH_PX; remaining -= ZEN_PRESSURE_MIN_SEGMENT_WIDTH_PX; });
    free = free.filter(i => !small.includes(i));
  }
  let offset = 0;
  const segments = model.segments.map((site, i) => {
    const visualWidth = widths[i];
    const visualCenterPercent = (offset + visualWidth / 2) / width * 100;
    offset += visualWidth;
    return { ...site, visualWidth, visualCenterPercent };
  });
  return { ...model, segments, width, otherSegment: model.otherSegment
    ? { ...model.otherSegment, visualWidth: widths.at(-1) } : null };
}
