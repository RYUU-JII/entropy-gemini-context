import { SOUND_CUE_IDS, SOUND_MIX_BUS_IDS } from '../../../../domains/sound/catalog/soundCueIds.js';
import { SOUND_DESCRIPTOR_KINDS } from '../../../../domains/sound/catalog/soundDescriptorKinds.js';
import { playInstallationChimeSynth } from '../../../../platform/audio/synth/installationChimeSynth.js';

const RECIPE = Object.freeze({ volume: .11, partials: Object.freeze([
  { at: 0, frequency: 622.25, duration: .9, gain: .2, attack: .04 },
  { at: .12, frequency: 932.33, duration: 1.3, gain: .13, attack: .045 },
  { at: .24, frequency: 1244.5, duration: 1.4, gain: .07, attack: .06 },
]) });
export const cyberpunkSoundPack = Object.freeze({ id: 'cyberpunk', scenes: Object.freeze({}), cues: Object.freeze({
  [SOUND_CUE_IDS.DASHBOARD_INSTALLATION_CHIME]: Object.freeze({ kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL, play: context => playInstallationChimeSynth(RECIPE, context) }),
}) });
