import { requireSentinelFlareDeliveryForm } from '../../../domains/nudge/runtime/sentinelFlareDeliveryForm.js';

export const FURIN_DAILY_RECEIPT_VERSION = 2;
export const FURIN_DAILY_SITE_LIMIT = 1024;
export const FURIN_SITE_END_RENDERERS = Object.freeze(['site_furin', 'combined_global_furin', 'budget_horizon']);

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return record(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}

export function requireFurinActivityDate(value) {
  const parsed = typeof value === 'string' ? new Date(`${value}T00:00:00.000Z`) : null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('FURIN_ACTIVITY_DATE_INVALID');
  }
  return value;
}

export const requireFurinDeliveryForm = requireSentinelFlareDeliveryForm;

function receipt(value) {
  return record(value) && typeof value.runId === 'string' && value.runId.length > 0
    && Number.isSafeInteger(value.presentedAt) && value.presentedAt > 0
    && value.source === 'actual_presentation';
}

function isCanonicalHostname(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 253
    && value === value.trim().toLowerCase();
}

function samePresentation(left, right) {
  return left?.runId === right.runId && left?.presentedAt === right.presentedAt;
}

export function requireFurinSiteEndReceipt(value) {
  if (!exactKeys(value, ['runId', 'presentedAt', 'renderer', 'scopes'])
    || typeof value.runId !== 'string' || !value.runId
    || !Number.isSafeInteger(value.presentedAt) || value.presentedAt <= 0
    || !FURIN_SITE_END_RENDERERS.includes(value.renderer)
    || !Array.isArray(value.scopes)
    || value.scopes.join(',') !== (value.renderer === 'combined_global_furin' ? 'global,site' : 'site')) {
    throw new Error('FURIN_SITE_END_RECEIPT_INVALID');
  }
  return value;
}

export function requireFurinDailyReceipt(value) {
  if (record(value) && value.version !== FURIN_DAILY_RECEIPT_VERSION) {
    throw new Error(`FURIN_DAILY_RECEIPT_VERSION_UNSUPPORTED:${String(value.version)}`);
  }
  if (!exactKeys(value, ['version', 'dateStr', 'fullSite', 'global', 'sites', 'siteEnds'])
    || value.version !== FURIN_DAILY_RECEIPT_VERSION || !record(value.sites)
    || !record(value.siteEnds) || Object.keys(value.sites).length > FURIN_DAILY_SITE_LIMIT
    || Object.keys(value.siteEnds).length > FURIN_DAILY_SITE_LIMIT) {
    throw new Error('FURIN_DAILY_RECEIPT_INVALID');
  }
  requireFurinActivityDate(value.dateStr);
  for (const [hostname, site] of Object.entries(value.sites)) {
    if (!hostname || hostname.length > 253 || hostname !== hostname.trim().toLowerCase()
      || !exactKeys(site, ['runId', 'presentedAt', 'deliveryForm', 'source']) || !receipt(site)) {
      throw new Error('FURIN_DAILY_SITE_RECEIPT_INVALID');
    }
    requireFurinDeliveryForm(site.deliveryForm);
    const end = value.siteEnds[hostname];
    if (!end || end.renderer !== 'site_furin' || !samePresentation(site, end)) {
      throw new Error('FURIN_DAILY_SITE_END_MISMATCH');
    }
  }
  if (value.global !== null && (!exactKeys(value.global, ['runId', 'presentedAt', 'source']) || !receipt(value.global))) {
    throw new Error('FURIN_DAILY_GLOBAL_RECEIPT_INVALID');
  }
  for (const [host, end] of Object.entries(value.siteEnds)) {
    if (!isCanonicalHostname(host)) throw new Error('FURIN_DAILY_SITE_END_HOSTNAME_INVALID');
    requireFurinSiteEndReceipt(end);
    if (end.renderer === 'site_furin' && !samePresentation(value.sites[host], end)) {
      throw new Error('FURIN_DAILY_SITE_END_MISMATCH');
    }
    if (end.renderer === 'combined_global_furin' && !samePresentation(value.global, end)) {
      throw new Error('FURIN_DAILY_COMBINED_RECEIPT_MISMATCH');
    }
  }
  if (value.fullSite !== null) {
    const full = value.fullSite;
    const site = value.sites[full.hostname];
    if (!exactKeys(full, ['hostname', 'runId', 'presentedAt', 'source']) || !receipt(full)
      || site?.deliveryForm !== 'full' || site.runId !== full.runId || site.presentedAt !== full.presentedAt) {
      throw new Error('FURIN_DAILY_FULL_SITE_RECEIPT_INVALID');
    }
  }
  if (Object.entries(value.sites).some(([hostname, site]) => site.deliveryForm === 'full'
    && value.fullSite?.hostname !== hostname)) throw new Error('FURIN_DAILY_FULL_SITE_DUPLICATED');
  return value;
}
