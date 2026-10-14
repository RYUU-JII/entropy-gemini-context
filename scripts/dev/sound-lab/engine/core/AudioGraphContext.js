/**
 * AudioGraphContext manages the WebAudio AudioContext lifecycle, master gain,
 * and analysis graph routing in a clean, decoupled manner.
 */

export class AudioGraphContext {
  constructor({ AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
    this.AudioContextCtor = AudioContextCtor;
    this.ctx = null;
    this.masterGain = null;
    this.masterAnalyser = null;
  }

  ensureContext() {
    if (!this.ctx && typeof this.AudioContextCtor === 'function') {
      this.ctx = new this.AudioContextCtor();
      this.masterGain = this.ctx.createGain();
      this.masterAnalyser = this.ctx.createAnalyser();
      this.masterAnalyser.fftSize = 512;

      this.masterGain.connect(this.masterAnalyser);
      this.masterAnalyser.connect(this.ctx.destination);
    }

    if (this.ctx && this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
      void this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  get currentTime() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  get sampleRate() {
    return this.ctx ? this.ctx.sampleRate : 44100;
  }

  getDestination() {
    this.ensureContext();
    return this.masterGain || (this.ctx ? this.ctx.destination : null);
  }

  getAnalyser() {
    this.ensureContext();
    return this.masterAnalyser;
  }

  close() {
    if (this.ctx && typeof this.ctx.close === 'function') {
      void this.ctx.close();
      this.ctx = null;
      this.masterGain = null;
      this.masterAnalyser = null;
    }
  }
}

let defaultGraphContext = null;

export function getDefaultAudioGraphContext() {
  if (!defaultGraphContext) {
    defaultGraphContext = new AudioGraphContext();
  }
  return defaultGraphContext;
}
