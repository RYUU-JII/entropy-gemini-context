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
    code: `zen_koi_hydro_${phase || 'unknown'}_failed`,
    error: String(error?.message || error || 'audio_failed'),
  };
  consoleRef?.warn?.('[zen sound] koi hydro acoustics failed', diagnostic);
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

function scheduleDroplet(ctx, dest, { startAt = 0, startFreq = 400, endFreq = 1100, duration = 0.06, gain = 0.35 } = {}) {
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

export function playZenKoiWakeSurfaceSynth({
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
    const duration = 1.1;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.35 * safeIntensity, now);
    master.connect(ctx.destination);

    const noiseBuffer = getPinkNoiseBuffer(ctx, duration + 0.2);
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(220, now);
    filter.frequency.exponentialRampToValueAtTime(680, now + duration * 0.65);
    filter.frequency.exponentialRampToValueAtTime(320, now + duration);
    filter.Q.setValueAtTime(3.5, now);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(0.75 * safeIntensity, now + duration * 0.45);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(master);

    source.start(now);
    source.stop(now + duration + 0.05);

    scheduleDroplet(ctx, master, {
      startAt: now + 0.42,
      startFreq: 380,
      endFreq: 920,
      duration: 0.07,
      gain: 0.28 * safeIntensity,
    });

    scheduleDroplet(ctx, master, {
      startAt: now + 0.58,
      startFreq: 520,
      endFreq: 1180,
      duration: 0.05,
      gain: 0.18 * safeIntensity,
    });

    return true;
  } catch (error) {
    reportAudioFailure('schedule', error, { diagnosticReporter, consoleRef });
    return false;
  }
}

export function playZenKoiGlideLoopSynth({
  intensity = 0.75,
  duration = 2.4,
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
    master.gain.setValueAtTime(0.26 * safeIntensity, now);
    master.connect(ctx.destination);

    const noiseBuffer = getPinkNoiseBuffer(ctx, duration + 0.3);

    const src1 = ctx.createBufferSource();
    src1.buffer = noiseBuffer;
    const filter1 = ctx.createBiquadFilter();
    filter1.type = 'bandpass';
    filter1.frequency.setValueAtTime(340, now);
    filter1.Q.setValueAtTime(2.8, now);

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.linearRampToValueAtTime(0.65 * safeIntensity, now + 0.35);
    gain1.gain.setValueAtTime(0.65 * safeIntensity, now + duration - 0.4);
    gain1.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    src1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(master);
    src1.start(now);
    src1.stop(now + duration + 0.05);

    const src2 = ctx.createBufferSource();
    src2.buffer = noiseBuffer;
    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'bandpass';
    filter2.frequency.setValueAtTime(850, now);
    filter2.Q.setValueAtTime(4.2, now);

    const steps = Math.floor(duration * 12);
    for (let i = 0; i <= steps; i += 1) {
      const t = now + (i / steps) * duration;
      const wave = Math.sin((i / steps) * duration * Math.PI * 2 * 0.85);
      const modulatedFreq = 850 + wave * 180;
      filter2.frequency.exponentialRampToValueAtTime(Math.max(200, modulatedFreq), t);
    }

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.linearRampToValueAtTime(0.35 * safeIntensity, now + 0.35);
    gain2.gain.setValueAtTime(0.35 * safeIntensity, now + duration - 0.4);
    gain2.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    src2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(master);
    src2.start(now);
    src2.stop(now + duration + 0.05);

    return true;
  } catch (error) {
    reportAudioFailure('schedule', error, { diagnosticReporter, consoleRef });
    return false;
  }
}

export function playZenKoiRendezvousSynth({
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
    const duration = 0.9;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.32 * safeIntensity, now);
    master.connect(ctx.destination);

    const noiseBuffer = getPinkNoiseBuffer(ctx, duration + 0.2);
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(920, now + duration * 0.45);
    filter.frequency.exponentialRampToValueAtTime(480, now + duration);
    filter.Q.setValueAtTime(4.0, now);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(0.70 * safeIntensity, now + duration * 0.35);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(master);

    source.start(now);
    source.stop(now + duration + 0.05);

    scheduleDroplet(ctx, master, {
      startAt: now + 0.28,
      startFreq: 460,
      endFreq: 1040,
      duration: 0.08,
      gain: 0.30 * safeIntensity,
    });

    return true;
  } catch (error) {
    reportAudioFailure('schedule', error, { diagnosticReporter, consoleRef });
    return false;
  }
}

export function playZenKoiDescentDiveSynth({
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
    const duration = 1.4;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.34 * safeIntensity, now);
    master.connect(ctx.destination);

    const noiseBuffer = getPinkNoiseBuffer(ctx, duration + 0.2);
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + duration * 0.85);
    filter.Q.setValueAtTime(3.2, now);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(0.80 * safeIntensity, now + 0.25);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(master);

    source.start(now);
    source.stop(now + duration + 0.05);

    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(135, now);
    subOsc.frequency.exponentialRampToValueAtTime(58, now + duration * 0.9);

    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.45 * safeIntensity, now + 0.30);
    subGain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    subOsc.connect(subGain);
    subGain.connect(master);

    subOsc.start(now);
    subOsc.stop(now + duration + 0.05);

    return true;
  } catch (error) {
    reportAudioFailure('schedule', error, { diagnosticReporter, consoleRef });
    return false;
  }
}

export function playZenWaterSettleCalmSynth({
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
    const duration = 1.6;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.28 * safeIntensity, now);
    master.connect(ctx.destination);

    const noiseBuffer = getPinkNoiseBuffer(ctx, duration + 0.2);
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + duration);
    filter.Q.setValueAtTime(1.5, now);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(0.55 * safeIntensity, now + 0.20);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(master);

    source.start(now);
    source.stop(now + duration + 0.05);

    return true;
  } catch (error) {
    reportAudioFailure('schedule', error, { diagnosticReporter, consoleRef });
    return false;
  }
}
