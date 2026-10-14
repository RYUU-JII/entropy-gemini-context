/**
 * Water and fluid acoustics synthesis primitives for WebAudio.
 */

import { getPinkNoiseBuffer } from './noisePrimitives.js';

/**
 * Synthesizes an acoustic water droplet / plop / bubble sound.
 * Characteristic: Rapid upward (or downward) pitch sweep + quick exponential decay.
 */
export function scheduleWaterDrop(ctx, destination, {
  startAt = 0,
  startFreq = 400,
  endFreq = 1100,
  duration = 0.06,
  gain = 0.3,
  type = 'sine',
} = {}) {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, startAt);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startAt + duration * 0.4);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq * 0.8), startAt + duration);

  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), startAt + 0.003);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gainNode);
  gainNode.connect(destination);

  osc.start(startAt);
  osc.stop(startAt + duration + 0.01);

  return { osc, gainNode };
}

/**
 * Creates a streaming / trickling water noise layer with low-frequency modulation.
 */
export function scheduleWaterStreamFlow(ctx, destination, {
  startAt = 0,
  duration = 1.0,
  gain = 0.2,
  baseFilterFreq = 650,
  q = 4.5,
} = {}) {
  const noiseBuffer = getPinkNoiseBuffer(ctx, Math.max(duration + 0.2, 1.0));
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(baseFilterFreq, startAt);
  filter.Q.setValueAtTime(q, startAt);

  // Modulate the filter frequency subtly over time to simulate turbulent fluid motion
  const steps = Math.min(30, Math.floor(duration * 10));
  for (let i = 1; i <= steps; i += 1) {
    const t = startAt + (i / steps) * duration;
    const wobble = baseFilterFreq * (0.85 + Math.random() * 0.3);
    filter.frequency.exponentialRampToValueAtTime(wobble, t);
  }

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), startAt + 0.05);
  gainNode.gain.setValueAtTime(Math.max(0.0001, gain), startAt + Math.max(0.05, duration - 0.08));
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(destination);

  source.start(startAt);
  source.stop(startAt + duration + 0.02);

  return { source, filter, gainNode };
}
