import { getSharedAudioContext, resumeAudioContextIfSuspended } from '../webAudioEngine.js';
import { scheduleModalPartial } from './modalPrimitives.js';

/** Finite, cancellable voice scheduling. Theme packs own the acoustic recipe. */
export function playInstallationChimeSynth(recipe, context = {}) {
  if (!Array.isArray(recipe?.partials) || recipe.partials.length === 0) {
    throw new Error('installation_chime_recipe_invalid');
  }
  const report = (phase, error) => context.consoleRef?.warn?.('[installation sound]', {
    code: `installation_chime_${phase}_failed`, themeId: context.themeId,
    error: String(error?.message ?? error),
  });
  const audio = getSharedAudioContext({
    audioContext: context.audioContext,
    AudioContextCtor: context.AudioContextCtor ?? globalThis.AudioContext ?? globalThis.webkitAudioContext,
    onError: error => report('context_create', error),
  });
  if (!audio) { report('context_unavailable', 'AudioContext unavailable'); return false; }
  resumeAudioContextIfSuspended(audio, { onError: error => report('resume', error) });
  const voices = new Set();
  let master = null;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (master) {
      master.gain.cancelScheduledValues(audio.currentTime);
      master.gain.setTargetAtTime(0, audio.currentTime, .009);
    }
    for (const voice of voices) voice.stop(audio.currentTime + .04);
  };
  if (context.stopRef) { context.stopRef.stop = stop; context.stopRef.ended = false; }
  try {
    master = audio.createGain();
    master.gain.setValueAtTime(recipe.volume, audio.currentTime);
    master.connect(audio.destination);
    const now = audio.currentTime + .003;
    for (const { at, ...partial } of recipe.partials) {
      const { osc, gainNode } = scheduleModalPartial(audio, master, { ...partial, startAt: now + at });
      voices.add(osc);
      osc.onended = () => {
        voices.delete(osc);
        osc.disconnect(); gainNode.disconnect();
        if (voices.size === 0) { master.disconnect(); if (context.stopRef) context.stopRef.ended = true; }
      };
    }
    return true;
  } catch (error) {
    stop(); report('schedule', error); return false;
  }
}
