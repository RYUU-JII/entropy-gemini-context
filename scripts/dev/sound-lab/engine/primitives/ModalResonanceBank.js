/**
 * ModalResonanceBank simulates acoustic physical resonator modes (Bamboo, Wood, Metal, Stone).
 */

export class ModalResonanceBank {
  static schedulePartial(ctx, destination, {
    frequency = 440,
    startAt = 0,
    duration = 0.2,
    attack = 0.002,
    gain = 0.5,
    type = 'sine',
    detune = 0,
  } = {}) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = type;
    osc.detune.setValueAtTime(detune, startAt);
    osc.frequency.setValueAtTime(frequency, startAt);

    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, gain),
      startAt + Math.max(0.001, attack),
    );
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    osc.connect(gainNode);
    gainNode.connect(destination);

    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);

    return { osc, gainNode };
  }

  static scheduleBank(ctx, destination, {
    partials = [],
    startAt = 0,
    gainMultiplier = 1.0,
    frequencyMultiplier = 1.0,
  } = {}) {
    return partials.map((partial) => this.schedulePartial(ctx, destination, {
      ...partial,
      frequency: partial.frequency * frequencyMultiplier,
      gain: partial.gain * gainMultiplier,
      startAt: startAt + (partial.timeOffset || 0),
    }));
  }
}
