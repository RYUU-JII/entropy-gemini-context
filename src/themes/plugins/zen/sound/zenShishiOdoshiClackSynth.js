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
  if (typeof diagnosticReporter === 'function') {
    return diagnosticReporter(phase, error, consoleRef);
  }
  const diagnostic = {
    code: `zen_shishi_odoshi_clack_${phase || 'unknown'}_failed`,
    error: String(error?.message || error || 'audio_failed'),
  };
  consoleRef?.warn?.('[zen sound] shishi-odoshi clack failed', diagnostic);
  return diagnostic;
}

/**
 * Synthesizes a physical modeling acoustic bamboo strike ("clack")
 * representing a Shishi-odoshi striking the stone foundation.
 */
export function playZenShishiOdoshiClackSynth({
  intensity = 0.72,
  audioContext = null,
  AudioContextCtor = null,
  consoleRef = console,
  diagnosticReporter = null,
} = {}) {
  const ctx = getSharedAudioContext({
    audioContext,
    AudioContextCtor: AudioContextCtor || globalThis.AudioContext || globalThis.webkitAudioContext,
    onError: (error) => reportAudioFailure('context_create', error, {
      diagnosticReporter,
      consoleRef,
    }),
  });
  if (!ctx) return false;
  resumeAudioContextIfSuspended(ctx, {
    onError: (error) => reportAudioFailure('resume', error, {
      diagnosticReporter,
      consoleRef,
    }),
  });

  try {
    const now = ctx.currentTime + 0.004;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.72));

    // Master bus for this strike instance
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.26 * safeIntensity, now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    master.connect(ctx.destination);

    // Micro-jitter (+/- 1.8%) to give organic variation between successive strikes
    const jitter = 0.982 + Math.random() * 0.036;

    // 1. Initial hard contact click (Sharp mineral contact transient)
    scheduleNoiseBurst(ctx, master, {
      startAt: now,
      duration: 0.018,
      gain: 0.65 * safeIntensity,
      filterType: 'bandpass',
      filterFrequency: 2800 * jitter,
      filterQ: 3.2,
    });

    // 2. High-speed pitch drop snap (Hard edge compression wave)
    scheduleModalPartial(ctx, master, {
      frequency: 580 * jitter,
      startAt: now,
      duration: 0.018,
      gain: 0.50 * safeIntensity,
      type: 'sine',
      pitchDrop: true,
    });

    // 3. Bamboo fibrous wood texture (Mid-range resonant noise body)
    scheduleNoiseBurst(ctx, master, {
      startAt: now + 0.001,
      duration: 0.065,
      gain: 0.45 * safeIntensity,
      filterType: 'bandpass',
      filterFrequency: 760 * jitter,
      filterQ: 5.5,
    });

    // 4. Acoustic hollow bamboo cavity resonance (Physical modal frequencies)
    // Mode 0: Sub-bass stone absorption thud
    scheduleModalPartial(ctx, master, {
      frequency: 118 * jitter,
      startAt: now,
      duration: 0.075,
      gain: 0.38 * safeIntensity,
      type: 'triangle',
    });

    // Mode 1: Main bamboo tube hollow fundamental
    scheduleModalPartial(ctx, master, {
      frequency: 468 * jitter,
      startAt: now + 0.001,
      duration: 0.165,
      gain: 0.52 * safeIntensity,
      type: 'sine',
    });

    // Mode 2: Hollow cylinder secondary harmonic
    scheduleModalPartial(ctx, master, {
      frequency: 875 * jitter,
      startAt: now + 0.001,
      duration: 0.125,
      gain: 0.36 * safeIntensity,
      type: 'sine',
    });

    // Mode 3: Upper bamboo cavity formant
    scheduleModalPartial(ctx, master, {
      frequency: 1540 * jitter,
      startAt: now + 0.002,
      duration: 0.075,
      gain: 0.24 * safeIntensity,
      type: 'sine',
    });

    // Mode 4: High rim overtone ring
    scheduleModalPartial(ctx, master, {
      frequency: 2720 * jitter,
      startAt: now + 0.002,
      duration: 0.042,
      gain: 0.14 * safeIntensity,
      type: 'sine',
    });

    // 5. Post-strike aftermath micro-drip (Residual water droplet falling from bamboo lip at t = +0.18s)
    const dropOsc = ctx.createOscillator();
    const dropGain = ctx.createGain();
    const dropStart = now + 0.18;
    const dropDuration = 0.055;

    dropOsc.type = 'sine';
    dropOsc.frequency.setValueAtTime(480 * jitter, dropStart);
    dropOsc.frequency.exponentialRampToValueAtTime(1150 * jitter, dropStart + dropDuration * 0.4);
    dropOsc.frequency.exponentialRampToValueAtTime(820 * jitter, dropStart + dropDuration);

    dropGain.gain.setValueAtTime(0.0001, dropStart);
    dropGain.gain.exponentialRampToValueAtTime(0.22 * safeIntensity, dropStart + 0.003);
    dropGain.gain.exponentialRampToValueAtTime(0.00001, dropStart + dropDuration);

    dropOsc.connect(dropGain);
    dropGain.connect(master);
    dropOsc.start(dropStart);
    dropOsc.stop(dropStart + dropDuration + 0.01);

    return true;
  } catch (error) {
    reportAudioFailure('schedule', error, {
      diagnosticReporter,
      consoleRef,
    });
    return false;
  }
}
