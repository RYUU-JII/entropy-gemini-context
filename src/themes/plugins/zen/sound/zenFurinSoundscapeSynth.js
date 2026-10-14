import {
  getSharedAudioContext,
  resumeAudioContextIfSuspended,
} from '../../../../platform/audio/webAudioEngine.js';

function reportAudioFailure(phase, error, {
  diagnosticReporter = null,
  consoleRef = console,
} = {}) {
  if (typeof diagnosticReporter === 'function') {
    return diagnosticReporter(phase, error, consoleRef);
  }
  const diagnostic = {
    code: `zen_furin_soundscape_${phase || 'unknown'}_failed`,
    error: String(error?.message || error || 'audio_failed'),
  };
  consoleRef?.warn?.('[zen sound] furin soundscape failed', diagnostic);
  return diagnostic;
}

function getPinkNoiseBuffer(ctx, durationSec = 1.0) {
  const sampleRate = ctx.sampleRate || 44100;
  const bufferSize = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);

  let b0 = 0; let b1 = 0; let b2 = 0; let b3 = 0; let b4 = 0; let b5 = 0; let b6 = 0;
  for (let i = 0; i < bufferSize; i += 1) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

function scheduleDroplet(ctx, dest, {
  startAt = 0,
  startFreq = 420,
  endFreq = 1080,
  duration = 0.06,
  gain = 0.3,
} = {}) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(startFreq, startAt);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startAt + duration * 0.4);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq * 0.8), startAt + duration);

  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), startAt + 0.003);
  gainNode.gain.exponentialRampToValueAtTime(0.00001, startAt + duration);

  osc.connect(gainNode);
  gainNode.connect(dest);

  osc.start(startAt);
  osc.stop(startAt + duration + 0.015);
}

/**
 * Zen garden outdoor soundscape scene (gentle breeze, distant glass resonance, tranquil courtyard).
 */
export function playZenSiteFurinSoundscapeSynth({
  intensity = 0.7,
  duration = 5.0,
  audioContext = null,
  AudioContextCtor = null,
  consoleRef = console,
  diagnosticReporter = null,
} = {}) {
  const ctx = getSharedAudioContext({
    audioContext,
    AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
    onError: (error) => reportAudioFailure('context_create', error, { diagnosticReporter, consoleRef }),
  });
  if (!ctx) return false;
  resumeAudioContextIfSuspended(ctx, {
    onError: (error) => reportAudioFailure('resume', error, { diagnosticReporter, consoleRef }),
  });

  try {
    const now = ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.7));

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.22 * safeIntensity, now);
    master.gain.linearRampToValueAtTime(0.28 * safeIntensity, now + 0.8);
    master.gain.setValueAtTime(0.28 * safeIntensity, now + duration - 0.8);
    master.gain.exponentialRampToValueAtTime(0.00001, now + duration);
    master.connect(ctx.destination);

    // 1. Soft wind breeze (bandpass filtered pink noise with undulating resonance)
    const noiseBuffer = getPinkNoiseBuffer(ctx, duration + 0.3);
    const breezeSrc = ctx.createBufferSource();
    breezeSrc.buffer = noiseBuffer;

    const breezeFilter = ctx.createBiquadFilter();
    breezeFilter.type = 'bandpass';
    breezeFilter.frequency.setValueAtTime(360, now);
    breezeFilter.frequency.exponentialRampToValueAtTime(540, now + duration * 0.45);
    breezeFilter.frequency.exponentialRampToValueAtTime(320, now + duration);
    breezeFilter.Q.setValueAtTime(2.4, now);

    const breezeGain = ctx.createGain();
    breezeGain.gain.setValueAtTime(0.0001, now);
    breezeGain.gain.linearRampToValueAtTime(0.50 * safeIntensity, now + 0.6);
    breezeGain.gain.setValueAtTime(0.50 * safeIntensity, now + duration - 0.6);
    breezeGain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    breezeSrc.connect(breezeFilter);
    breezeFilter.connect(breezeGain);
    breezeGain.connect(master);
    breezeSrc.start(now);
    breezeSrc.stop(now + duration + 0.05);

    // 2. Grounding harmonic pad (144 Hz & 216 Hz root-fifth warmth)
    const padGain = ctx.createGain();
    padGain.gain.setValueAtTime(0.0001, now);
    padGain.gain.linearRampToValueAtTime(0.32 * safeIntensity, now + 0.9);
    padGain.gain.setValueAtTime(0.32 * safeIntensity, now + duration - 0.9);
    padGain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    [144, 216].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq + (idx === 0 ? 0.2 : -0.2), now);
      osc.connect(padGain);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    });

    padGain.connect(master);

    // 3. Ethereal high Furin shimmer (distant glass partials ringing in the breeze)
    const chimeFrequencies = [2093, 3136];
    chimeFrequencies.forEach((freq, idx) => {
      const chimeOsc = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      chimeOsc.type = 'sine';
      chimeOsc.frequency.setValueAtTime(freq, now);

      const chimeStart = now + 0.4 + idx * 1.2;
      chimeGain.gain.setValueAtTime(0.00001, chimeStart);
      chimeGain.gain.linearRampToValueAtTime(0.04 * safeIntensity, chimeStart + 0.05);
      chimeGain.gain.exponentialRampToValueAtTime(0.00001, chimeStart + 1.6);

      chimeOsc.connect(chimeGain);
      chimeGain.connect(master);
      chimeOsc.start(chimeStart);
      chimeOsc.stop(chimeStart + 1.7);
    });

    return true;
  } catch (error) {
    reportAudioFailure('schedule', error, { diagnosticReporter, consoleRef });
    return false;
  }
}

/**
 * Zen hydro-acoustic underwater loop scene (submerged muffled resonance and deep presence).
 */
export function playZenSiteFurinUnderwaterLoopSynth({
  intensity = 0.75,
  duration = 4.5,
  audioContext = null,
  AudioContextCtor = null,
  consoleRef = console,
  diagnosticReporter = null,
} = {}) {
  const ctx = getSharedAudioContext({
    audioContext,
    AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
    onError: (error) => reportAudioFailure('context_create', error, { diagnosticReporter, consoleRef }),
  });
  if (!ctx) return false;
  resumeAudioContextIfSuspended(ctx, {
    onError: (error) => reportAudioFailure('resume', error, { diagnosticReporter, consoleRef }),
  });

  try {
    const now = ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.30 * safeIntensity, now);
    master.gain.linearRampToValueAtTime(0.36 * safeIntensity, now + 0.6);
    master.gain.setValueAtTime(0.36 * safeIntensity, now + duration - 0.6);
    master.gain.exponentialRampToValueAtTime(0.00001, now + duration);
    master.connect(ctx.destination);

    // 1. Deep hydro-acoustic low-pass noise (submerged water body)
    const noiseBuffer = getPinkNoiseBuffer(ctx, duration + 0.3);
    const waterSrc = ctx.createBufferSource();
    waterSrc.buffer = noiseBuffer;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(210, now);
    lowpass.frequency.exponentialRampToValueAtTime(270, now + duration * 0.5);
    lowpass.frequency.exponentialRampToValueAtTime(190, now + duration);
    lowpass.Q.setValueAtTime(2.6, now);

    const waterGain = ctx.createGain();
    waterGain.gain.setValueAtTime(0.0001, now);
    waterGain.gain.linearRampToValueAtTime(0.60 * safeIntensity, now + 0.5);
    waterGain.gain.setValueAtTime(0.60 * safeIntensity, now + duration - 0.5);
    waterGain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    waterSrc.connect(lowpass);
    lowpass.connect(waterGain);
    waterGain.connect(master);
    waterSrc.start(now);
    waterSrc.stop(now + duration + 0.05);

    // 2. Sub-bass resonant sinusoids (55Hz / 82.5Hz)
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.40 * safeIntensity, now + 0.8);
    subGain.gain.setValueAtTime(0.40 * safeIntensity, now + duration - 0.8);
    subGain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    [55, 82.5].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(subGain);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    });

    subGain.connect(master);

    // 3. Subtle micro-bubbles
    scheduleDroplet(ctx, master, {
      startAt: now + 0.8,
      startFreq: 260,
      endFreq: 520,
      duration: 0.07,
      gain: 0.15 * safeIntensity,
    });
    scheduleDroplet(ctx, master, {
      startAt: now + 2.1,
      startFreq: 310,
      endFreq: 640,
      duration: 0.06,
      gain: 0.12 * safeIntensity,
    });

    return true;
  } catch (error) {
    reportAudioFailure('schedule', error, { diagnosticReporter, consoleRef });
    return false;
  }
}

/**
 * Site Furin submerge plunge cue (plunging into the calm ritual water).
 */
export function playZenSiteFurinSubmergeInSynth({
  intensity = 0.75,
  audioContext = null,
  AudioContextCtor = null,
  consoleRef = console,
  diagnosticReporter = null,
} = {}) {
  const ctx = getSharedAudioContext({
    audioContext,
    AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
    onError: (error) => reportAudioFailure('context_create', error, { diagnosticReporter, consoleRef }),
  });
  if (!ctx) return false;
  resumeAudioContextIfSuspended(ctx, {
    onError: (error) => reportAudioFailure('resume', error, { diagnosticReporter, consoleRef }),
  });

  try {
    const now = ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
    const duration = 0.85;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.36 * safeIntensity, now);
    master.connect(ctx.destination);

    // 1. Plunge downward lowpass sweep (water gulp & displacement)
    const noiseBuffer = getPinkNoiseBuffer(ctx, duration + 0.2);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(880, now);
    filter.frequency.exponentialRampToValueAtTime(130, now + duration * 0.85);
    filter.Q.setValueAtTime(3.4, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.linearRampToValueAtTime(0.75 * safeIntensity, now + 0.08);
    noiseGain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);
    noiseSource.start(now);
    noiseSource.stop(now + duration + 0.05);

    // 2. Sub-bass entry thud (120 Hz down to 44 Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(120, now);
    subOsc.frequency.exponentialRampToValueAtTime(44, now + duration * 0.7);

    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.50 * safeIntensity, now + 0.05);
    subGain.gain.exponentialRampToValueAtTime(0.00001, now + duration * 0.75);

    subOsc.connect(subGain);
    subGain.connect(master);
    subOsc.start(now);
    subOsc.stop(now + duration + 0.05);

    // 3. Trapped air bubble burst
    scheduleDroplet(ctx, master, {
      startAt: now + 0.12,
      startFreq: 240,
      endFreq: 580,
      duration: 0.09,
      gain: 0.32 * safeIntensity,
    });

    return true;
  } catch (error) {
    reportAudioFailure('schedule', error, { diagnosticReporter, consoleRef });
    return false;
  }
}

/**
 * Site Furin surface out cue (breaking out of the water into fresh air).
 */
export function playZenSiteFurinSurfaceOutSynth({
  intensity = 0.75,
  audioContext = null,
  AudioContextCtor = null,
  consoleRef = console,
  diagnosticReporter = null,
} = {}) {
  const ctx = getSharedAudioContext({
    audioContext,
    AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
    onError: (error) => reportAudioFailure('context_create', error, { diagnosticReporter, consoleRef }),
  });
  if (!ctx) return false;
  resumeAudioContextIfSuspended(ctx, {
    onError: (error) => reportAudioFailure('resume', error, { diagnosticReporter, consoleRef }),
  });

  try {
    const now = ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
    const duration = 0.95;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.34 * safeIntensity, now);
    master.connect(ctx.destination);

    // 1. Rising surface splash (160 Hz upward sweep to 1100 Hz)
    const noiseBuffer = getPinkNoiseBuffer(ctx, duration + 0.2);
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(160, now);
    filter.frequency.exponentialRampToValueAtTime(1150, now + duration * 0.45);
    filter.frequency.exponentialRampToValueAtTime(420, now + duration);
    filter.Q.setValueAtTime(2.8, now);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(0.70 * safeIntensity, now + 0.15);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(master);
    source.start(now);
    source.stop(now + duration + 0.05);

    // 2. Air break sparkle droplets
    scheduleDroplet(ctx, master, {
      startAt: now + 0.10,
      startFreq: 520,
      endFreq: 1180,
      duration: 0.06,
      gain: 0.35 * safeIntensity,
    });
    scheduleDroplet(ctx, master, {
      startAt: now + 0.24,
      startFreq: 640,
      endFreq: 1320,
      duration: 0.05,
      gain: 0.28 * safeIntensity,
    });

    return true;
  } catch (error) {
    reportAudioFailure('schedule', error, { diagnosticReporter, consoleRef });
    return false;
  }
}

/**
 * Site Furin settle complete cue (ritual concluded: water calm and serene harmonic chime resolution).
 */
export function playZenSiteFurinSettleCompleteSynth({
  intensity = 0.75,
  audioContext = null,
  AudioContextCtor = null,
  consoleRef = console,
  diagnosticReporter = null,
} = {}) {
  const ctx = getSharedAudioContext({
    audioContext,
    AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
    onError: (error) => reportAudioFailure('context_create', error, { diagnosticReporter, consoleRef }),
  });
  if (!ctx) return false;
  resumeAudioContextIfSuspended(ctx, {
    onError: (error) => reportAudioFailure('resume', error, { diagnosticReporter, consoleRef }),
  });

  try {
    const now = ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
    const duration = 2.4;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.32 * safeIntensity, now);
    master.connect(ctx.destination);

    // 1. Water ripple calming bed (soft lowpass pink noise decay)
    const noiseBuffer = getPinkNoiseBuffer(ctx, duration + 0.2);
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(110, now + 1.4);
    filter.Q.setValueAtTime(1.4, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.linearRampToValueAtTime(0.48 * safeIntensity, now + 0.15);
    noiseGain.gain.exponentialRampToValueAtTime(0.00001, now + 1.5);

    source.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);
    source.start(now);
    source.stop(now + 1.6);

    // 2. Serene resolution Furin chime triad (C6 = 1046.5Hz, G6 = 1567.98Hz, C7 = 2093Hz)
    const chimeFrequencies = [1046.5, 1567.98, 2093.0];
    const chimeMasterGain = ctx.createGain();
    chimeMasterGain.gain.setValueAtTime(0.0001, now);
    chimeMasterGain.gain.linearRampToValueAtTime(0.42 * safeIntensity, now + 0.04);
    chimeMasterGain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    chimeFrequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      const oscGain = ctx.createGain();
      const relativeAmp = idx === 0 ? 0.6 : (idx === 1 ? 0.35 : 0.25);
      oscGain.gain.setValueAtTime(relativeAmp, now);

      osc.connect(oscGain);
      oscGain.connect(chimeMasterGain);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    });

    chimeMasterGain.connect(master);

    return true;
  } catch (error) {
    reportAudioFailure('schedule', error, { diagnosticReporter, consoleRef });
    return false;
  }
}
