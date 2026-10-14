import {
  SOUND_CUE_IDS,
  SOUND_MIX_BUS_IDS,
  SOUND_SCENE_IDS,
} from '../../../../domains/sound/catalog/soundCueIds.js';
import { SOUND_DESCRIPTOR_KINDS } from '../../../../domains/sound/catalog/soundDescriptorKinds.js';
import { playZenFurinGlassClinkSynth } from './zenFurinGlassClinkSynth.js';
import { playZenInstallationChime } from './zenInstallationChime.js';
import { playZenShishiOdoshiClackSynth } from './zenShishiOdoshiClackSynth.js';
import {
  playZenKoiWakeSurfaceSynth,
  playZenKoiGlideLoopSynth,
  playZenKoiRendezvousSynth,
  playZenKoiDescentDiveSynth,
  playZenWaterSettleCalmSynth,
} from './zenKoiHydroAcousticsSynth.js';
import {
  playZenRoom478InhaleSwellSynth,
  playZenRoom478HoldDroneSynth,
  playZenRoom478ExhaleReleaseSynth,
  playZenRoom478PhaseChimeSynth,
  playZenRoom478GroundingChargeSynth,
} from './zenRoom478BreathingSynth.js';
import {
  playZenShishiOdoshiWaterLoopSynth,
  playZenShishiOdoshiOverflowLoopSynth,
} from './zenShishiOdoshiWaterLoopSynth.js';
import {
  playZenSiteFurinSoundscapeSynth,
  playZenSiteFurinUnderwaterLoopSynth,
  playZenSiteFurinSubmergeInSynth,
  playZenSiteFurinSurfaceOutSynth,
  playZenSiteFurinSettleCompleteSynth,
} from './zenFurinSoundscapeSynth.js';
import {
  playZenGlobalSentinelSimulationRuptureSynth,
  playZenGlobalSentinelRepairTelegraphSynth,
  playZenGlobalSentinelInterventionHitSynth,
  playZenGlobalSentinelTerminalBreachSynth,
  playZenGlobalSentinelFailureSealSynth,
} from './zenGlobalSentinelRiftSynth.js';

function createSilentDescriptor(soundId, bus) {
  return Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SILENT,
    bus,
    reason: `release_audio_rights_unverified:${soundId}`,
  });
}

function createFurinSynthDescriptor(protocolScope = 'site') {
  return Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL,
    play: (context = {}) => playZenFurinGlassClinkSynth({
      ...context,
      protocolScope,
    }),
  });
}

function createShishiClackSynthDescriptor() {
  return Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.SFX,
    play: (context = {}) => playZenShishiOdoshiClackSynth(context),
  });
}

const ZEN_SOUND_CUES = Object.freeze({
  [SOUND_CUE_IDS.DASHBOARD_INSTALLATION_CHIME]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL,
    play: playZenInstallationChime,
  }),
  [SOUND_CUE_IDS.RITUAL_SITE_FURIN_PRELUDE_CHIME]: createFurinSynthDescriptor('site'),
  [SOUND_CUE_IDS.RITUAL_SITE_FURIN_SUBMERGE_IN]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL,
    play: (context = {}) => playZenSiteFurinSubmergeInSynth(context),
  }),
  [SOUND_CUE_IDS.RITUAL_SITE_FURIN_KOI_ACCEPT]: createFurinSynthDescriptor('site'),
  [SOUND_CUE_IDS.RITUAL_SITE_FURIN_SURFACE_OUT]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL,
    play: (context = {}) => playZenSiteFurinSurfaceOutSynth(context),
  }),
  [SOUND_CUE_IDS.RITUAL_SITE_FURIN_KOI_WAKE_SURFACE]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL,
    play: (context = {}) => playZenKoiWakeSurfaceSynth(context),
  }),
  [SOUND_CUE_IDS.RITUAL_SITE_FURIN_KOI_RENDEZVOUS]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL,
    play: (context = {}) => playZenKoiRendezvousSynth(context),
  }),
  [SOUND_CUE_IDS.RITUAL_SITE_FURIN_KOI_DESCENT_DIVE]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL,
    play: (context = {}) => playZenKoiDescentDiveSynth(context),
  }),
  [SOUND_CUE_IDS.RITUAL_SITE_FURIN_WATER_SETTLE_CALM]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL,
    play: (context = {}) => playZenWaterSettleCalmSynth(context),
  }),
  [SOUND_CUE_IDS.RITUAL_SITE_FURIN_SETTLE_COMPLETE]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL,
    play: (context = {}) => playZenSiteFurinSettleCompleteSynth(context),
  }),
  [SOUND_CUE_IDS.RITUAL_GLOBAL_SENTINEL_KOI_ACCEPT]: createFurinSynthDescriptor('global'),
  [SOUND_CUE_IDS.RITUAL_GLOBAL_SENTINEL_SIMULATION_RUPTURE]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL,
    play: (context = {}) => playZenGlobalSentinelSimulationRuptureSynth(context),
  }),
  [SOUND_CUE_IDS.RITUAL_GLOBAL_SENTINEL_INTERVENTION_HIT]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL,
    play: (context = {}) => playZenGlobalSentinelInterventionHitSynth(context),
  }),
  [SOUND_CUE_IDS.RITUAL_GLOBAL_SENTINEL_TERMINAL_BREACH]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL,
    play: (context = {}) => playZenGlobalSentinelTerminalBreachSynth(context),
  }),
  [SOUND_CUE_IDS.RITUAL_GLOBAL_SENTINEL_FAILURE_SEAL]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL,
    play: (context = {}) => playZenGlobalSentinelFailureSealSynth(context),
  }),
  [SOUND_CUE_IDS.ROOM478_BREATH_INHALE_SWELL]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.AMBIENT,
    play: (context = {}) => playZenRoom478InhaleSwellSynth(context),
  }),
  [SOUND_CUE_IDS.ROOM478_BREATH_EXHALE_RELEASE]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.AMBIENT,
    play: (context = {}) => playZenRoom478ExhaleReleaseSynth(context),
  }),
  [SOUND_CUE_IDS.ROOM478_BELL_PHASE_CHIME]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL,
    play: (context = {}) => playZenRoom478PhaseChimeSynth(context),
  }),
  [SOUND_CUE_IDS.ROOM478_GROUNDING_CHARGE]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL,
    play: (context = {}) => playZenRoom478GroundingChargeSynth(context),
  }),
  [SOUND_CUE_IDS.ZEN_SHISHI_ODOSHI_CLACK]: createShishiClackSynthDescriptor(),
});

const ZEN_SOUND_SCENES = Object.freeze({
  [SOUND_SCENE_IDS.RITUAL_SITE_FURIN_KOI_GLIDE_LOOP]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.SFX,
    play: (context = {}) => playZenKoiGlideLoopSynth(context),
  }),
  [SOUND_SCENE_IDS.RITUAL_GLOBAL_SENTINEL_REPAIR_TELEGRAPH]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.RITUAL,
    play: (context = {}) => playZenGlobalSentinelRepairTelegraphSynth(context),
  }),
  [SOUND_SCENE_IDS.ROOM478_BREATH_HOLD_DRONE]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.AMBIENT,
    play: (context = {}) => playZenRoom478HoldDroneSynth(context),
  }),
  [SOUND_SCENE_IDS.RITUAL_SITE_FURIN_SOUNDSCAPE]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.MUSIC,
    play: (context = {}) => playZenSiteFurinSoundscapeSynth(context),
  }),
  [SOUND_SCENE_IDS.RITUAL_SITE_FURIN_UNDERWATER_LOOP]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.AMBIENT,
    play: (context = {}) => playZenSiteFurinUnderwaterLoopSynth(context),
  }),
  [SOUND_SCENE_IDS.ZEN_SHISHI_ODOSHI_WATER_LOOP]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.AMBIENT,
    play: (context = {}) => playZenShishiOdoshiWaterLoopSynth(context),
  }),
  [SOUND_SCENE_IDS.ZEN_SHISHI_ODOSHI_OVERFLOW_LOOP]: Object.freeze({
    kind: SOUND_DESCRIPTOR_KINDS.SYNTH,
    bus: SOUND_MIX_BUS_IDS.SFX,
    play: (context = {}) => playZenShishiOdoshiOverflowLoopSynth(context),
  }),
});

export const zenSoundPack = Object.freeze({
  id: 'zen',
  cues: ZEN_SOUND_CUES,
  scenes: ZEN_SOUND_SCENES,
  resolveCue(cueId) {
    return ZEN_SOUND_CUES[cueId] || null;
  },
});
