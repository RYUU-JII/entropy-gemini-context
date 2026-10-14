/**
 * ZenSingingBowlSynth - Tibetan singing bowl meditation fundamental with binaural beating.
 */

import { ModalResonanceBank } from '../../primitives/ModalResonanceBank.js';

export class ZenSingingBowlSynth {
  static play(ctx, destination, {
    intensity = 0.7,
    basePitch = 330,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.01;
    const safeIntensity = Math.max(0.3, Math.min(1.2, Number(intensity) || 0.7));

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.32 * safeIntensity, now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
    master.connect(destination);

    // Fundamental + slight binaural beating offset (2.5Hz beat)
    ModalResonanceBank.schedulePartial(ctx, master, {
      frequency: basePitch,
      startAt: now,
      duration: 1.9,
      attack: 0.04,
      gain: 0.55 * safeIntensity,
      type: 'sine',
    });

    ModalResonanceBank.schedulePartial(ctx, master, {
      frequency: basePitch + 2.5,
      startAt: now,
      duration: 1.8,
      attack: 0.05,
      gain: 0.35 * safeIntensity,
      type: 'sine',
    });

    // Warm undertone
    ModalResonanceBank.schedulePartial(ctx, master, {
      frequency: basePitch * 0.5,
      startAt: now,
      duration: 1.7,
      attack: 0.06,
      gain: 0.20 * safeIntensity,
      type: 'triangle',
    });

    return true;
  }
}
