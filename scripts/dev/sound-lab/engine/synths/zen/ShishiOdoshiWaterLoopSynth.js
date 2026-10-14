/**
 * ShishiOdoshiWaterLoopSynth - Ambient trickling water flow, droplets, and cascading overflow.
 */

import { FluidAcoustics } from '../../primitives/FluidAcoustics.js';
import { NoiseGenerator } from '../../primitives/NoiseGenerator.js';

export class ShishiOdoshiWaterLoopSynth {
  /**
   * Inflow water trickle & rhythmic droplets filling the bamboo tube
   */
  static play(ctx, destination, {
    intensity = 0.7,
    duration = 3.5,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.005;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.7));

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.28 * safeIntensity, now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    master.connect(destination);

    // 1. Turbulent Stream Base (Kakehi Bamboo Spout Stream)
    FluidAcoustics.scheduleStreamFlow(ctx, master, {
      startAt: now,
      duration,
      gain: 0.28 * safeIntensity,
      centerFreq: 680,
      q: 3.8,
    });

    // 2. Bamboo Cavity Resonance (Hollow tone echoing inside the tube)
    const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.2);
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

    // 3. Stochastic Plop Droplets (0.12s, 0.48s, 0.95s, 1.45s, 2.1s, 2.8s)
    const dropTimings = [0.12, 0.48, 0.95, 1.45, 2.10, 2.80];
    dropTimings.forEach((offset, idx) => {
      if (offset < duration) {
        FluidAcoustics.scheduleDroplet(ctx, master, {
          startAt: now + offset,
          startFreq: 340 + (idx % 3) * 90,
          endFreq: 980 + (idx % 3) * 140,
          duration: 0.055,
          gain: (0.30 + (idx % 2) * 0.1) * safeIntensity,
        });
      }
    });

    return true;
  }

  /**
   * Overflow torrent and splash when the bamboo tube reaches capacity and tips over
   */
  static playOverflow(ctx, destination, {
    intensity = 0.8,
    duration = 2.2,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.004;
    const safeIntensity = Math.max(0.2, Math.min(1.3, Number(intensity) || 0.8));

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.32 * safeIntensity, now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    master.connect(destination);

    const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.3);

    // Layer 1: Heavy Water Dump Torrent (Low-mid cascade 420Hz)
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

    // Layer 2: Splash White-water Shimmer (High 1400Hz)
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

    // Layer 3: Splash Droplet Scatter
    const splashOffsets = [0.18, 0.32, 0.52, 0.78, 1.10];
    splashOffsets.forEach((offset, idx) => {
      if (offset < duration) {
        FluidAcoustics.scheduleDroplet(ctx, master, {
          startAt: now + offset,
          startFreq: 420 + idx * 80,
          endFreq: 1200 + idx * 90,
          duration: 0.045,
          gain: (0.28 + (idx % 2) * 0.08) * safeIntensity,
        });
      }
    });

    return true;
  }
}
