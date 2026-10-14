import {
  getSharedAudioContext,
  resumeAudioContextIfSuspended,
} from '../../../../platform/audio/webAudioEngine.js';
import { scheduleModalPartial } from '../../../../platform/audio/synth/modalPrimitives.js';
import { scheduleNoiseBurst } from '../../../../platform/audio/synth/noisePrimitives.js';

function reportAudioFailure(phase, error, {
  diagnosticReporter = null,
  consoleRef = console,
} = {}) {
  if (typeof diagnosticReporter === 'function') return diagnosticReporter(phase, error, consoleRef);
  const diagnostic = {
    code: `zen_global_sentinel_${phase || 'unknown'}_failed`,
    error: String(error?.message || error || 'audio_failed'),
  };
  consoleRef?.warn?.('[zen sound] global sentinel failed', diagnostic);
  return diagnostic;
}

// Every voice, including future WebAudio starts, belongs to this finite cue.
// No wall-clock timers survive a host reset and no AudioContext is shut down.
function playFiniteCue(options, schedule) {
  const { audioContext = null, AudioContextCtor = null, stopRef = null } = options;
  const ctx = getSharedAudioContext({
    audioContext,
    AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
    onError: (error) => reportAudioFailure('context_create', error, options),
  });
  if (!ctx) return false;
  resumeAudioContextIfSuspended(ctx, {
    onError: (error) => reportAudioFailure('resume', error, options),
  });
  let master;
  const voices = new Set();
  let stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    if (master) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.009);
    }
    for (const voice of voices) voice.stop(ctx.currentTime + 0.04);
  }
  if (stopRef) {
    stopRef.stop = stop;
    stopRef.ended = false;
  }
  try {
    const now = ctx.currentTime + 0.003;
    const intensity = Math.max(0.2, Math.min(1, Number(options.intensity) || 0.75));
    master = ctx.createGain();
    master.gain.setValueAtTime(0.28 * intensity, ctx.currentTime);
    master.connect(ctx.destination);
    function track(source, nodes) {
      voices.add(source);
      source.onended = () => {
        voices.delete(source);
        for (const node of nodes) node.disconnect();
        if (voices.size === 0) {
          master.disconnect();
          if (stopRef) stopRef.ended = true;
        }
      };
    }
    function partial({ at = 0, ...params }) {
      const { osc, gainNode } = scheduleModalPartial(ctx, master, { ...params, startAt: now + at });
      track(osc, [osc, gainNode]);
    }
    function noise({ at = 0, ...params }) {
      const { source, filter, gainNode } = scheduleNoiseBurst(ctx, master, { ...params, startAt: now + at });
      track(source, [source, filter, gainNode]);
    }
    function glide({ at = 0, duration, frequency, endFrequency, gain, attack = 0.1, type = 'sine' }) {
      const osc = ctx.createOscillator();
      const envelope = ctx.createGain();
      const startAt = now + at;
      const attackTime = Math.min(attack, duration * 0.4);
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, startAt);
      osc.frequency.exponentialRampToValueAtTime(endFrequency, startAt + duration);
      envelope.gain.setValueAtTime(0.0001, startAt);
      envelope.gain.exponentialRampToValueAtTime(gain, startAt + attackTime);
      envelope.gain.setValueAtTime(gain, startAt + duration * 0.52);
      envelope.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      osc.connect(envelope);
      envelope.connect(master);
      track(osc, [osc, envelope]);
      osc.start(startAt);
      osc.stop(startAt + duration + 0.02);
    }
    schedule({ partial, noise, glide });
    return true;
  } catch (error) {
    stop();
    if (voices.size === 0) master?.disconnect();
    reportAudioFailure('schedule', error, options);
    return false;
  }
}

// One glass family ties the user's calling signal to the final quiet decay.
function furinMotif(voice, { at = 0, gain = 1, duration = 2.2, pitch = 1 } = {}) {
  [[1568, 0.24, 1], [2474, 0.11, 0.72], [4123, 0.035, 0.3]].forEach(([frequency, amplitude, decay]) => {
    voice.partial({ at, frequency: frequency * pitch, gain: amplitude * gain, duration: duration * decay });
  });
}

// A short, dry pair identifies the same disconnected unit at both scales.
function diagnosticPair(voice, at, gain = 1, pitch = 1) {
  [0, 0.086].forEach((offset, index) => {
    voice.partial({ at: at + offset, frequency: (index ? 1420 : 1840) * pitch,
      gain: (index ? 0.09 : 0.13) * gain, duration: 0.017, attack: 0.001 });
    voice.noise({ at: at + offset, duration: 0.009, gain: 0.07 * gain,
      filterFrequency: 1800 * pitch, filterQ: 2.2 });
  });
}

function requireEntryStages(stages) {
  const names = ['IMPACT', 'DETACHMENT', 'SHADOW_DEPARTURE', 'ELECTRICAL_CASCADE',
    'POWER_CUT', 'WHITE_FIELD', 'GIANT_RETURN', 'REPAIR_COMPLETE', 'HANDOFF'];
  let previous = -1;
  for (const name of names) {
    const value = stages[name];
    if (!Number.isFinite(value) || value < 0 || value <= previous) {
      throw new Error(`zen_global_sentinel_entry_stage_invalid:${name}`);
    }
    previous = value;
  }
  return stages;
}

export function playZenGlobalSentinelSimulationRuptureSynth(options = {}) {
  return playFiniteCue(options, (voice) => {
    furinMotif(voice, { gain: 0.75, duration: 2.4 });
    voice.noise({ duration: 0.022, gain: 0.26, filterFrequency: 2300, filterQ: 2.6 });
    voice.glide({ duration: 0.24, frequency: 170, endFrequency: 71, gain: 0.22, attack: 0.008 });

    // Sound Lab can audition the contact alone. Cinematic playback always
    // receives the protocol's canonical stage table from the host controller.
    if (!options.entryStages) return;
    const stages = requireEntryStages(options.entryStages);
    const disconnectAt = (stages.DETACHMENT + (stages.SHADOW_DEPARTURE - stages.DETACHMENT) * 0.55) / 1000;
    diagnosticPair(voice, disconnectAt);
    if (!Array.isArray(options.entryFaultCues) || options.entryFaultCues.length === 0
      || options.entryFaultCues.some(at => !Number.isFinite(at) || at < stages.ELECTRICAL_CASCADE || at >= stages.POWER_CUT)) {
      throw new Error('zen_global_sentinel_entry_fault_cues_invalid');
    }
    options.entryFaultCues.forEach((atMs, index) => {
      const at = atMs / 1000;
      voice.noise({ at, duration: 0.031 + index * 0.004,
        gain: 0.17 + index * 0.012, filterFrequency: 2400 - index * 290, filterQ: 3 });
      voice.glide({ at, duration: 0.14,
        frequency: 136 - index * 9, endFrequency: 52, gain: 0.16 + index * 0.025, attack: 0.004 });
    });
    voice.glide({ at: stages.POWER_CUT / 1000, duration: 0.24,
      frequency: 91, endFrequency: 38, gain: 0.38, attack: 0.006 });

    // The white-field false calm is silent. Mass approaches as a slow change
    // in pressure, not a creature roar or an alarm layered over the picture.
    const returnAt = stages.GIANT_RETURN / 1000;
    const duration = (stages.REPAIR_COMPLETE - stages.GIANT_RETURN) / 1000;
    diagnosticPair(voice, returnAt + 0.65, 0.52, 0.72);
    voice.glide({ at: returnAt, duration, frequency: 47, endFrequency: 39,
      gain: 0.27, attack: duration * 0.28 });
    voice.glide({ at: returnAt + 0.15, duration: duration - 0.15,
      frequency: 94.3, endFrequency: 78.4, gain: 0.095, attack: duration * 0.31 });
    voice.glide({ at: returnAt + 0.7, duration: duration - 0.7,
      frequency: 233, endFrequency: 196, gain: 0.046, attack: duration * 0.3 });
    [0.24, 0.49, 0.72].forEach((phase) => {
      voice.noise({ at: returnAt + duration * phase, duration: 0.32,
        attack: 0.075, gain: 0.035, noiseType: 'pink', filterFrequency: 470, filterQ: 1.1 });
    });
  });
}

export function playZenGlobalSentinelRepairTelegraphSynth({ duration = 2.5, act = 1, identityRecall = false, ...options } = {}) {
  return playFiniteCue(options, (voice) => {
    const span = Math.max(0.04, Math.min(8, Number(duration)));
    const tension = Math.max(0, Math.min(2, Number(act) - 1));
    if (identityRecall) diagnosticPair(voice, 0, 0.38, 0.72);
    voice.glide({ duration: span, frequency: 174 + tension * 19,
      endFrequency: 196 + tension * 24, gain: 0.19, attack: span * 0.3 });
    voice.glide({ duration: span, frequency: 349.8 + tension * 38,
      endFrequency: 391.6 + tension * 48, gain: 0.045, attack: span * 0.35 });
  });
}

export function playZenGlobalSentinelInterventionHitSynth({ act = 1, ...options } = {}) {
  return playFiniteCue(options, (voice) => {
    const strength = Math.max(0, Math.min(2, Number(act) - 1));
    voice.noise({ duration: 0.018, gain: 0.29, filterFrequency: 2600, filterQ: 2.7 });
    voice.partial({ frequency: 1174, gain: 0.18, duration: 0.19 });
    voice.glide({ duration: 0.46 + strength * 0.11, frequency: 128,
      endFrequency: 48 - strength * 3, gain: 0.33, attack: 0.006 });
    // Distinct little fractures travel away from the struck repair contact.
    [0.13, 0.28, ...(strength > 0 ? [0.46, 0.67] : [])].forEach((at, index) => {
      voice.noise({ at, duration: 0.013 + index * 0.003,
        gain: 0.12 - index * 0.018, filterFrequency: 1900 + index * 280, filterQ: 3.1 });
    });
    furinMotif(voice, { at: 0.04, gain: 0.23, duration: 1.4, pitch: 0.749 });
  });
}

export function playZenGlobalSentinelTerminalBreachSynth(options = {}) {
  return playFiniteCue(options, (voice) => {
    voice.glide({ duration: 1.15, frequency: 74, endFrequency: 31, gain: 0.4, attack: 0.013 });
    [0, 0.06, 0.17, 0.34].forEach((at, index) => {
      voice.noise({ at, duration: 0.029, gain: 0.3 - index * 0.055,
        filterFrequency: 2700 - index * 240, filterQ: 2.7 });
    });
    // Nothing starts after this glass strike: only its decay is left with
    // the fixed fracture, making the aftermath a real acoustic silence.
    furinMotif(voice, { at: 0.12, gain: 0.6, duration: 3.8 });
  });
}

export function playZenGlobalSentinelFailureSealSynth(options = {}) {
  return playFiniteCue(options, (voice) => {
    voice.glide({ duration: 0.78, frequency: 156, endFrequency: 78, gain: 0.19, attack: 0.12 });
    voice.noise({ at: 0.15, duration: 0.18, attack: 0.025, gain: 0.045,
      noiseType: 'pink', filterFrequency: 820, filterQ: 1.5 });
    furinMotif(voice, { at: 0.22, gain: 0.36, duration: 2.5, pitch: 0.5 });
  });
}
