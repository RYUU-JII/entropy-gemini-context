/**
 * DigitalRainCascadeSynth - Cascading high-frequency crystalline digital glyph beads.
 */

import { ModalResonanceBank } from '../../primitives/ModalResonanceBank.js';

export class DigitalRainCascadeSynth {
  static play(ctx, destination, {
    intensity = 0.7,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.7));

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.3 * safeIntensity, now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    master.connect(destination);

    // Arpeggiated sine crystal beads
    [1760, 2640, 3520].forEach((freq, idx) => {
      ModalResonanceBank.schedulePartial(ctx, master, {
        frequency: freq,
        startAt: now + idx * 0.045,
        duration: 0.18,
        attack: 0.002,
        gain: 0.4 * safeIntensity,
        type: 'sine',
      });
    });

    return true;
  }
}
