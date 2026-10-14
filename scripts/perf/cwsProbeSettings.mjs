import {
  CANONICAL_CLICK_DELAY_PROFILE,
  CANONICAL_SCROLL_FRICTION_PROFILE,
} from '../../src/domains/settings/config/canonicalBinaryFilterProfiles.js';
import { DEFAULT_NUDGE_SETTINGS } from '../../src/domains/settings/config/nudgeConfig.js';
import { DEFAULT_GATE_CONFIG } from '../../src/domains/settings/config/gateConfig.js';
import { DEFAULT_VIDEO_SKIP_GUARD_VALUE } from '../../src/domains/settings/config/videoSkipGuard.js';
import { DEFAULT_INFINITE_SCROLL_GUARD_VALUE } from '../../src/domains/settings/config/infiniteScrollGuard.js';
import { CONFIG_DEFAULT_INPUT_DELAY_MS } from '../../src/domains/settings/config/index.js';

// Shared by the CWS resource and MV3 lifecycle workloads. The settings command
// validates this intent; do not normalize away unsupported fields in the harness.
export function buildCwsProbeSettings() {
  return {
    filteringMode: 'blocklist',
    permissionMode: 'selective',
    rulesMode: 'managed',
    gateConfig: {
      entryCheckpoint: { enabled: false },
      returnGuard: { enabled: false },
      detourSpreadGuard: { ...DEFAULT_GATE_CONFIG.detourSpreadGuard },
    },
    nudgeConfig: structuredClone(DEFAULT_NUDGE_SETTINGS),
    filterSettings: {
      blur: { isActive: true, value: 20 },
      saturation: { isActive: true, value: 70 },
      textRhythm: { isActive: true, value: true },
      socialMetrics: {
        isActive: true,
        value: {
          feedbackCounts: true,
          viewCounts: true,
          timeSignals: true,
          audienceCounts: true,
        },
      },
      scrollFriction: { isActive: true, value: CANONICAL_SCROLL_FRICTION_PROFILE.delayMs },
      clickDelay: { isActive: false, value: CANONICAL_CLICK_DELAY_PROFILE.delayMs },
      inputDelay: { isActive: false, value: CONFIG_DEFAULT_INPUT_DELAY_MS },
      videoSkipGuard: { isActive: false, value: { ...DEFAULT_VIDEO_SKIP_GUARD_VALUE } },
      shortFormBlock: { isActive: false, value: '' },
      infiniteScrollGuard: { isActive: false, value: { ...DEFAULT_INFINITE_SCROLL_GUARD_VALUE } },
    },
  };
}
