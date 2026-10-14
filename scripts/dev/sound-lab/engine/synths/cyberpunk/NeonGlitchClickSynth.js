/**
 * NeonGlitchClickSynth - Cyberpunk high-frequency spark discharge and laser drop.
 */

import { TransientChirp } from '../../primitives/TransientChirp.js';
import { NoiseGenerator } from '../../primitives/NoiseGenerator.js';

export class NeonGlitchClickSynth {
  static play(ctx, destination, {
    intensity = 0.8,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.002;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.8));

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.35 * safeIntensity, now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    master.connect(destination);

    // 1. Spark highpass noise
    NoiseGenerator.scheduleBurst(ctx, master, {
      startAt: now,
      duration: 0.035,
      gain: 0.65 * safeIntensity,
      filterType: 'highpass',
      filterFrequency: 3600,
      filterQ: 2.0,
    });

    // 2. Fast laser drop
    TransientChirp.schedule(ctx, master, {
      startAt: now,
      startFreq: 2600,
      endFreq: 380,
      duration: 0.1,
      gain: 0.45 * safeIntensity,
      type: 'sine',
    });

    return true;
  }
}
