import previewCopyCatalog from '../../../assets/mockups/copy/previewCopyCatalog.json';
import { runtimeGetURL } from '../../../platform/chrome/ChromeService.js';
import {
  readSettingsPreviewCopyStateCache,
  writeSettingsPreviewCopyStateCache,
} from '../../../platform/browser/cache/SettingsPreviewCopyStateCache.js';
import { createSeededRandom } from '../../../lib/textShuffle.js';
import { normalizeThemeId } from '../../../themes/core/ids.js';
import {
  MOCKUP_IMAGE_VARIANTS,
} from '../../../lib/assets/mockups.js';

export const SETTINGS_PREVIEW_TEXT_FALLBACK = '샘플 텍스트를 불러오지 못했습니다';

const PREVIEW_IMAGE_SAMPLES = MOCKUP_IMAGE_VARIANTS;

const PREVIEW_RECENT_IDS_LIMIT = 24;
const PREVIEW_MAX_TRACKED_IDS = 256;
const PREVIEW_EASTER_COOLDOWN_MS = 45 * 60 * 1000;
const PREVIEW_EASTER_CHANCE = 0.03;
const PREVIEW_EASTER_ENABLED = false;

function normalizePlatformId(raw) {
  const id = String(raw || '').trim().toLowerCase();
  if (!id) return 'default';
  return id;
}

function normalizeCopyState(raw) {
  const base = raw && typeof raw === 'object' ? raw : {};
  const recentIds = Array.isArray(base.recentIds)
    ? base.recentIds.filter((id) => typeof id === 'string' && id.trim())
    : [];

  const shownAtById = {};
  const sourceShownAt = base.shownAtById && typeof base.shownAtById === 'object'
    ? base.shownAtById
    : {};

  for (const [id, ts] of Object.entries(sourceShownAt)) {
    const numericTs = Number(ts);
    if (!id || !Number.isFinite(numericTs) || numericTs <= 0) continue;
    shownAtById[id] = numericTs;
  }

  const lastEasterAt = Number(base.lastEasterAt);
  const spin = Number(base.spin);

  return {
    recentIds: recentIds.slice(-PREVIEW_RECENT_IDS_LIMIT),
    shownAtById,
    lastEasterAt: Number.isFinite(lastEasterAt) ? Math.max(0, lastEasterAt) : 0,
    spin: Number.isFinite(spin) ? Math.max(0, Math.floor(spin)) : 0,
  };
}

function readCopyState() {
  return normalizeCopyState(readSettingsPreviewCopyStateCache());
}

function writeCopyState(state) {
  writeSettingsPreviewCopyStateCache(state);
}

function normalizeCatalogEntries(rawEntries) {
  if (!Array.isArray(rawEntries)) return [];
  return rawEntries
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const id = typeof entry.id === 'string' && entry.id.trim()
        ? entry.id.trim()
        : `preview_copy_${index + 1}`;
      const text = typeof entry.text === 'string' ? entry.text.trim() : '';
      if (!text) return null;
      const weight = Number(entry.weight);
      const cooldownHours = Number(entry.cooldownHours);
      return Object.freeze({
        id,
        platform: typeof entry.platform === 'string' ? entry.platform.trim().toLowerCase() : 'any',
        theme: typeof entry.theme === 'string' ? entry.theme.trim().toLowerCase() : 'any',
        slot: typeof entry.slot === 'string' ? entry.slot.trim().toLowerCase() : 'body',
        rarity: typeof entry.rarity === 'string' ? entry.rarity.trim().toLowerCase() : 'common',
        weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
        cooldownMs: Number.isFinite(cooldownHours) && cooldownHours > 0
          ? cooldownHours * 60 * 60 * 1000
          : 0,
        easterEgg: !!entry.easterEgg,
        text,
      });
    })
    .filter(Boolean);
}

const COPY_CATALOG = Object.freeze(normalizeCatalogEntries(previewCopyCatalog?.entries));

function isRareEntry(entry) {
  return entry?.rarity === 'rare' || !!entry?.easterEgg;
}

function isEligibleForContext(entry, platformId, themeId) {
  const platformOk = entry.platform === 'any' || entry.platform === platformId;
  const themeOk = entry.theme === 'any' || entry.theme === themeId;
  return platformOk && themeOk && entry.slot === 'body';
}

function isCooledDown(entry, state, nowTs) {
  const lastTs = Number(state.shownAtById?.[entry.id] || 0);
  if (!Number.isFinite(lastTs) || lastTs <= 0) return true;
  return nowTs - lastTs >= entry.cooldownMs;
}

function weightedPick(entries, randomFn) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const total = entries.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  if (total <= 0) return entries[0] || null;
  const randomPoint = randomFn() * total;
  let cursor = 0;
  for (const entry of entries) {
    cursor += Number(entry.weight) || 0;
    if (randomPoint <= cursor) return entry;
  }
  return entries[entries.length - 1] || null;
}

function orderCandidates(entries, state) {
  const recentSet = new Set(state.recentIds || []);
  const withoutRecent = entries.filter((entry) => !recentSet.has(entry.id));
  if (withoutRecent.length > 0) return withoutRecent;
  return entries;
}

function pruneShownHistory(nextState, nowTs) {
  const pairs = Object.entries(nextState.shownAtById || {})
    .filter(([, ts]) => Number.isFinite(Number(ts)) && Number(ts) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));

  const kept = pairs.slice(0, PREVIEW_MAX_TRACKED_IDS);
  const trimmedShownAtById = {};
  for (const [id, ts] of kept) {
    trimmedShownAtById[id] = Number(ts);
  }

  return {
    ...nextState,
    shownAtById: trimmedShownAtById,
    recentIds: (nextState.recentIds || []).slice(-PREVIEW_RECENT_IDS_LIMIT),
    spin: Number.isFinite(nextState.spin) ? nextState.spin : 0,
    lastEasterAt: Number.isFinite(nextState.lastEasterAt) ? nextState.lastEasterAt : 0,
    _now: nowTs,
  };
}

function markSelection(state, entry, nowTs) {
  const nextState = {
    ...state,
    spin: (state.spin || 0) + 1,
    shownAtById: {
      ...(state.shownAtById || {}),
      [entry.id]: nowTs,
    },
    recentIds: [...(state.recentIds || []), entry.id],
  };

  if (isRareEntry(entry)) {
    nextState.lastEasterAt = nowTs;
  }

  const pruned = pruneShownHistory(nextState, nowTs);
  delete pruned._now;
  return pruned;
}

function buildSeed(nowTs, platformId, themeId, spin) {
  const day = new Date(nowTs).toISOString().slice(0, 10);
  return `${day}:${platformId}:${themeId}:${spin}`;
}

function getCandidatesForContext(platformId, themeId) {
  const platformFallbackOrder = platformId === 'default-dark'
    ? ['default-dark', 'default']
    : [platformId];

  for (const platformKey of platformFallbackOrder) {
    const primary = COPY_CATALOG.filter((entry) => isEligibleForContext(entry, platformKey, themeId));
    if (primary.length > 0) return primary;

    const platformOnly = COPY_CATALOG.filter((entry) => isEligibleForContext(entry, platformKey, 'any'));
    if (platformOnly.length > 0) return platformOnly;
  }

  return COPY_CATALOG.filter((entry) => isEligibleForContext(entry, 'any', 'any'));
}

function pickPreviewEntry({
  platformId,
  themeId,
  state,
  nowTs,
  excludedIds = null,
}) {
  const contextCandidates = getCandidatesForContext(platformId, themeId);
  if (contextCandidates.length === 0) return null;

  const filteredByExcluded = Array.isArray(excludedIds) && excludedIds.length > 0
    ? contextCandidates.filter((entry) => !excludedIds.includes(entry.id))
    : contextCandidates;
  const baseCandidates = filteredByExcluded.length > 0 ? filteredByExcluded : contextCandidates;

  const cooled = baseCandidates.filter((entry) => isCooledDown(entry, state, nowTs));
  const eligibleCandidates = cooled.length > 0 ? cooled : baseCandidates;
  const ordered = orderCandidates(eligibleCandidates, state);

  if (ordered.length === 0) return null;

  const rareCandidates = ordered.filter((entry) => isRareEntry(entry));
  const normalCandidates = ordered.filter((entry) => !isRareEntry(entry));

  const rng = createSeededRandom(buildSeed(nowTs, platformId, themeId, state.spin || 0));
  const easterReady = nowTs - (state.lastEasterAt || 0) >= PREVIEW_EASTER_COOLDOWN_MS;
  const shouldUseRare = PREVIEW_EASTER_ENABLED
    && rareCandidates.length > 0
    && easterReady
    && rng() < PREVIEW_EASTER_CHANCE;

  if (shouldUseRare) {
    return weightedPick(rareCandidates, rng);
  }

  if (normalCandidates.length > 0) {
    return weightedPick(normalCandidates, rng);
  }

  return weightedPick(ordered, rng);
}

function fallbackLine(platformId) {
  switch (platformId) {
    case 'youtube':
      return '새 업로드 체크: 컷, 자막, 오디오 밸런스 검증 완료.';
    case 'x':
      return 'Shipping note: UI polish pass queued for release.';
    case 'instagram':
      return '오늘 피드 초안 업데이트 완료. 게시 전 최종 검수 진행.';
    case 'tiktok':
      return '짧은 클립 편집 완료. 다음 컷 시퀀스 준비 중.';
    default:
      return SETTINGS_PREVIEW_TEXT_FALLBACK;
  }
}

export const SETTINGS_PREVIEW_MEDIA_VARIANTS = PREVIEW_IMAGE_SAMPLES.length
  ? PREVIEW_IMAGE_SAMPLES
  : [{ type: 'image', url: '', label: 'sample' }];

export function resolveAssetUrl(path) {
  if (!path) return '';
  if (
    /^(?:[a-z]+:)?\/\//i.test(path) ||
    path.startsWith('data:') ||
    path.startsWith('blob:') ||
    path.startsWith('/')
  ) {
    return path;
  }

  const runtimeUrl = runtimeGetURL(path);
  return runtimeUrl || path;
}

export function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getPreviewTextBatch({
  platformId = 'default',
  themeId = 'entropy',
  count = 8,
} = {}) {
  const normalizedPlatformId = normalizePlatformId(platformId);
  const normalizedThemeId = normalizeThemeId(themeId, 'entropy');
  const safeCount = Number.isFinite(Number(count))
    ? Math.max(1, Math.min(12, Math.floor(Number(count))))
    : 8;

  let state = readCopyState();
  const selectedLines = [];
  const selectedIds = [];
  const baseNow = Date.now();

  for (let i = 0; i < safeCount; i += 1) {
    const nowTs = baseNow + i;
    const entry = pickPreviewEntry({
      platformId: normalizedPlatformId,
      themeId: normalizedThemeId,
      state,
      nowTs,
      excludedIds: selectedIds,
    });

    if (!entry) break;
    selectedLines.push(entry.text);
    selectedIds.push(entry.id);
    state = markSelection(state, entry, nowTs);
  }

  if (selectedLines.length === 0) {
    selectedLines.push(fallbackLine(normalizedPlatformId));
  }

  writeCopyState(state);
  return selectedLines;
}

export function getRandomPreviewText(platformId = 'default', themeId = 'entropy') {
  const batch = getPreviewTextBatch({ platformId, themeId, count: 1 });
  return batch[0] || fallbackLine(normalizePlatformId(platformId));
}
