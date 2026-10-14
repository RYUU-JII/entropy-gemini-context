/**
 * Shishi-odoshi Bamboo Clack Synth - Physical modeling strike simulation.
 */

import { ModalResonanceBank } from '../../primitives/ModalResonanceBank.js';
import { NoiseGenerator } from '../../primitives/NoiseGenerator.js';
import { TransientChirp } from '../../primitives/TransientChirp.js';
import { ParameterAutomator } from '../../core/ParameterAutomator.js';

export class ShishiOdoshiClackSynth {
  static play(ctx, destination, {
    intensity = 0.75,
    basePitch = 468,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.004;
    const safeIntensity = Math.max(0.2, Math.min(1.3, Number(intensity) || 0.75));
    const jitter = ParameterAutomator.applyJitter(1.0, 0.018);
    const pitchRatio = (basePitch || 468) / 468;

    // Master node for the single strike
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.28 * safeIntensity, now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    master.connect(destination);

    // 1. Initial hard contact click (Sharp mineral contact transient)
    NoiseGenerator.scheduleBurst(ctx, master, {
      startAt: now,
      duration: 0.018,
      gain: 0.65 * safeIntensity,
      filterType: 'bandpass',
      filterFrequency: 2800 * jitter * pitchRatio,
      filterQ: 3.2,
    });

    // 2. High-speed pitch drop snap
    TransientChirp.schedule(ctx, master, {
      startAt: now,
      startFreq: 580 * 2.4 * jitter * pitchRatio,
      endFreq: 580 * jitter * pitchRatio,
      duration: 0.018,
      gain: 0.50 * safeIntensity,
    });

    // 3. Bamboo fibrous wood texture
    NoiseGenerator.scheduleBurst(ctx, master, {
      startAt: now + 0.001,
      duration: 0.065,
      gain: 0.45 * safeIntensity,
      filterType: 'bandpass',
      filterFrequency: 760 * jitter * pitchRatio,
      filterQ: 5.5,
    });

    // 4. Acoustic hollow bamboo cavity resonance
    // Mode 0: Sub-bass stone absorption
    ModalResonanceBank.schedulePartial(ctx, master, {
      frequency: 118 * jitter,
      startAt: now,
      duration: 0.075,
      gain: 0.38 * safeIntensity,
      type: 'triangle',
    });

    // Mode 1: Main bamboo tube hollow fundamental
    ModalResonanceBank.schedulePartial(ctx, master, {
      frequency: 468 * jitter * pitchRatio,
      startAt: now + 0.001,
      duration: 0.165,
      gain: 0.52 * safeIntensity,
      type: 'sine',
    });

    // Mode 2: Secondary harmonic
    ModalResonanceBank.schedulePartial(ctx, master, {
      frequency: 875 * jitter * pitchRatio,
      startAt: now + 0.001,
      duration: 0.125,
      gain: 0.36 * safeIntensity,
      type: 'sine',
    });

    // Mode 3: Upper bamboo cavity formant
    ModalResonanceBank.schedulePartial(ctx, master, {
      frequency: 1540 * jitter * pitchRatio,
      startAt: now + 0.002,
      duration: 0.075,
      gain: 0.24 * safeIntensity,
      type: 'sine',
    });

    // Mode 4: High rim overtone ring
    ModalResonanceBank.schedulePartial(ctx, master, {
      frequency: 2720 * jitter * pitchRatio,
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
  }
}
