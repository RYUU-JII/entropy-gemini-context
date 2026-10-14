/**
 * Offline WAV Renderer for Sound Lab.
 * Synthesizes procedural audio for Inverted Glass Cup + Solid Glass Rod Furin with 14ms offset.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function writeWavFile(filePath, samples, sampleRate = 44100) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intSample = s < 0 ? s * 0x8000 : s * 0x7FFF;
    buffer.writeInt16LE(Math.floor(intSample), offset);
    offset += 2;
  }

  fs.writeFileSync(filePath, buffer);
}

export function synthesizeGlassCupAndRodFurinOffset({
  fCup = 3136, // G7 (Inverted Glass Cup)
  durationSeconds = 1.35,
  sampleRate = 44100,
} = {}) {
  const fRod = fCup * 1.578; // 4950 Hz (Solid Glass Rod)
  const fFlash = fCup * 2.63; // 8250 Hz
  const totalSamples = Math.floor(sampleRate * durationSeconds);
  const samples = new Float32Array(totalSamples);

  // 1. Pure Elastic Strike Flash (t = 0ms, 8250 Hz, 0.06s)
  const flashSamples = Math.floor(sampleRate * 0.06);
  for (let i = 0; i < Math.min(totalSamples, flashSamples); i += 1) {
    const t = i / sampleRate;
    const attack = Math.min(1.0, t / 0.0002);
    const decay = Math.exp(-t / 0.012);
    samples[i] += Math.sin(2 * Math.PI * fFlash * t) * 0.22 * attack * decay;
  }

  // 2. LAYER 2: Solid Glass Rod Striker (t = 0ms, 4950 Hz, 0.48s)
  const rodSamples = Math.floor(sampleRate * 0.48);
  const fRodTwin = fRod + 2.4;
  for (let i = 0; i < Math.min(totalSamples, rodSamples); i += 1) {
    const t = i / sampleRate;
    const attack = Math.min(1.0, t / 0.0003);
    const decay = Math.exp(-t / 0.10);
    const mainRod = Math.sin(2 * Math.PI * fRod * t) * 0.58 * decay;
    const twinRod = Math.sin(2 * Math.PI * fRodTwin * t) * 0.36 * Math.exp(-t / 0.085);
    samples[i] += (mainRod + twinRod) * attack;
  }

  // 3. LAYER 1: Inverted Glass Cup (t = +14ms, 3136 Hz, 1.30s 2-Stage Convex Damping)
  const cupOffsetSample = Math.floor(sampleRate * 0.014); // +14ms offset!
  const cupSamples = Math.floor(sampleRate * 1.30);
  const stage1Samples = Math.floor(sampleRate * 0.12);
  const fCupTwin = fCup + 3.2;

  for (let i = 0; i < cupSamples; i += 1) {
    const sampleIdx = cupOffsetSample + i;
    if (sampleIdx >= totalSamples) break;
    const t = i / sampleRate;
    const attack = Math.min(1.0, t / 0.0004);

    let decayFactor;
    if (i < stage1Samples) {
      const s1Progress = i / stage1Samples;
      decayFactor = Math.exp(-s1Progress * 0.97);
    } else {
      const s2Progress = (i - stage1Samples) / (cupSamples - stage1Samples);
      decayFactor = 0.38 * Math.exp(-s2Progress * 5.2);
    }

    const mainCup = Math.sin(2 * Math.PI * fCup * t) * 0.65 * decayFactor;
    const twinCup = Math.sin(2 * Math.PI * fCupTwin * t) * 0.42 * decayFactor;
    samples[sampleIdx] += (mainCup + twinCup) * attack;
  }

  // Normalize
  let maxPeak = 0;
  for (let i = 0; i < totalSamples; i += 1) {
    const abs = Math.abs(samples[i]);
    if (abs > maxPeak) maxPeak = abs;
  }
  if (maxPeak > 0) {
    const scale = 0.82 / maxPeak;
    for (let i = 0; i < totalSamples; i += 1) {
      samples[i] *= scale;
    }
  }

  return samples;
}

const outputPath = path.resolve(__dirname, 'browser/furin-glass-clink-rendered.wav');
const samples = synthesizeGlassCupAndRodFurinOffset({ fCup: 3136, durationSeconds: 1.35 });
writeWavFile(outputPath, samples);
console.log(`Updated 14ms-Offset Furin WAV rendered to: ${outputPath}`);
