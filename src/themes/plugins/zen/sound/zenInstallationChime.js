import { playInstallationChimeSynth } from '../../../../platform/audio/synth/installationChimeSynth.js';

// A single small glass contact: no rupture soundtrack or real Furin dispatch.
const RECIPE = Object.freeze({ volume: .16, partials: Object.freeze([
  { at: 0, frequency: 3136, duration: 1.8, gain: .48, attack: .002 },
  { at: .006, frequency: 4948, duration: .55, gain: .18, attack: .001 },
  { at: .014, frequency: 3139, duration: 1.5, gain: .28, attack: .005 },
  { at: 0, frequency: 8248, duration: .055, gain: .055, attack: .001 },
]) });
export const playZenInstallationChime = context => playInstallationChimeSynth(RECIPE, context);
