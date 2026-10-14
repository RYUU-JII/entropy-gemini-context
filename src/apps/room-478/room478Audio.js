import {
  SOUND_CUE_IDS,
  playAppSoundCue,
} from '../../domains/sound/index.js';
import { THEME_IDS } from '../../themes/core/ids.js';
import { playZenRoom478HoldDroneSynth } from '../../themes/plugins/zen/sound/zenRoom478BreathingSynth.js';

export function createRoom478AudioController({
  themeId = THEME_IDS.ZEN,
  playCue = playAppSoundCue,
  playDrone = playZenRoom478HoldDroneSynth,
  consoleRef = console,
  audioContext = null,
} = {}) {
  let activeChargeStop = null;
  let isMuted = false;

  function startGroundingCharge() {
    if (isMuted) return false;
    stopGroundingCharge();
    const stopRef = {};
    const played = playCue(SOUND_CUE_IDS.ROOM478_GROUNDING_CHARGE, {
      themeId,
      intensity: 0.85,
      basePitch: 108,
      duration: 1.8,
      stopRef,
      audioContext,
      consoleRef,
    });
    if (played) {
      activeChargeStop = stopRef.stop || null;
    }
    return played;
  }

  function stopGroundingCharge() {
    if (activeChargeStop) {
      try {
        activeChargeStop(0.18);
      } catch {
        // Safe no-op if already stopped
      }
      activeChargeStop = null;
    }
  }

  function playOpeningGong() {
    if (isMuted) return false;
    stopGroundingCharge();
    return playCue(SOUND_CUE_IDS.ROOM478_BELL_PHASE_CHIME, {
      themeId,
      intensity: 0.85,
      basePitch: 108,
      audioContext,
      consoleRef,
    });
  }

  function playClosingGong() {
    if (isMuted) return false;
    return playCue(SOUND_CUE_IDS.ROOM478_BELL_PHASE_CHIME, {
      themeId,
      intensity: 0.55,
      basePitch: 108,
      audioContext,
      consoleRef,
    });
  }

  function playDepartureSeal() {
    if (isMuted) return false;
    stopGroundingCharge();
    return playCue(SOUND_CUE_IDS.ROOM478_BELL_PHASE_CHIME, {
      themeId,
      intensity: 0.45,
      basePitch: 81,
      audioContext,
      consoleRef,
    });
  }

  function playInhaleSwell() {
    if (isMuted) return false;
    return playCue(SOUND_CUE_IDS.ROOM478_BREATH_INHALE_SWELL, {
      themeId,
      intensity: 0.80,
      basePitch: 108,
      audioContext,
      consoleRef,
    });
  }

  function playHoldDrone() {
    if (isMuted) return false;
    return playDrone({
      themeId,
      intensity: 0.75,
      basePitch: 216,
      duration: 7.0,
      audioContext,
      consoleRef,
    });
  }

  function playExhaleRelease() {
    if (isMuted) return false;
    return playCue(SOUND_CUE_IDS.ROOM478_BREATH_EXHALE_RELEASE, {
      themeId,
      intensity: 0.80,
      basePitch: 108,
      audioContext,
      consoleRef,
    });
  }

  function stopAll() {
    stopGroundingCharge();
  }

  function setMuted(muted) {
    isMuted = Boolean(muted);
    if (isMuted) stopAll();
  }

  return Object.freeze({
    playClosingGong,
    playDepartureSeal,
    playExhaleRelease,
    playHoldDrone,
    playInhaleSwell,
    playOpeningGong,
    setMuted,
    startGroundingCharge,
    stopAll,
    stopGroundingCharge,
  });
}
