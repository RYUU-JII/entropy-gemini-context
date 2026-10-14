import { SOUND_CUE_IDS, SOUND_MIX_BUS_IDS } from '../../../../domains/sound/catalog/soundCueIds.js';
import { SOUND_DESCRIPTOR_KINDS } from '../../../../domains/sound/catalog/soundDescriptorKinds.js';
import { playInstallationChimeSynth } from '../../../../platform/audio/synth/installationChimeSynth.js';

const RECIPE = Object.freeze({ volume: .1, partials: Object.freeze([
  { at: 0, frequency: 392, duration: .45, gain: .19, attack: .012, type: 'triangle' },
  { at: .19, frequency: 588, duration: 1.1, gain: .12, attack: .016 },
  { at: .2, frequency: 1176, duration: .55, gain: .045, attack: .02 },
]) });
export const scpSoundPack = Object.freeze({ id: 'scp', scenes: Object.freeze({}), cues: Object.freeze({
  [SOUND_CUE_IDS.DASHBOARD_INSTALLATION_CHIME]: Object.freeze({ kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL, play: context => playInstallationChimeSynth(RECIPE, context) }),
}) });
