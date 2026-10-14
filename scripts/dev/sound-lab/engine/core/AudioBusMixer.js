/**
 * AudioBusMixer manages gain stages for distinct sound buses (sfx, ambient, ritual, music).
 */

export class AudioBusMixer {
  constructor(audioGraphContext) {
    this.graphContext = audioGraphContext;
    this.buses = new Map();
  }

  getBus(busId = 'sfx') {
    const ctx = this.graphContext.ensureContext();
    if (!ctx) return null;

    if (!this.buses.has(busId)) {
      const busGain = ctx.createGain();
      busGain.gain.setValueAtTime(1.0, ctx.currentTime);
      const destination = this.graphContext.getDestination();
      if (destination) {
        busGain.connect(destination);
      }
      this.buses.set(busId, busGain);
    }

    return this.buses.get(busId);
  }

  setBusVolume(busId, volume) {
    const bus = this.getBus(busId);
    if (!bus) return;
    const ctx = this.graphContext.ensureContext();
    const safeVol = Math.max(0, Math.min(1, Number(volume) || 0));
    bus.gain.setValueAtTime(safeVol, ctx ? ctx.currentTime : 0);
  }
}
