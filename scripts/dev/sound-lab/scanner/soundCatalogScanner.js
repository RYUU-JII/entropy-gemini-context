/**
 * Scans the active sound runtime catalog, theme sound packs, and declarative target specs.
 */

import {
  SOUND_CUE_IDS,
  SOUND_SCENE_IDS,
} from '../../../../src/domains/sound/catalog/soundCueIds.js';
import { SOUND_DESCRIPTOR_KINDS } from '../../../../src/domains/sound/catalog/soundDescriptorKinds.js';
import { getCanonicalThemeIds } from '../../../../src/themes/core/ids.js';
import { resolveThemeSoundPack } from '../../../../src/themes/core/sound/resolveThemeSoundPack.js';
import {
  SOUND_TARGET_SPECS,
  SOUND_TARGET_STATUS,
} from '../specs/soundTargets.js';

const KNOWN_THEME_PACKS = Object.fromEntries(getCanonicalThemeIds().map(id => [id, resolveThemeSoundPack(id)]));

/**
 * Resolves the live descriptor status for a given sound ID within a theme.
 * @param {string} theme
 * @param {string} id
 * @param {'cue'|'scene'} kind
 */
export function resolveLiveSoundStatus(theme, id, kind) {
  const pack = KNOWN_THEME_PACKS[theme];
  if (!pack) {
    return {
      status: SOUND_TARGET_STATUS.PLANNED,
      descriptor: null,
      reason: 'theme_sound_pack_unregistered',
    };
  }

  const descriptor = kind === 'cue'
    ? pack.resolveCue?.(id) || pack.cues?.[id] || null
    : pack.scenes?.[id] || null;

  if (!descriptor) {
    return {
      status: SOUND_TARGET_STATUS.PLANNED,
      descriptor: null,
      reason: 'unmapped_in_sound_pack',
    };
  }

  if (descriptor.kind === SOUND_DESCRIPTOR_KINDS.SYNTH) {
    return {
      status: SOUND_TARGET_STATUS.SYNTH,
      descriptor,
      hasPlayFunction: typeof descriptor.play === 'function',
    };
  }

  if (descriptor.kind === SOUND_DESCRIPTOR_KINDS.ASSET) {
    return {
      status: SOUND_TARGET_STATUS.ASSET,
      descriptor,
      assetPath: descriptor.assetPath || descriptor.path || '',
    };
  }

  if (descriptor.kind === SOUND_DESCRIPTOR_KINDS.SILENT) {
    return {
      status: SOUND_TARGET_STATUS.SILENT,
      descriptor,
      reason: descriptor.reason || 'silent_withheld',
    };
  }

  return {
    status: SOUND_TARGET_STATUS.PLANNED,
    descriptor,
  };
}

/**
 * Performs a comprehensive scan across all sound targets.
 */
export function scanSoundCatalog() {
  const scannedItems = [];
  const themeMetrics = {};

  for (const spec of SOUND_TARGET_SPECS) {
    const live = resolveLiveSoundStatus(spec.theme, spec.id, spec.kind);
    const scanned = {
      ...spec,
      liveStatus: live.status,
      liveDetails: live,
      isImplemented: live.status === SOUND_TARGET_STATUS.SYNTH || live.status === SOUND_TARGET_STATUS.ASSET,
    };
    scannedItems.push(scanned);

    if (!themeMetrics[spec.theme]) {
      themeMetrics[spec.theme] = {
        total: 0,
        synthCount: 0,
        assetCount: 0,
        silentCount: 0,
        plannedCount: 0,
        implementedCount: 0,
      };
    }

    const tm = themeMetrics[spec.theme];
    tm.total += 1;
    if (live.status === SOUND_TARGET_STATUS.SYNTH) tm.synthCount += 1;
    else if (live.status === SOUND_TARGET_STATUS.ASSET) tm.assetCount += 1;
    else if (live.status === SOUND_TARGET_STATUS.SILENT) tm.silentCount += 1;
    else if (live.status === SOUND_TARGET_STATUS.PLANNED) tm.plannedCount += 1;

    if (scanned.isImplemented) tm.implementedCount += 1;
  }

  // Calculate percentages
  let totalTargets = scannedItems.length;
  let totalImplemented = 0;
  let totalSynth = 0;
  let totalAsset = 0;
  let totalSilent = 0;
  let totalPlanned = 0;

  for (const [theme, m] of Object.entries(themeMetrics)) {
    m.completionRate = m.total > 0 ? (m.implementedCount / m.total) * 100 : 0;
    totalImplemented += m.implementedCount;
    totalSynth += m.synthCount;
    totalAsset += m.assetCount;
    totalSilent += m.silentCount;
    totalPlanned += m.plannedCount;
  }

  const overallCompletionRate = totalTargets > 0 ? (totalImplemented / totalTargets) * 100 : 0;

  return {
    timestamp: new Date().toISOString(),
    items: scannedItems,
    themeMetrics,
    summary: {
      totalTargets,
      totalImplemented,
      totalSynth,
      totalAsset,
      totalSilent,
      totalPlanned,
      overallCompletionRate: Number(overallCompletionRate.toFixed(1)),
    },
    declaredRuntimeCues: Object.values(SOUND_CUE_IDS),
    declaredRuntimeScenes: Object.values(SOUND_SCENE_IDS),
  };
}
