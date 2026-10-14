import { SOUND_CUE_IDS, SOUND_MIX_BUS_IDS } from '../../../../domains/sound/catalog/soundCueIds.js';
import { SOUND_DESCRIPTOR_KINDS } from '../../../../domains/sound/catalog/soundDescriptorKinds.js';
import { playInstallationChimeSynth } from '../../../../platform/audio/synth/installationChimeSynth.js';

const RECIPE = Object.freeze({ volume: .15, partials: Object.freeze([
  { at: 0, frequency: 185, duration: .25, gain: .25, attack: .004 },
  { at: .012, frequency: 558, duration: .9, gain: .15, attack: .002 },
  { at: .005, frequency: 930, duration: .5, gain: .08, attack: .002 },
]) });
export const entropySoundPack = Object.freeze({ id: 'entropy', scenes: Object.freeze({}), cues: Object.freeze({
  [SOUND_CUE_IDS.DASHBOARD_INSTALLATION_CHIME]: Object.freeze({ kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL, play: context => playInstallationChimeSynth(RECIPE, context) }),
}) });
