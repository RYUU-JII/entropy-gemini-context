import { resolveAudioAssetUrl } from '../../../platform/audio/audioAssetResolver.js';
import { getSharedAudioContext, resumeAudioContextIfSuspended } from '../../../platform/audio/webAudioEngine.js';
import { resolveThemeSoundPack } from '../../../themes/core/sound/resolveThemeSoundPack.js';
import {
  assertSoundCueId,
  assertSoundSceneId,
} from '../catalog/soundCueIds.js';
import { SOUND_DESCRIPTOR_KINDS } from '../catalog/soundDescriptorKinds.js';
import { reportSoundRuntimeDiagnostic } from './soundDiagnostics.js';

function resolvePackDescriptor(pack, collectionName, id, context) {
  const resolverName = collectionName === 'cues' ? 'resolveCue' : 'resolveScene';
  if (typeof pack?.[resolverName] === 'function') {
    return pack[resolverName](id, context) || null;
  }
  return pack?.[collectionName]?.[id] || null;
}

function reportDescriptorFailure({
  code,
  cueId = '',
  sceneId = '',
  themeId,
  assetPath = '',
  src = '',
  reason = '',
  error = null,
  consoleRef,
} = {}) {
  return reportSoundRuntimeDiagnostic({
    code,
    cueId,
    sceneId,
    themeId,
    assetPath,
    src,
    reason,
    error,
    consoleRef,
  });
}

function isPauseInterruptedPlayError(error = null) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('interrupted by a call to pause');
}

export function createAppSoundRuntime({
  resolveSoundPack = resolveThemeSoundPack,
  runtimeGetURLFn = undefined,
  AudioCtor = globalThis.Audio,
  consoleRef = console,
} = {}) {
  const activeScenes = new Map();
  const intentionallyStoppedAudio = new WeakSet();

  function resolvePack(themeId) {
    if (!themeId) {
      throw new Error('sound_runtime_theme_id_missing');
    }
    return resolveSoundPack(themeId);
  }

  function playAssetDescriptor(descriptor, context = {}) {
    const assetPath = descriptor.assetPath || descriptor.path || '';
    if (!assetPath) {
      reportDescriptorFailure({
        code: 'sound_asset_path_missing',
        cueId: context.cueId,
        sceneId: context.sceneId,
        themeId: context.themeId,
        reason: descriptor.reason || 'asset_path_missing',
        consoleRef: context.consoleRef || consoleRef,
      });
      return null;
    }
    const ResolvedAudioCtor = context.AudioCtor || AudioCtor;
    if (typeof ResolvedAudioCtor !== 'function') {
      reportDescriptorFailure({
        code: 'sound_audio_element_unavailable',
        cueId: context.cueId,
        sceneId: context.sceneId,
        themeId: context.themeId,
        reason: 'Audio constructor unavailable',
        consoleRef: context.consoleRef || consoleRef,
      });
      return null;
    }

    try {
      const src = resolveAudioAssetUrl(assetPath, {
        runtimeGetURLFn: typeof context.runtimeGetURLFn === 'function'
          ? context.runtimeGetURLFn
          : runtimeGetURLFn,
      });
      const audio = new ResolvedAudioCtor(src);
      audio.volume = Math.max(0, Math.min(1, Number(descriptor.volume ?? context.volume ?? 1)));
      audio.loop = descriptor.loop === true || context.loop === true;
      const playResult = audio.play();
      if (playResult && typeof playResult.catch === 'function') {
        playResult.catch((error) => {
          if (context.shouldSuppressPlayRejection?.(audio, error) === true) return;
          context.onPlayRejected?.(audio, error);
          reportDescriptorFailure({
            code: 'sound_asset_play_failed',
            cueId: context.cueId,
            sceneId: context.sceneId,
            themeId: context.themeId,
            assetPath,
            src,
            error,
            consoleRef: context.consoleRef || consoleRef,
          });
        });
      }
      return audio;
    } catch (error) {
      reportDescriptorFailure({
        code: 'sound_asset_schedule_failed',
        cueId: context.cueId,
        sceneId: context.sceneId,
        themeId: context.themeId,
        assetPath,
        error,
        consoleRef: context.consoleRef || consoleRef,
      });
      return null;
    }
  }

  function playDescriptor(descriptor, context = {}) {
    if (!descriptor || typeof descriptor !== 'object') return false;
    if (descriptor.kind === SOUND_DESCRIPTOR_KINDS.SILENT) {
      reportDescriptorFailure({
        code: context.sceneId ? 'sound_scene_silent' : 'sound_cue_silent',
        cueId: context.cueId,
        sceneId: context.sceneId,
        themeId: context.themeId,
        reason: descriptor.reason || 'explicit_silent_descriptor',
        consoleRef: context.consoleRef || consoleRef,
      });
      return false;
    }
    if (descriptor.kind === SOUND_DESCRIPTOR_KINDS.SYNTH) {
      if (typeof descriptor.play !== 'function') {
        reportDescriptorFailure({
          code: 'sound_synth_descriptor_invalid',
          cueId: context.cueId,
          sceneId: context.sceneId,
          themeId: context.themeId,
          reason: 'missing play function',
          consoleRef: context.consoleRef || consoleRef,
        });
        return false;
      }
      try {
        return descriptor.play({
          ...context,
          consoleRef: context.consoleRef || consoleRef,
        }) === true;
      } catch (error) {
        reportDescriptorFailure({
          code: 'sound_synth_play_failed',
          cueId: context.cueId,
          sceneId: context.sceneId,
          themeId: context.themeId,
          error,
          consoleRef: context.consoleRef || consoleRef,
        });
        return false;
      }
    }
    if (descriptor.kind === SOUND_DESCRIPTOR_KINDS.ASSET) {
      return !!playAssetDescriptor(descriptor, context);
    }

    reportDescriptorFailure({
      code: 'sound_descriptor_kind_unknown',
      cueId: context.cueId,
      sceneId: context.sceneId,
      themeId: context.themeId,
      reason: descriptor.kind || 'missing kind',
      consoleRef: context.consoleRef || consoleRef,
    });
    return false;
  }

  function playCue(cueId, context = {}) {
    const resolvedCueId = assertSoundCueId(cueId, 'app sound cue runtime');
    try {
      const pack = resolvePack(context.themeId);
      const descriptor = resolvePackDescriptor(pack, 'cues', resolvedCueId, context);
      if (!descriptor) {
        reportDescriptorFailure({
          code: 'sound_cue_missing',
          cueId: resolvedCueId,
          themeId: context.themeId,
          consoleRef: context.consoleRef || consoleRef,
        });
        return false;
      }
      return playDescriptor(descriptor, {
        ...context,
        cueId: resolvedCueId,
      });
    } catch (error) {
      reportDescriptorFailure({
        code: 'sound_cue_resolve_failed',
        cueId: resolvedCueId,
        themeId: context.themeId,
        error,
        consoleRef: context.consoleRef || consoleRef,
      });
      return false;
    }
  }

  function enterScene(sceneId, context = {}) {
    const resolvedSceneId = assertSoundSceneId(sceneId, 'app sound scene runtime');
    if (activeScenes.has(resolvedSceneId)) return true;
    try {
      const pack = resolvePack(context.themeId);
      const descriptor = resolvePackDescriptor(pack, 'scenes', resolvedSceneId, context);
      if (!descriptor) {
        reportDescriptorFailure({
          code: 'sound_scene_missing',
          sceneId: resolvedSceneId,
          themeId: context.themeId,
          consoleRef: context.consoleRef || consoleRef,
        });
        return false;
      }

      if (descriptor.kind === SOUND_DESCRIPTOR_KINDS.ASSET) {
        const audio = playAssetDescriptor(
          { ...descriptor, loop: descriptor.loop !== false },
          {
            ...context,
            sceneId: resolvedSceneId,
            onPlayRejected: (rejectedAudio) => {
              const entry = activeScenes.get(resolvedSceneId);
              if (entry?.audio === rejectedAudio) {
                activeScenes.delete(resolvedSceneId);
              }
            },
            shouldSuppressPlayRejection: (rejectedAudio, error) => (
              intentionallyStoppedAudio.has(rejectedAudio)
              && isPauseInterruptedPlayError(error)
            ),
          },
        );
        if (!audio) return false;
        activeScenes.set(resolvedSceneId, { audio, descriptor });
        return true;
      }

      const stopRef = {};
      const played = playDescriptor(descriptor, {
        ...context,
        sceneId: resolvedSceneId,
        stopRef,
      });
      if (played) activeScenes.set(resolvedSceneId, { descriptor, stop: stopRef.stop });
      return played;
    } catch (error) {
      reportDescriptorFailure({
        code: 'sound_scene_resolve_failed',
        sceneId: resolvedSceneId,
        themeId: context.themeId,
        error,
        consoleRef: context.consoleRef || consoleRef,
      });
      return false;
    }
  }

  function exitScene(sceneId) {
    const resolvedSceneId = assertSoundSceneId(sceneId, 'app sound scene runtime');
    const entry = activeScenes.get(resolvedSceneId);
    if (!entry) return false;
    try {
      entry.stop?.();
      if (entry.audio) intentionallyStoppedAudio.add(entry.audio);
      entry.audio?.pause?.();
      if (entry.audio) entry.audio.currentTime = 0;
    } catch (error) {
      reportDescriptorFailure({
        code: 'sound_scene_stop_failed',
        sceneId: resolvedSceneId,
        error,
        consoleRef,
      });
    }
    activeScenes.delete(resolvedSceneId);
    return true;
  }

  function stopAll() {
    [...activeScenes.keys()].forEach((sceneId) => {
      exitScene(sceneId);
    });
  }

  function prepareAudio(context = {}) {
    const report = error => reportDescriptorFailure({
      code: 'sound_audio_prepare_failed', error, consoleRef: context.consoleRef || consoleRef,
    });
    const audio = getSharedAudioContext({
      audioContext: context.audioContext,
      AudioContextCtor: context.AudioContextCtor ?? globalThis.AudioContext ?? globalThis.webkitAudioContext,
      onError: report,
    });
    if (!audio) { report(new Error('AudioContext unavailable')); return false; }
    resumeAudioContextIfSuspended(audio, { onError: report });
    return true;
  }

  return {
    playCue,
    enterScene,
    exitScene,
    stopAll,
    prepareAudio,
  };
}

let sharedAppSoundRuntime = null;

export function getAppSoundRuntime() {
  if (!sharedAppSoundRuntime) {
    sharedAppSoundRuntime = createAppSoundRuntime();
  }
  return sharedAppSoundRuntime;
}

export function resetAppSoundRuntimeForTests() {
  sharedAppSoundRuntime = null;
}

export function playAppSoundCue(cueId, context = {}) {
  return getAppSoundRuntime().playCue(cueId, context);
}

export function enterAppSoundScene(sceneId, context = {}) {
  return getAppSoundRuntime().enterScene(sceneId, context);
}

export function exitAppSoundScene(sceneId) {
  return getAppSoundRuntime().exitScene(sceneId);
}
