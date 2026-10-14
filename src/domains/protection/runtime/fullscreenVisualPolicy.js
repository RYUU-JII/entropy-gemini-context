import { FRICTION_INTENSITY_BANDS } from '../../settings/config/frictionIntensityBands.js';
import { materializeAdaptiveFrictionEntry, requireAdaptiveFrictionEntry } from '../../settings/config/adaptiveFrictionProfiles.js';
import { VISUAL_FRICTION_FEATURE_KEYS } from '../../settings/config/visualFrictionProfiles.js';

export const FULLSCREEN_VISUAL_FEATURE_KEYS = VISUAL_FRICTION_FEATURE_KEYS;
export const FULLSCREEN_VISUAL_POLICIES = Object.freeze({
  STEP_DOWN: 'step_down',
  SUSPEND: 'suspend_visuals',
  BLOCKED: 'blocked',
});

const STEP_DOWN_BAND = Object.freeze({
  [FRICTION_INTENSITY_BANDS.REINFORCED]: FRICTION_INTENSITY_BANDS.NORMAL,
  [FRICTION_INTENSITY_BANDS.NORMAL]: FRICTION_INTENSITY_BANDS.RELAXED,
  // A low band alone never grants unfiltered viewing. Only an explicit policy can.
  [FRICTION_INTENSITY_BANDS.RELAXED]: FRICTION_INTENSITY_BANDS.RELAXED,
});

export function resolveFullscreenVisualPolicy({ targetOverrun, scheduleRelaxation }) {
  if (typeof targetOverrun !== 'boolean' || typeof scheduleRelaxation !== 'boolean') {
    throw new Error('FULLSCREEN_VISUAL_POLICY_FACTS_INVALID');
  }
  if (targetOverrun) return FULLSCREEN_VISUAL_POLICIES.BLOCKED;
  return scheduleRelaxation ? FULLSCREEN_VISUAL_POLICIES.SUSPEND : FULLSCREEN_VISUAL_POLICIES.STEP_DOWN;
}

export function requireFullscreenVisualPolicy(policy) {
  if (!Object.values(FULLSCREEN_VISUAL_POLICIES).includes(policy)) {
    throw new Error(`FULLSCREEN_VISUAL_POLICY_INVALID:${String(policy)}`);
  }
  return policy;
}

const FULLSCREEN_TRANSFORMS = Object.freeze({
  [FULLSCREEN_VISUAL_POLICIES.BLOCKED]: (_key, entry) => entry,
  [FULLSCREEN_VISUAL_POLICIES.SUSPEND]: (_key, entry) => ({
    ...entry, isActive: false, visualSuspensionReason: 'scheduled_fullscreen',
  }),
  [FULLSCREEN_VISUAL_POLICIES.STEP_DOWN]: (key, entry) => materializeAdaptiveFrictionEntry(
    key, { ...entry, value: entry.strength }, STEP_DOWN_BAND[entry.band],
  ),
});

// Consumes one background policy, never the previously rendered result.
// No settings writes, source-specific decisions, timers, or DOM access here.
export function applyFullscreenVisualPolicy(filters, { videoFullscreen }) {
  if (typeof videoFullscreen !== 'boolean') throw new Error('VIDEO_FULLSCREEN_STATE_INVALID');
  const resolved = { ...filters };
  for (const key of FULLSCREEN_VISUAL_FEATURE_KEYS) {
    const entry = filters[key];
    if (!entry) continue;
    requireAdaptiveFrictionEntry(key, entry);
    const policy = requireFullscreenVisualPolicy(entry.fullscreenPolicy);
    if (videoFullscreen && entry.isActive) resolved[key] = FULLSCREEN_TRANSFORMS[policy](key, entry);
  }
  return resolved;
}
