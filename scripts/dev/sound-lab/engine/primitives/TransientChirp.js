/**
 * TransientChirp generates ultra-fast pitch drop chirps for solid contact strikes and laser snaps.
 */

export class TransientChirp {
  static schedule(ctx, destination, {
    startAt = 0,
    startFreq = 1400,
    endFreq = 400,
    duration = 0.02,
    gain = 0.5,
    type = 'sine',
  } = {}) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startAt);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(10, endFreq),
      startAt + duration * 0.6,
    );

    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), startAt + 0.0015);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    osc.connect(gainNode);
    gainNode.connect(destination);

    osc.start(startAt);
    osc.stop(startAt + duration + 0.015);

    return { osc, gainNode };
  }
}
