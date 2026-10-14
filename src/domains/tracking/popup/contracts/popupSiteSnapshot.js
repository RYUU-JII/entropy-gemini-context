import { requireFrictionIntensityBand } from '../../../settings/config/frictionIntensityBands.js';
import { normalizeDomain } from '../../../../lib/domain.js';
import {
  FILTER_EXECUTION_SOURCES,
  normalizeFilterExecutionSource,
} from '../../../protection/contracts/filterExecutionContracts.js';

export const POPUP_ARTIFACT_STATE_VALUES = Object.freeze(['disabled', 'armed', 'engaged', 'cleanup']);

const POPUP_SNAPSHOT_KEYS = new Set(['capturedAt', 'refreshAt', 'site', 'metrics', 'protection', 'access']);
const POPUP_SITE_KEYS = new Set(['pageUrl', 'hostname', 'supported']);
const POPUP_METRICS_KEYS = new Set([
  'dateStr',
  'hasTodayStats',
  'todayMs',
  'weeklyAverageDailyMs',
  'trackedTodayMs',
  'shareOfTracked',
]);
const POPUP_PROTECTION_KEYS = new Set([
  'isProtected',
  'goalMinutes',
  'level',
  'reasons',
  'activeFilters',
  'activeArtifacts',
  'standbyArtifacts',
]);
const POPUP_ACCESS_KEYS = new Set(['permissionMode', 'managedSiteCount', 'requiresDashboardRegistration', 'sitesManagementVisible']);
const POPUP_FILTER_KEYS = new Set([
  'key',
  'band',
  'source',
  'policyLevel',
  'policyApplied',
  'runtimeArtifactId',
]);

function requireKnownKeys(source, allowedKeys, errorCode) {
  const unknownKey = Object.keys(source).find((key) => !allowedKeys.has(key));
  if (unknownKey) {
    throw new Error(`${errorCode}:${unknownKey}`);
  }
}

function requireRegistrationAccessFlag(value) {
  if (typeof value !== 'boolean') throw new Error('POPUP_SITE_REGISTRATION_JOURNEY_ACCESS_REQUIRED');
  return value;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeRatio(value) {
  return clamp(toFiniteNumber(value, 0), 0, 1);
}

function normalizeArtifactList(values = []) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const next = [];
  values.forEach((value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    next.push(normalized);
  });
  return next;
}

function normalizeFilterDiagnostics(values = []) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const next = [];
  values.forEach((value) => {
    const source = value && typeof value === 'object' ? value : {};
    requireKnownKeys(source, POPUP_FILTER_KEYS, 'POPUP_FILTER_FIELD_INVALID');
    const key = typeof source.key === 'string' ? source.key.trim() : '';
    if (!key || seen.has(key)) return;
    seen.add(key);

    const band = source.band === null || source.band === undefined ? null : requireFrictionIntensityBand(source.band);
    next.push({
      key,
      band,
      source: normalizeFilterExecutionSource(
        source.source,
        FILTER_EXECUTION_SOURCES.USER_CONFIG,
      ),
      policyLevel: source.policyLevel !== null
        && source.policyLevel !== undefined
        && Number.isFinite(Number(source.policyLevel))
        ? Math.max(1, Math.floor(Number(source.policyLevel)))
        : null,
      policyApplied: source.policyApplied === true,
      runtimeArtifactId: typeof source.runtimeArtifactId === 'string'
        ? source.runtimeArtifactId.trim()
        : '',
    });
  });
  return next;
}

export function buildEmptyPopupSiteSnapshot() {
  return {
    capturedAt: 0,
    refreshAt: 0,
    site: {
      pageUrl: '',
      hostname: '',
      supported: false,
    },
    metrics: {
      dateStr: '',
      hasTodayStats: false,
      todayMs: 0,
      weeklyAverageDailyMs: 0,
      trackedTodayMs: 0,
      shareOfTracked: 0,
    },
    protection: {
      isProtected: false,
      goalMinutes: 0,
      level: 1,
      reasons: [],
      activeFilters: [],
      activeArtifacts: [],
      standbyArtifacts: [],
    },
    access: {
      permissionMode: 'selective',
      managedSiteCount: 0,
      requiresDashboardRegistration: true,
      sitesManagementVisible: false,
    },
  };
}

export function normalizePopupSiteSnapshot(rawSnapshot) {
  const source = rawSnapshot && typeof rawSnapshot === 'object'
    ? rawSnapshot
    : buildEmptyPopupSiteSnapshot();
  const site = source.site && typeof source.site === 'object' ? source.site : {};
  const metrics = source.metrics && typeof source.metrics === 'object' ? source.metrics : {};
  const protection = source.protection && typeof source.protection === 'object' ? source.protection : {};
  const access = source.access && typeof source.access === 'object' ? source.access : {};
  requireKnownKeys(source, POPUP_SNAPSHOT_KEYS, 'POPUP_SITE_SNAPSHOT_FIELD_INVALID');
  requireKnownKeys(site, POPUP_SITE_KEYS, 'POPUP_SITE_FIELD_INVALID');
  requireKnownKeys(metrics, POPUP_METRICS_KEYS, 'POPUP_METRICS_FIELD_INVALID');
  requireKnownKeys(protection, POPUP_PROTECTION_KEYS, 'POPUP_PROTECTION_FIELD_INVALID');
  requireKnownKeys(access, POPUP_ACCESS_KEYS, 'POPUP_ACCESS_FIELD_INVALID');
  if (access.permissionMode !== 'selective') {
    throw new Error('POPUP_SITE_PERMISSION_MODE_CONTRACT_INVALID');
  }

  const hostname = normalizeDomain(site.hostname || '');
  if (site.supported && (!Number.isSafeInteger(source.refreshAt)
    || !Number.isSafeInteger(source.capturedAt) || source.refreshAt <= source.capturedAt)) {
    throw new Error('POPUP_SITE_SNAPSHOT_REFRESH_BOUNDARY_INVALID');
  }
  const todayMs = Math.max(0, toFiniteNumber(metrics.todayMs, 0));
  const weeklyAverageDailyMs = Math.max(0, toFiniteNumber(metrics.weeklyAverageDailyMs, 0));
  const trackedTodayMs = Math.max(0, toFiniteNumber(metrics.trackedTodayMs, 0));
  const goalMinutes = Math.max(0, Math.floor(toFiniteNumber(protection.goalMinutes, 0)));

  return {
    capturedAt: Math.max(0, Math.floor(toFiniteNumber(source.capturedAt, 0))),
    refreshAt: site.supported ? source.refreshAt : 0,
    site: {
      pageUrl: typeof site.pageUrl === 'string' ? site.pageUrl : '',
      hostname,
      supported: !!site.supported && !!hostname,
    },
    metrics: {
      dateStr: typeof metrics.dateStr === 'string' ? metrics.dateStr : '',
      hasTodayStats: metrics.hasTodayStats === true,
      todayMs,
      weeklyAverageDailyMs,
      trackedTodayMs,
      shareOfTracked: normalizeRatio(metrics.shareOfTracked),
    },
    protection: {
      isProtected: !!protection.isProtected,
      goalMinutes,
      level: clamp(Math.round(toFiniteNumber(protection.level, 1)), 1, 5),
      reasons: Array.isArray(protection.reasons)
        ? protection.reasons.filter((item) => typeof item === 'string' && item.trim())
        : [],
      activeFilters: normalizeFilterDiagnostics(protection.activeFilters),
      activeArtifacts: normalizeArtifactList(protection.activeArtifacts),
      standbyArtifacts: normalizeArtifactList(protection.standbyArtifacts),
    },
    access: {
      permissionMode: 'selective',
      managedSiteCount: Math.max(0, Math.floor(toFiniteNumber(access.managedSiteCount, 0))),
      requiresDashboardRegistration: requireRegistrationAccessFlag(access.requiresDashboardRegistration),
      sitesManagementVisible: requireRegistrationAccessFlag(access.sitesManagementVisible),
    },
  };
}
