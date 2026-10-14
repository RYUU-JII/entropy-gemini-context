export const PROGRESSION_ENGINE_VERSION = 2;
export const PROGRESSION_STATE_SCHEMA_VERSION = 1;

export const PROGRESSION_PHASES = Object.freeze({
  FIRST_VISION: 'first_vision',
  SEEDLING_REALITY: 'seedling_reality',
  CULTIVATION: 'cultivation',
});

export const PROGRESSION_FIRST_VISION_STATES = Object.freeze({
  PENDING: 'pending',
  PRESENTED: 'presented',
  SPENT: 'spent',
});

export const PROGRESSION_FEATURE_STATES = Object.freeze({
  HIDDEN: 'hidden',
  REVEALED: 'revealed',
  UNLOCKED: 'unlocked',
});

export const PROGRESSION_FEATURE_KINDS = Object.freeze({
  EXPERIENCE: 'experience',
  SITE_SLOT: 'site_slot',
  ARTIFACT_FAMILY: 'artifact_family',
  ARTIFACT_CHILD: 'artifact_child',
  SYSTEM: 'system',
});

export const PROGRESSION_CONDITION_TYPES = Object.freeze({
  ALWAYS: 'always',
  FIRST_VISION_SPENT: 'firstVisionSpent',
  ACTIVE_PROTECTED_SITE_COUNT_AT_LEAST: 'activeProtectedSiteCountAtLeast',
  PROTECTED_VISIT_COUNT_AT_LEAST: 'protectedVisitCountAtLeast',
  ACTIVE_PROTECTED_DAY_COUNT_AT_LEAST: 'activeProtectedDayCountAtLeast',
  QUALIFIED_USE_DAY_COUNT_AT_LEAST: 'qualifiedUseDayCountAtLeast',
  FRICTION_SUCCESS_COUNT_AT_LEAST: 'frictionSuccessCountAtLeast',
  FEATURE_UNLOCKED: 'featureUnlocked',
  ADVANCED_MODE: 'advancedMode',
});

export const PROGRESSION_EVENT_TYPES = Object.freeze({
  FIRST_VISION_PRESENTED: 'first_vision_presented',
  FIRST_VISION_SPENT: 'first_vision_spent',
  PROTECTED_VISIT_RECORDED: 'protected_visit_recorded',
  FRICTION_SUCCESS_RECORDED: 'friction_success_recorded',
  ACTIVE_PROTECTION_DAY_RECORDED: 'active_protection_day_recorded',
  FEATURE_MANUALLY_UNLOCKED: 'feature_manually_unlocked',
  FEATURE_GRANDFATHERED: 'feature_grandfathered',
  MILESTONE_COMPLETED: 'milestone_completed',
});

export const PROGRESSION_MILESTONE_IDS = Object.freeze({
  FIRST_DASHBOARD_VISIT: 'milestone.dashboard.firstVisit',
  BONSAI_FIRST_BLOOM_OPENED: 'milestone.bonsai.firstBloomOpened',
  FIRST_PROTECTED_SITE_REGISTERED: 'milestone.registration.firstProtectedSiteRegistered',
  DIRECT_SITE_REGISTRATION_UNLOCKED: 'milestone.registration.directUnlocked',
  SITE_REGISTRATION_INVITATION_CAPACITY_1: 'milestone.registration.invitationCapacity.1',
  SITE_REGISTRATION_INVITATION_CAPACITY_2: 'milestone.registration.invitationCapacity.2',
  SITE_REGISTRATION_INVITATION_CAPACITY_3: 'milestone.registration.invitationCapacity.3',
  SITE_REGISTRATION_INVITATION_CAPACITY_4: 'milestone.registration.invitationCapacity.4',
  SITE_REGISTRATION_INVITATION_CAPACITY_5: 'milestone.registration.invitationCapacity.5',
  FIRST_PROTECTED_ENTRY: 'milestone.firstProtectedEntry',
  ARTIFACT_SHOJI_OBSERVED: 'milestone.artifact.shojiObserved',
  ARTIFACT_INITIAL_SET_REALIZED: 'milestone.artifact.initialSetRealized',
});

export const PROGRESSION_FEATURE_IDS = Object.freeze({
  FIRST_VISION: 'experience.firstVision',
  SEEDLING_REALITY: 'experience.seedlingReality',
  SITE_SLOT_1: 'site.slot.1',
  SITE_SLOT_2: 'site.slot.2',
  SITE_SLOT_3: 'site.slot.3',
  SITE_SLOT_4: 'site.slot.4',
  SITE_SLOT_5: 'site.slot.5',
  ARTIFACT_LENS: 'artifact.lens',
  ARTIFACT_LENS_GRAYSCALE: 'artifact.lens.grayscale',
  ARTIFACT_LENS_BLUR: 'artifact.lens.blur',
  ARTIFACT_LENS_BRIGHTNESS: 'artifact.lens.brightness',
  ARTIFACT_LENS_CONTRAST: 'artifact.lens.contrast',
  ARTIFACT_LENS_SATURATION: 'artifact.lens.saturation',
  ARTIFACT_BARRIER_TEXT_RHYTHM: 'artifact.barrier.textRhythm',
  ARTIFACT_BRAKE_INPUT_VISUAL_BRAKE: 'artifact.brake.inputVisualBrake',
  ARTIFACT_VEIL: 'artifact.veil',
  ARTIFACT_VEIL_TIME_SIGNALS: 'artifact.veil.timeSignals',
  ARTIFACT_VEIL_SOCIAL_METRICS: 'artifact.veil.socialMetrics',
  ARTIFACT_BARRIER_INTENT_THRESHOLD: 'artifact.barrier.intentThreshold',
  ARTIFACT_BRAKE: 'artifact.brake',
  ARTIFACT_BRAKE_SCROLL_FRICTION: 'artifact.brake.scrollFriction',
  ARTIFACT_BRAKE_NAVIGATION_BUTTON_LOCK: 'artifact.brake.navigationButtonLock',
  ARTIFACT_BARRIER: 'artifact.barrier',
  ARTIFACT_VEIL_SHORTFORM_BLOCK: 'artifact.veil.shortformBlock',
  ARTIFACT_BRAKE_SKIP_FRICTION: 'artifact.brake.skipFriction',
  ARTIFACT_BARRIER_DETOUR_SPREAD_GUARD: 'artifact.barrier.detourSpreadGuard',
  ARTIFACT_GATE: 'artifact.gate',
  ARTIFACT_GATE_ENTRY_CHECKPOINT: 'artifact.gate.entryCheckpoint',
  ARTIFACT_GATE_RETURN_GUARD: 'artifact.gate.returnGuard',
  ARTIFACT_FLARE: 'artifact.flare',
  ARTIFACT_FLARE_SENTINEL: 'artifact.flare.sentinelFlare',
  ARTIFACT_ECHO: 'artifact.echo',
  ARTIFACT_ECHO_HISTORY_CLEANUP: 'artifact.echo.historyCleanup',
  ARTIFACT_ECHO_BOOKMARK_CONCEAL: 'artifact.echo.bookmarkConceal',
});

export const PROGRESSION_SITE_SLOT_FEATURE_IDS = Object.freeze([
  PROGRESSION_FEATURE_IDS.SITE_SLOT_1,
  PROGRESSION_FEATURE_IDS.SITE_SLOT_2,
  PROGRESSION_FEATURE_IDS.SITE_SLOT_3,
  PROGRESSION_FEATURE_IDS.SITE_SLOT_4,
  PROGRESSION_FEATURE_IDS.SITE_SLOT_5,
]);

export function isProgressionFeatureId(value) {
  return typeof value === 'string'
    && Object.values(PROGRESSION_FEATURE_IDS).includes(value.trim());
}
