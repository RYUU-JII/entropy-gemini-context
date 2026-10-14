/**
 * FluidAcoustics generates hydro-acoustic water droplets, bubbling, and turbulent stream flows.
 */

import { NoiseGenerator } from './NoiseGenerator.js';

export class FluidAcoustics {
  static scheduleDroplet(ctx, destination, {
    startAt = 0,
    startFreq = 400,
    endFreq = 1100,
    duration = 0.06,
    gain = 0.35,
  } = {}) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, startAt);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startAt + duration * 0.4);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq * 0.8), startAt + duration);

    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), startAt + 0.003);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    osc.connect(gainNode);
    gainNode.connect(destination);

    osc.start(startAt);
    osc.stop(startAt + duration + 0.015);

    return { osc, gainNode };
  }

  static scheduleStreamFlow(ctx, destination, {
    startAt = 0,
    duration = 1.0,
    gain = 0.25,
    centerFreq = 650,
    q = 4.0,
  } = {}) {
    const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, Math.max(duration + 0.2, 1.0));
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(centerFreq, startAt);
    filter.Q.setValueAtTime(q, startAt);

    // Micro-wobble
    const steps = Math.min(20, Math.floor(duration * 8));
    for (let i = 1; i <= steps; i += 1) {
      const t = startAt + (i / steps) * duration;
      const wobble = centerFreq * (0.88 + Math.random() * 0.24);
      filter.frequency.exponentialRampToValueAtTime(wobble, t);
    }

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), startAt + 0.04);
    gainNode.gain.setValueAtTime(Math.max(0.0001, gain), startAt + Math.max(0.04, duration - 0.06));
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(destination);

    source.start(startAt);
    source.stop(startAt + duration + 0.02);

    return { source, filter, gainNode };
  }
}
