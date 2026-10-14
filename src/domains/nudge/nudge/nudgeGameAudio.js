import {
  SOUND_CUE_IDS,
  SOUND_SCENE_IDS,
  enterAppSoundScene,
  exitAppSoundScene,
  playAppSoundCue,
} from '../../sound/index.js';
import { THEME_IDS } from '../../../themes/core/ids.js';
import {
  GLOBAL_SENTINEL_RHYTHM_PHASES,
  GLOBAL_SENTINEL_ENTRY_STAGES,
  GLOBAL_SENTINEL_ENTRY_FAULT_CUES,
} from './nudgeGameGlobalSentinelProtocol.js';

const reportedAudioFailureCodes = new Set();

function reportSentinelAudioFailure(phase, error, consoleRef = console) {
  const normalizedPhase = typeof phase === 'string' && phase.trim()
    ? phase.trim()
    : 'unknown';
  const diagnostic = {
    code: `sentinel_flare_audio_${normalizedPhase}_failed`,
    error: String(error?.message || error || 'audio_failed'),
  };
  if (
    !reportedAudioFailureCodes.has(diagnostic.code)
    && consoleRef
    && typeof consoleRef.warn === 'function'
  ) {
    reportedAudioFailureCodes.add(diagnostic.code);
    consoleRef.warn('[sentinel flare] audio cue failed', diagnostic);
  }
  return diagnostic;
}

function resolveSentinelFurinAcceptCueId(protocolScope = 'site') {
  return protocolScope === 'global'
    ? SOUND_CUE_IDS.RITUAL_GLOBAL_SENTINEL_KOI_ACCEPT
    : SOUND_CUE_IDS.RITUAL_SITE_FURIN_KOI_ACCEPT;
}

function playSentinelCue(cueId, {
  protocolScope = 'site',
  intensity = 0.62,
  themeId = THEME_IDS.ZEN,
  audioContext = null,
  AudioContextCtor = null,
  consoleRef = console,
} = {}) {
  return playAppSoundCue(cueId, {
    themeId,
    protocolScope,
    intensity,
    audioContext,
    AudioContextCtor,
    consoleRef,
    diagnosticReporter: reportSentinelAudioFailure,
  });
}

export function playSentinelFurinPreludeChime(options = {}) {
  return playSentinelCue(SOUND_CUE_IDS.RITUAL_SITE_FURIN_PRELUDE_CHIME, {
    ...options,
    protocolScope: 'site',
  });
}

export function playSentinelFurinSubmergeIn(options = {}) {
  return playSentinelCue(SOUND_CUE_IDS.RITUAL_SITE_FURIN_SUBMERGE_IN, {
    ...options,
    protocolScope: 'site',
  });
}

export function playSentinelFurinKoiAccept(options = {}) {
  const protocolScope = options?.protocolScope || 'site';
  return playSentinelCue(resolveSentinelFurinAcceptCueId(protocolScope), {
    ...options,
    protocolScope,
  });
}

export function playSentinelFurinSurfaceOut(options = {}) {
  return playSentinelCue(SOUND_CUE_IDS.RITUAL_SITE_FURIN_SURFACE_OUT, {
    ...options,
    protocolScope: 'site',
  });
}

export function playSentinelFurinSettleComplete(options = {}) {
  return playSentinelCue(SOUND_CUE_IDS.RITUAL_SITE_FURIN_SETTLE_COMPLETE, {
    ...options,
    protocolScope: 'site',
  });
}

export function enterSentinelFurinSiteSoundscape({
  themeId = THEME_IDS.ZEN,
  protocolScope = 'site',
  consoleRef = console,
} = {}) {
  if (protocolScope === 'global') return false;
  const context = { themeId, protocolScope: 'site', consoleRef };
  const soundscape = enterAppSoundScene(SOUND_SCENE_IDS.RITUAL_SITE_FURIN_SOUNDSCAPE, context);
  const underwater = enterAppSoundScene(SOUND_SCENE_IDS.RITUAL_SITE_FURIN_UNDERWATER_LOOP, context);
  return soundscape || underwater;
}

export function exitSentinelFurinSiteSoundscape() {
  const soundscape = exitAppSoundScene(SOUND_SCENE_IDS.RITUAL_SITE_FURIN_SOUNDSCAPE);
  const underwater = exitAppSoundScene(SOUND_SCENE_IDS.RITUAL_SITE_FURIN_UNDERWATER_LOOP);
  return soundscape || underwater;
}

export function playSentinelFurinChime(options = {}) {
  return playSentinelFurinKoiAccept(options);
}

// Host-owned lifecycle; the session's rhythm snapshot is the only beat clock.
export function createGlobalSentinelAudioController({
  playCue = playAppSoundCue,
  enterScene = enterAppSoundScene,
  exitScene = exitAppSoundScene,
} = {}) {
  const sceneId = SOUND_SCENE_IDS.RITUAL_GLOBAL_SENTINEL_REPAIR_TELEGRAPH;
  let lastBeat = -1;
  let sceneOpen = false;
  let terminal = null;
  let acceptedInterventions = 0;
  const ownedCues = new Set();
  function stopCues() {
    for (const stopRef of ownedCues) stopRef.stop?.();
    ownedCues.clear();
  }
  function playOwnedCue(cueId, context) {
    for (const stopRef of ownedCues) {
      if (stopRef.ended) ownedCues.delete(stopRef);
    }
    const stopRef = {};
    const played = playCue(cueId, {
      ...context,
      protocolScope: 'global',
      diagnosticReporter: reportSentinelAudioFailure,
      stopRef,
    });
    if (played === true) ownedCues.add(stopRef);
    return played;
  }
  function stopTelegraph() {
    if (sceneOpen) exitScene(sceneId);
    sceneOpen = false;
  }
  function accepted({ started = false, ...context } = {}) {
    stopTelegraph();
    if (started) {
      stopCues();
      terminal = null;
      acceptedInterventions = 0;
    } else {
      acceptedInterventions += 1;
    }
    return playOwnedCue(started
      ? SOUND_CUE_IDS.RITUAL_GLOBAL_SENTINEL_SIMULATION_RUPTURE
      : SOUND_CUE_IDS.RITUAL_GLOBAL_SENTINEL_INTERVENTION_HIT,
    {
      ...context,
      ...(started ? { entryStages: GLOBAL_SENTINEL_ENTRY_STAGES, entryFaultCues: GLOBAL_SENTINEL_ENTRY_FAULT_CUES } : { act: acceptedInterventions }),
    });
  }
  function finish(outcome, context) {
    stopTelegraph();
    if (terminal === outcome) return;
    terminal = outcome;
    stopCues();
    playOwnedCue(outcome === 'success'
      ? SOUND_CUE_IDS.RITUAL_GLOBAL_SENTINEL_TERMINAL_BREACH
      : SOUND_CUE_IDS.RITUAL_GLOBAL_SENTINEL_FAILURE_SEAL,
    context);
  }
  function sync(progress, config, context) {
    if (terminal || progress.awaitingStart || progress.completed || progress.failed) {
      stopTelegraph();
      return;
    }
    if (progress.evaluatedThroughBeatIndex >= progress.rhythmBeatIndex) { stopTelegraph(); return; }
    const approach = progress.rhythmPhase === GLOBAL_SENTINEL_RHYTHM_PHASES.APPROACH;
    const lock = progress.rhythmPhase === GLOBAL_SENTINEL_RHYTHM_PHASES.LOCK;
    if (!approach && !lock) { stopTelegraph(); return; }
    // Let the first glass impact decay before the first short locking cue.
    if (progress.rhythmBeatIndex === 0 && approach) return;
    if (progress.rhythmBeatIndex === lastBeat) return;
    stopTelegraph();
    lastBeat = progress.rhythmBeatIndex;
    sceneOpen = enterScene(sceneId, {
      ...context, protocolScope: 'global', duration: Math.max(0.04, progress.rhythmPhaseRemainingMs / 1000),
      act: progress.rhythmActIndex + 1,
      identityRecall: progress.rhythmActIndex === 2 && progress.rhythmAttemptIndex === 0 && approach,
      diagnosticReporter: reportSentinelAudioFailure,
    }) === true;
  }
  function reset() {
    stopTelegraph();
    stopCues();
    lastBeat = -1;
    terminal = null;
    acceptedInterventions = 0;
  }
  return { accepted, finish, sync, reset };
}
