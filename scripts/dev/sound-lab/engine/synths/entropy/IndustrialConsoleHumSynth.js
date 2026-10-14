/**
 * IndustrialConsoleHumSynth - Heavy transformer hum and cooling fan texture.
 */

import { NoiseGenerator } from '../../primitives/NoiseGenerator.js';

export class IndustrialConsoleHumSynth {
  static play(ctx, destination, {
    intensity = 0.7,
    duration = 2.5,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.005;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.7));

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.25 * safeIntensity, now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    master.connect(destination);

    // 50Hz / 100Hz / 150Hz power harmonics
    [50, 100, 150].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime((0.3 - idx * 0.08) * safeIntensity, now + 0.08);
      g.gain.setValueAtTime((0.3 - idx * 0.08) * safeIntensity, now + duration - 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    });

    // Air fan exhaust noise
    NoiseGenerator.scheduleBurst(ctx, master, {
      startAt: now,
      duration,
      attack: 0.1,
      gain: 0.18 * safeIntensity,
      noiseType: 'pink',
      filterType: 'lowpass',
      filterFrequency: 450,
      filterQ: 1.0,
    });

    return true;
  }
}
