import { THEME_IDS, assertCanonicalThemeId } from '../ids.js';
import { zenSoundPack } from '../../plugins/zen/sound/zenSoundPack.js';
import { matrixSoundPack } from '../../plugins/matrix/sound/matrixSoundPack.js';
import { entropySoundPack } from '../../plugins/entropy/sound/entropySoundPack.js';
import { cyberpunkSoundPack } from '../../plugins/cyberpunk/sound/cyberpunkSoundPack.js';
import { clinicalSoundPack } from '../../plugins/clinical/sound/clinicalSoundPack.js';
import { scpSoundPack } from '../../plugins/scp/sound/scpSoundPack.js';

const THEME_SOUND_PACKS = Object.freeze({
  [THEME_IDS.ZEN]: zenSoundPack,
  [THEME_IDS.MATRIX]: matrixSoundPack,
  [THEME_IDS.ENTROPY]: entropySoundPack,
  [THEME_IDS.CYBERPUNK]: cyberpunkSoundPack,
  [THEME_IDS.CLINICAL]: clinicalSoundPack,
  [THEME_IDS.SCP]: scpSoundPack,
});

export function resolveThemeSoundPack(themeId) {
  const resolvedThemeId = assertCanonicalThemeId(themeId, 'theme sound pack lookup');
  const soundPack = THEME_SOUND_PACKS[resolvedThemeId] || null;
  if (!soundPack) {
    throw new Error(`theme_sound_pack_missing:${resolvedThemeId}`);
  }
  return soundPack;
}

export function hasThemeSoundPack(themeId) {
  try {
    const resolvedThemeId = assertCanonicalThemeId(themeId, 'theme sound pack availability');
    return !!THEME_SOUND_PACKS[resolvedThemeId];
  } catch (_) {
    return false;
  }
}
