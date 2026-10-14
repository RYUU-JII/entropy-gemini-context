import { GLOBAL_SENTINEL_ENTRY_FAULT_CUES } from './nudgeGameGlobalSentinelProtocol.js';

export function sentinelFaultNoise(key) {
  const n = Math.sin(key * 12.9898 + 78.233) * 43758.5453;
  return n - Math.floor(n);
}

// Sampled states, not easing curves: briefly lose sync, reveal the surviving
// page once, then latch dark. The same clock works when frames are skipped.
export function resolveGlobalSentinelPanelFault(elapsedMs, cueIndex, key, reducedMotion = false) {
  const cue = GLOBAL_SENTINEL_ENTRY_FAULT_CUES[cueIndex];
  if (!Number.isFinite(cue)) throw new Error('GLOBAL_SENTINEL_PANEL_FAULT_CUE_INVALID');
  const age = elapsedMs - cue;
  const latchMs = 152 + Math.floor(sentinelFaultNoise(key + 31) * 54);
  if (age < -95) return { active: false, dead: false, flash: 0, driver: 0, jitter: 0, age };
  if (reducedMotion) return { active: age >= 0, dead: age >= 0, flash: 0, driver: 0, jitter: 0, age };
  const strike = age >= 0 && age < 38;
  const dropout = age >= 38 && age < 95;
  const relock = age >= 95 && age < latchMs;
  const latched = age >= latchMs;
  const ticking = latched && age < 410;
  return {
    active: true,
    dead: dropout || latched,
    // No full-field white flash: at most one fracture sector overdrives.
    flash: strike ? 0.68 : relock ? 0.13 : 0,
    driver: age < 0 ? 0.45 : strike ? 1 : dropout ? 0.07 : relock ? 0.9
      : ticking ? (Math.floor(age / 43) % 3 === 0 ? 0.86 : 0.18) : 0.13,
    jitter: age >= 0 && age < 310 ? (Math.floor(age / 31) % 2 ? -1 : 1) : 0,
    age,
  };
}

export function resolveGlobalSentinelPageFault(elapsedMs) {
  const index = GLOBAL_SENTINEL_ENTRY_FAULT_CUES.findIndex(cue => elapsedMs >= cue && elapsedMs < cue + 155);
  if (index < 0) return { active: false, index: -1, phase: 0 };
  const age = elapsedMs - GLOBAL_SENTINEL_ENTRY_FAULT_CUES[index];
  return { active: age < 38 || age >= 95, index, phase: age < 38 ? 1 : -1 };
}
