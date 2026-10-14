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
    code: `zen_shishi_water_${phase || 'unknown'}_failed`,
    error: String(error?.message || error || 'audio_failed'),
  };
  consoleRef?.warn?.('[zen sound] shishi-odoshi water failed', diagnostic);
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

function scheduleDroplet(ctx, dest, { startAt = 0, startFreq = 400, endFreq = 1100, duration = 0.055, gain = 0.3 } = {}) {
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

export function playZenShishiOdoshiWaterLoopSynth({
  intensity = 0.7,
  duration = 3.5,
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
    const now = ctx.currentTime + 0.005;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.7));

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.28 * safeIntensity, now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    master.connect(ctx.destination);

    // Stream base
    const noiseBuffer = getPinkNoiseBuffer(ctx, duration + 0.2);
    const streamSrc = ctx.createBufferSource();
    streamSrc.buffer = noiseBuffer;
    const streamFilter = ctx.createBiquadFilter();
    streamFilter.type = 'bandpass';
    streamFilter.frequency.setValueAtTime(680, now);
    streamFilter.Q.setValueAtTime(3.8, now);

    const streamGain = ctx.createGain();
    streamGain.gain.setValueAtTime(0.0001, now);
    streamGain.gain.linearRampToValueAtTime(0.28 * safeIntensity, now + 0.2);
    streamGain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    streamSrc.connect(streamFilter);
    streamFilter.connect(streamGain);
    streamGain.connect(master);
    streamSrc.start(now);
    streamSrc.stop(now + duration + 0.05);

    // Bamboo Cavity Resonance
    const cavitySrc = ctx.createBufferSource();
    cavitySrc.buffer = noiseBuffer;
    const cavityFilter = ctx.createBiquadFilter();
    cavityFilter.type = 'bandpass';
    cavityFilter.frequency.setValueAtTime(920, now);
    cavityFilter.Q.setValueAtTime(6.0, now);

    const cavityGain = ctx.createGain();
    cavityGain.gain.setValueAtTime(0.0001, now);
    cavityGain.gain.linearRampToValueAtTime(0.18 * safeIntensity, now + 0.2);
    cavityGain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    cavitySrc.connect(cavityFilter);
    cavityFilter.connect(cavityGain);
    cavityGain.connect(master);
    cavitySrc.start(now);
    cavitySrc.stop(now + duration + 0.05);

    // Droplets
    const dropTimings = [0.12, 0.48, 0.95, 1.45, 2.10, 2.80];
    dropTimings.forEach((offset, idx) => {
      if (offset < duration) {
        scheduleDroplet(ctx, master, {
          startAt: now + offset,
          startFreq: 340 + (idx % 3) * 90,
          endFreq: 980 + (idx % 3) * 140,
          duration: 0.055,
          gain: (0.30 + (idx % 2) * 0.1) * safeIntensity,
        });
      }
    });

    return true;
  } catch (error) {
    reportAudioFailure('schedule', error, { diagnosticReporter, consoleRef });
    return false;
  }
}

export function playZenShishiOdoshiOverflowLoopSynth({
  intensity = 0.8,
  duration = 2.2,
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
    const now = ctx.currentTime + 0.004;
    const safeIntensity = Math.max(0.2, Math.min(1.3, Number(intensity) || 0.8));

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.32 * safeIntensity, now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    master.connect(ctx.destination);

    const noiseBuffer = getPinkNoiseBuffer(ctx, duration + 0.3);

    // Cascade 420Hz
    const src1 = ctx.createBufferSource();
    src1.buffer = noiseBuffer;
    const filter1 = ctx.createBiquadFilter();
    filter1.type = 'bandpass';
    filter1.frequency.setValueAtTime(420, now);
    filter1.frequency.exponentialRampToValueAtTime(680, now + duration * 0.4);
    filter1.frequency.exponentialRampToValueAtTime(260, now + duration);
    filter1.Q.setValueAtTime(2.5, now);

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.linearRampToValueAtTime(0.75 * safeIntensity, now + 0.25);
    gain1.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    src1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(master);
    src1.start(now);
    src1.stop(now + duration + 0.05);

    // Shimmer 1400Hz
    const src2 = ctx.createBufferSource();
    src2.buffer = noiseBuffer;
    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'bandpass';
    filter2.frequency.setValueAtTime(1400, now);
    filter2.frequency.exponentialRampToValueAtTime(950, now + duration * 0.7);
    filter2.Q.setValueAtTime(3.5, now);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.linearRampToValueAtTime(0.45 * safeIntensity, now + 0.20);
    gain2.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    src2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(master);
    src2.start(now);
    src2.stop(now + duration + 0.05);

    // Splash droplets
    const splashOffsets = [0.18, 0.32, 0.52, 0.78, 1.10];
    splashOffsets.forEach((offset, idx) => {
      if (offset < duration) {
        scheduleDroplet(ctx, master, {
          startAt: now + offset,
          startFreq: 420 + idx * 80,
          endFreq: 1200 + idx * 90,
          duration: 0.045,
          gain: (0.28 + (idx % 2) * 0.08) * safeIntensity,
        });
      }
    });

    return true;
  } catch (error) {
    reportAudioFailure('schedule', error, { diagnosticReporter, consoleRef });
    return false;
  }
}
