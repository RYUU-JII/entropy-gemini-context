export const SOUND_MIX_BUS_IDS = Object.freeze({
  SFX: 'sfx',
  RITUAL: 'ritual',
  AMBIENT: 'ambient',
  MUSIC: 'music',
});

export const SOUND_CUE_IDS = Object.freeze({
  DASHBOARD_INSTALLATION_CHIME: 'dashboard.installation.chime',
  RITUAL_SITE_FURIN_PRELUDE_CHIME: 'ritual.site_furin.prelude_chime',
  RITUAL_SITE_FURIN_SUBMERGE_IN: 'ritual.site_furin.submerge_in',
  RITUAL_SITE_FURIN_KOI_ACCEPT: 'ritual.site_furin.koi_accept',
  RITUAL_SITE_FURIN_SURFACE_OUT: 'ritual.site_furin.surface_out',
  RITUAL_SITE_FURIN_KOI_WAKE_SURFACE: 'ritual.site_furin.koi_wake_surface',
  RITUAL_SITE_FURIN_KOI_RENDEZVOUS: 'ritual.site_furin.koi_rendezvous',
  RITUAL_SITE_FURIN_KOI_DESCENT_DIVE: 'ritual.site_furin.koi_descent_dive',
  RITUAL_SITE_FURIN_WATER_SETTLE_CALM: 'ritual.site_furin.water_settle_calm',
  RITUAL_SITE_FURIN_SETTLE_COMPLETE: 'ritual.site_furin.settle_complete',
  RITUAL_GLOBAL_SENTINEL_KOI_ACCEPT: 'ritual.global_sentinel.koi_accept',
  RITUAL_GLOBAL_SENTINEL_SIMULATION_RUPTURE: 'ritual.global_sentinel.simulation_rupture',
  RITUAL_GLOBAL_SENTINEL_INTERVENTION_HIT: 'ritual.global_sentinel.intervention_hit',
  RITUAL_GLOBAL_SENTINEL_TERMINAL_BREACH: 'ritual.global_sentinel.terminal_breach',
  RITUAL_GLOBAL_SENTINEL_FAILURE_SEAL: 'ritual.global_sentinel.failure_seal',
  ROOM478_BREATH_INHALE_SWELL: 'room478.breath.inhale_swell',
  ROOM478_BREATH_EXHALE_RELEASE: 'room478.breath.exhale_release',
  ROOM478_BELL_PHASE_CHIME: 'room478.bell.phase_chime',
  ROOM478_GROUNDING_CHARGE: 'room478.grounding.charge',
  ZEN_SHISHI_ODOSHI_CLACK: 'zen.shishi_odoshi.clack',
});

export const SOUND_SCENE_IDS = Object.freeze({
  RITUAL_SITE_FURIN_KOI_GLIDE_LOOP: 'ritual.site_furin.koi_glide_loop',
  RITUAL_SITE_FURIN_SOUNDSCAPE: 'ritual.site_furin.soundscape',
  RITUAL_SITE_FURIN_UNDERWATER_LOOP: 'ritual.site_furin.underwater_loop',
  RITUAL_GLOBAL_SENTINEL_REPAIR_TELEGRAPH: 'ritual.global_sentinel.repair_telegraph',
  ROOM478_BREATH_HOLD_DRONE: 'room478.breath.hold_drone',
  ZEN_SHISHI_ODOSHI_WATER_LOOP: 'zen.shishi_odoshi.water_loop',
  ZEN_SHISHI_ODOSHI_OVERFLOW_LOOP: 'zen.shishi_odoshi.overflow_loop',
});

const SOUND_CUE_ID_SET = new Set(Object.values(SOUND_CUE_IDS));
const SOUND_SCENE_ID_SET = new Set(Object.values(SOUND_SCENE_IDS));

export function assertSoundCueId(cueId, context = 'sound cue runtime') {
  if (typeof cueId === 'string' && SOUND_CUE_ID_SET.has(cueId)) {
    return cueId;
  }
  throw new Error(`${context} requires a declared sound cue id: ${String(cueId)}`);
}

export function assertSoundSceneId(sceneId, context = 'sound scene runtime') {
  if (typeof sceneId === 'string' && SOUND_SCENE_ID_SET.has(sceneId)) {
    return sceneId;
  }
  throw new Error(`${context} requires a declared sound scene id: ${String(sceneId)}`);
}

export function getDeclaredSoundCueIds() {
  return [...SOUND_CUE_ID_SET];
}

export function getDeclaredSoundSceneIds() {
  return [...SOUND_SCENE_ID_SET];
}
