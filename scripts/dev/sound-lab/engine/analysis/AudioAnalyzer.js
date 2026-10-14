/**
 * AudioAnalyzer provides real-time time-domain (oscilloscope) and frequency-domain (FFT) analysis.
 */

export class AudioAnalyzer {
  constructor(analyserNode) {
    this.analyser = analyserNode;
    this.timeDomainData = null;
    this.frequencyData = null;

    if (this.analyser) {
      this.timeDomainData = new Uint8Array(this.analyser.frequencyBinCount);
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    }
  }

  setAnalyserNode(analyserNode) {
    this.analyser = analyserNode;
    if (this.analyser) {
      this.timeDomainData = new Uint8Array(this.analyser.frequencyBinCount);
      this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    }
  }

  getTimeDomainData() {
    if (this.analyser && this.timeDomainData) {
      this.analyser.getByteTimeDomainData(this.timeDomainData);
    }
    return this.timeDomainData;
  }

  getFrequencyData() {
    if (this.analyser && this.frequencyData) {
      this.analyser.getByteFrequencyData(this.frequencyData);
    }
    return this.frequencyData;
  }

  renderToCanvas(canvas, {
    backgroundColor = '#090b0c',
    waveformColor = '#8cb891',
    spectrumColor = 'rgba(94, 139, 99, 0.25)',
  } = {}) {
    if (!canvas || !this.analyser) return;
    const ctx = canvas.getContext('2d');
    const timeData = this.getTimeDomainData();
    const freqData = this.getFrequencyData();
    if (!timeData || !freqData) return;

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Spectrum in background
    const barWidth = (canvas.width / freqData.length) * 2.5;
    let barX = 0;
    for (let i = 0; i < freqData.length; i += 1) {
      const barHeight = (freqData[i] / 255) * (canvas.height * 0.75);
      ctx.fillStyle = spectrumColor;
      ctx.fillRect(barX, canvas.height - barHeight, barWidth - 1, barHeight);
      barX += barWidth;
    }

    // 2. Draw Waveform in foreground
    ctx.lineWidth = 2;
    ctx.strokeStyle = waveformColor;
    ctx.beginPath();

    const sliceWidth = (canvas.width * 1.0) / timeData.length;
    let x = 0;

    for (let i = 0; i < timeData.length; i += 1) {
      const v = timeData[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  }
}
