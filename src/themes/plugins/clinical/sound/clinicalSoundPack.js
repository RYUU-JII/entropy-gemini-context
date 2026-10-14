import { SOUND_CUE_IDS, SOUND_MIX_BUS_IDS } from '../../../../domains/sound/catalog/soundCueIds.js';
import { SOUND_DESCRIPTOR_KINDS } from '../../../../domains/sound/catalog/soundDescriptorKinds.js';
import { playInstallationChimeSynth } from '../../../../platform/audio/synth/installationChimeSynth.js';

const RECIPE = Object.freeze({ volume: .1, partials: Object.freeze([
  { at: 0, frequency: 1046.5, duration: .7, gain: .22, attack: .016 },
  { at: .18, frequency: 1318.5, duration: .95, gain: .12, attack: .02 },
]) });
export const clinicalSoundPack = Object.freeze({ id: 'clinical', scenes: Object.freeze({}), cues: Object.freeze({
  [SOUND_CUE_IDS.DASHBOARD_INSTALLATION_CHIME]: Object.freeze({ kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL, play: context => playInstallationChimeSynth(RECIPE, context) }),
}) });
