/**
 * TerminalDataPulseSynth - Industrial high-voltage CRT pulse for Entropy theme.
 */

import { TransientChirp } from '../../primitives/TransientChirp.js';
import { NoiseGenerator } from '../../primitives/NoiseGenerator.js';

export class TerminalDataPulseSynth {
  static play(ctx, destination, {
    intensity = 0.8,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.8));

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.35 * safeIntensity, now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    master.connect(destination);

    // 1. Sawtooth high-speed chirp
    TransientChirp.schedule(ctx, master, {
      startAt: now,
      startFreq: 1400,
      endFreq: 160,
      duration: 0.14,
      gain: 0.65 * safeIntensity,
      type: 'sawtooth',
    });

    // 2. Analog distortion click
    NoiseGenerator.scheduleBurst(ctx, master, {
      startAt: now,
      duration: 0.03,
      gain: 0.5 * safeIntensity,
      filterType: 'bandpass',
      filterFrequency: 1800,
      filterQ: 2.5,
    });

    // 3. 60Hz electromagnetic power hum
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.setValueAtTime(60, now);
    const humGain = ctx.createGain();
    humGain.gain.setValueAtTime(0.0001, now);
    humGain.gain.exponentialRampToValueAtTime(0.3 * safeIntensity, now + 0.01);
    hum.connect(humGain);
    humGain.connect(master);
    hum.start(now);
    hum.stop(now + 0.25);

    return true;
  }
}
