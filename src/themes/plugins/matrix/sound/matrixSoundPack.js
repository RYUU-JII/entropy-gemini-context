import { SOUND_CUE_IDS, SOUND_MIX_BUS_IDS } from '../../../../domains/sound/catalog/soundCueIds.js';
import { SOUND_DESCRIPTOR_KINDS } from '../../../../domains/sound/catalog/soundDescriptorKinds.js';
import { playInstallationChimeSynth } from '../../../../platform/audio/synth/installationChimeSynth.js';

const RECIPE = Object.freeze({ volume: .12, partials: Object.freeze([
  { at: 0, frequency: 740, duration: .24, gain: .23, attack: .012, type: 'triangle' },
  { at: .13, frequency: 1110, duration: .5, gain: .21, attack: .008 },
  { at: .26, frequency: 1480, duration: .85, gain: .1, attack: .012 },
]) });
export const matrixSoundPack = Object.freeze({ id: 'matrix', scenes: Object.freeze({}), cues: Object.freeze({
  [SOUND_CUE_IDS.DASHBOARD_INSTALLATION_CHIME]: Object.freeze({ kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL, play: context => playInstallationChimeSynth(RECIPE, context) }),
}) });
