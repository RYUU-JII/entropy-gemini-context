/**
 * ZenGlobalSentinelRiftSynth - Physical & Digital Glitch Synthesizer for Global Sentinel Rift Protocol.
 * Synthesizes simulation fracture, LCD rupture, repair telegraph tension drone,
 * intervention hit crack, terminal dimensional breach shockwave, and failure resync seal.
 */

import { NoiseGenerator } from '../../primitives/NoiseGenerator.js';
import { TransientChirp } from '../../primitives/TransientChirp.js';
import { ModalResonanceBank } from '../../primitives/ModalResonanceBank.js';

export class ZenGlobalSentinelRiftSynth {
  /**
   * 1. Simulation Rupture (시뮬레이션 균열 & 액정 파열음)
   * 스타터 잉어 가격 순간: 3.8kHz LCD 파쇄음 + 120Hz->45Hz 백라이트 에너지 서브 + 디지털 잉크 글리치
   */
  static playSimulationRupture(ctx, destination, {
    intensity = 0.85,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.3, Number(intensity) || 0.85));
    const duration = 0.7;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.35 * safeIntensity, now);
    master.connect(destination);

    // 1. High LCD Glass Fracture Transient (3.8 kHz Burst)
    NoiseGenerator.scheduleBurst(ctx, master, {
      startAt: now,
      duration: 0.035,
      gain: 0.75 * safeIntensity,
      filterType: 'bandpass',
      filterFrequency: 3800,
      filterQ: 4.2,
    });

    // Fast pitch-drop glass fracture snap
    TransientChirp.schedule(ctx, master, {
      startAt: now,
      startFreq: 6200,
      endFreq: 1200,
      duration: 0.025,
      gain: 0.60 * safeIntensity,
    });

    // 2. Backlight Energy Pop Sub (120Hz -> 45Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(120, now);
    subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.22);

    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.65 * safeIntensity, now + 0.005);
    subGain.gain.exponentialRampToValueAtTime(0.00001, now + 0.35);

    subOsc.connect(subGain);
    subGain.connect(master);
    subOsc.start(now);
    subOsc.stop(now + 0.38);

    // 3. Digital Ink Dispersion Stutter Burst (3 micro-clicks)
    const stutterOffsets = [0.04, 0.09, 0.15];
    stutterOffsets.forEach((offset, idx) => {
      NoiseGenerator.scheduleBurst(ctx, master, {
        startAt: now + offset,
        duration: 0.012,
        gain: (0.40 - idx * 0.08) * safeIntensity,
        filterType: 'bandpass',
        filterFrequency: 2200 + idx * 800,
        filterQ: 6.0,
      });
    });

    return true;
  }

  /**
   * 2. Repair Telegraph (시스템 수리 접근 경고음 & 텐션 드론)
   * 센티넬이 다가올 때: 240Hz->520Hz 상승 텐션 글리치 드론 + 16Hz 클럭 스터터 펄스
   */
  static playRepairTelegraph(ctx, destination, {
    intensity = 0.8,
    duration = 2.5,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.3, Number(intensity) || 0.8));

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.30 * safeIntensity, now);
    master.connect(destination);

    // 1. Rising Tension Glitch Saw Drone (240Hz -> 520Hz)
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gainNode = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + duration * 0.85);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(480, now);
    filter.frequency.exponentialRampToValueAtTime(1400, now + duration * 0.85);
    filter.Q.setValueAtTime(4.5, now);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(0.55 * safeIntensity, now + 0.3);
    gainNode.gain.setValueAtTime(0.55 * safeIntensity, now + duration - 0.4);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    // 2. 16Hz Digital Clock Jitter Pulse (Tremolo LFO)
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(16, now);
    lfo.frequency.linearRampToValueAtTime(28, now + duration); // accelerating clock

    lfoGain.gain.setValueAtTime(0.25, now);
    lfo.connect(lfoGain.gain);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(master);

    osc.start(now);
    osc.stop(now + duration + 0.05);

    // 3. Sub-Pressure Building Wave (65Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(65, now);
    subOsc.frequency.exponentialRampToValueAtTime(85, now + duration);

    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.40 * safeIntensity, now + 0.5);
    subGain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    subOsc.connect(subGain);
    subGain.connect(master);
    subOsc.start(now);
    subOsc.stop(now + duration + 0.05);

    return true;
  }

  /**
   * 3. Intervention Hit (타이밍 개입 타격 & 글리치 크랙)
   * 수리 레일 분쇄: 3.4kHz 글리치 스냅 + 디퀀타이즈 버즈 + 85Hz 서브 킥 반발
   */
  static playInterventionHit(ctx, destination, {
    intensity = 0.85,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.002;
    const safeIntensity = Math.max(0.2, Math.min(1.3, Number(intensity) || 0.85));
    const duration = 0.45;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.36 * safeIntensity, now);
    master.connect(destination);

    // 1. Hard Glass Crack Shock (3.4 kHz Resonant Burst)
    NoiseGenerator.scheduleBurst(ctx, master, {
      startAt: now,
      duration: 0.028,
      gain: 0.80 * safeIntensity,
      filterType: 'bandpass',
      filterFrequency: 3400,
      filterQ: 5.0,
    });

    // 2. Digital De-quantize Buzz Snap (720Hz -> 210Hz)
    const buzzOsc = ctx.createOscillator();
    const buzzGain = ctx.createGain();
    buzzOsc.type = 'sawtooth';
    buzzOsc.frequency.setValueAtTime(720, now);
    buzzOsc.frequency.exponentialRampToValueAtTime(210, now + 0.04);

    buzzGain.gain.setValueAtTime(0.0001, now);
    buzzGain.gain.linearRampToValueAtTime(0.60 * safeIntensity, now + 0.002);
    buzzGain.gain.exponentialRampToValueAtTime(0.00001, now + 0.08);

    buzzOsc.connect(buzzGain);
    buzzGain.connect(master);
    buzzOsc.start(now);
    buzzOsc.stop(now + 0.09);

    // 3. Sub Kick Rebound (85Hz -> 42Hz)
    const kickOsc = ctx.createOscillator();
    const kickGain = ctx.createGain();
    kickOsc.type = 'sine';
    kickOsc.frequency.setValueAtTime(85, now);
    kickOsc.frequency.exponentialRampToValueAtTime(42, now + 0.18);

    kickGain.gain.setValueAtTime(0.0001, now);
    kickGain.gain.linearRampToValueAtTime(0.70 * safeIntensity, now + 0.003);
    kickGain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    kickOsc.connect(kickGain);
    kickGain.connect(master);
    kickOsc.start(now);
    kickOsc.stop(now + duration + 0.02);

    return true;
  }

  /**
   * 4. Terminal Breach (최종 차원 돌파 & 센티넬 축출음)
   * 4회 타격 성공: 55Hz 초저역 충격파 + 4.2kHz 유리 파편 캐스케이드 + 1200Hz->80Hz 차원 역흡입
   */
  static playTerminalBreach(ctx, destination, {
    intensity = 0.9,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.4, Number(intensity) || 0.9));
    const duration = 1.8;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.38 * safeIntensity, now);
    master.connect(destination);

    // 1. Massive Spatial Sub Shockwave (55Hz -> 28Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(55, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.9);

    subGain.gain.setValueAtTime(0.0001, now);
    subGain.gain.linearRampToValueAtTime(0.85 * safeIntensity, now + 0.02);
    subGain.gain.exponentialRampToValueAtTime(0.00001, now + 1.4);

    subOsc.connect(subGain);
    subGain.connect(master);
    subOsc.start(now);
    subOsc.stop(now + 1.45);

    // 2. Glass Shatter Cascade (Multi-burst shards)
    const shatterTimes = [0.0, 0.04, 0.09, 0.16, 0.25];
    shatterTimes.forEach((offset, idx) => {
      NoiseGenerator.scheduleBurst(ctx, master, {
        startAt: now + offset,
        duration: 0.035,
        gain: (0.75 - idx * 0.1) * safeIntensity,
        filterType: 'bandpass',
        filterFrequency: 4200 + (idx % 3) * 600,
        filterQ: 4.8,
      });
    });

    // 3. Dimensional Suction Void (1200Hz -> 80Hz Sweep)
    const noiseBuffer = NoiseGenerator.getPinkNoiseBuffer(ctx, duration + 0.2);
    const voidSrc = ctx.createBufferSource();
    voidSrc.buffer = noiseBuffer;

    const voidFilter = ctx.createBiquadFilter();
    voidFilter.type = 'bandpass';
    voidFilter.frequency.setValueAtTime(1200, now);
    voidFilter.frequency.exponentialRampToValueAtTime(80, now + duration * 0.75);
    voidFilter.Q.setValueAtTime(6.0, now);

    const voidGain = ctx.createGain();
    voidGain.gain.setValueAtTime(0.0001, now);
    voidGain.gain.linearRampToValueAtTime(0.65 * safeIntensity, now + 0.15);
    voidGain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    voidSrc.connect(voidFilter);
    voidFilter.connect(voidGain);
    voidGain.connect(master);
    voidSrc.start(now);
    voidSrc.stop(now + duration + 0.05);

    return true;
  }

  /**
   * 5. Failure Resync Seal (실패 강제 표백 봉합음)
   * 타이밍 실패: 840Hz 메탈릭 락킹 + 화이트아웃 시즐 감쇠 + 90Hz 에러 흡수
   */
  static playFailureSeal(ctx, destination, {
    intensity = 0.75,
    startAt = null,
  } = {}) {
    const now = startAt !== null ? startAt : ctx.currentTime + 0.003;
    const safeIntensity = Math.max(0.2, Math.min(1.2, Number(intensity) || 0.75));
    const duration = 1.2;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.32 * safeIntensity, now);
    master.connect(destination);

    // 1. Cold Metallic Lock Clang (840Hz & 1680Hz)
    ModalResonanceBank.schedulePartial(ctx, master, {
      frequency: 840,
      startAt: now,
      duration: 0.35,
      gain: 0.60 * safeIntensity,
      type: 'triangle',
    });
    ModalResonanceBank.schedulePartial(ctx, master, {
      frequency: 1680,
      startAt: now,
      duration: 0.22,
      gain: 0.40 * safeIntensity,
      type: 'sine',
    });

    // 2. Whiteout Digital Bleach Sizzle
    const noiseBuffer = NoiseGenerator.getWhiteNoiseBuffer(ctx, duration + 0.2);
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.frequency.exponentialRampToValueAtTime(6000, now + duration * 0.6);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.linearRampToValueAtTime(0.45 * safeIntensity, now + 0.02);
    noiseGain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

    noiseSrc.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(master);
    noiseSrc.start(now);
    noiseSrc.stop(now + duration + 0.05);

    // 3. Low Error Absorption Thud (90Hz -> 38Hz)
    const thudOsc = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = 'sine';
    thudOsc.frequency.setValueAtTime(90, now);
    thudOsc.frequency.exponentialRampToValueAtTime(38, now + 0.25);

    thudGain.gain.setValueAtTime(0.0001, now);
    thudGain.gain.linearRampToValueAtTime(0.50 * safeIntensity, now + 0.005);
    thudGain.gain.exponentialRampToValueAtTime(0.00001, now + 0.4);

    thudOsc.connect(thudGain);
    thudGain.connect(master);
    thudOsc.start(now);
    thudOsc.stop(now + 0.45);

    return true;
  }
}
