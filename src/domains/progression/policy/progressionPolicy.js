import {
  PROGRESSION_CONDITION_TYPES,
  PROGRESSION_FEATURE_IDS,
  PROGRESSION_MILESTONE_IDS,
} from '../contracts/progressionIds.js';
import {
  ARTIFACT_DISCLOSURE_FAMILY_ORDER,
} from './artifactDisclosurePolicy.js';
import {
  PROGRESSION_BONSAI_RELEASE_STAGE_IDS,
  PROGRESSION_BONSAI_RELEASE_STAGES,
  PROGRESSION_UNLOCK_BONSAI_FULL_FORM_SCORE,
  PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT,
  buildProgressionBonsaiRelease,
} from '../contracts/progressionBonsaiRelease.js';
import { resolveProgressionSiteSlotUnlockDay } from './progressionRegistrationPolicy.js';
import { DEFAULT_ACTIVITY_DAY_RESET_HOUR } from '../../stats/shared/activityDay.js';
import { requireQualifiedUseDayCount } from '../contracts/qualifiedUseFacts.js';

const {
  FIRST_VISION_SPENT,
  QUALIFIED_USE_DAY_COUNT_AT_LEAST,
} = PROGRESSION_CONDITION_TYPES;

const {
  ARTIFACT_BARRIER,
  ARTIFACT_VEIL_SHORTFORM_BLOCK,
  ARTIFACT_BRAKE_SKIP_FRICTION,
  ARTIFACT_BARRIER_DETOUR_SPREAD_GUARD,
  ARTIFACT_BRAKE,
  ARTIFACT_BRAKE_NAVIGATION_BUTTON_LOCK,
  ARTIFACT_BRAKE_SCROLL_FRICTION,
  ARTIFACT_ECHO,
  ARTIFACT_ECHO_BOOKMARK_CONCEAL,
  ARTIFACT_ECHO_HISTORY_CLEANUP,
  ARTIFACT_FLARE,
  ARTIFACT_FLARE_SENTINEL,
  ARTIFACT_GATE,
  ARTIFACT_GATE_ENTRY_CHECKPOINT,
  ARTIFACT_GATE_RETURN_GUARD,
  ARTIFACT_LENS,
  ARTIFACT_LENS_BLUR,
  ARTIFACT_LENS_BRIGHTNESS,
  ARTIFACT_LENS_CONTRAST,
  ARTIFACT_LENS_GRAYSCALE,
  ARTIFACT_LENS_SATURATION,
  ARTIFACT_BRAKE_INPUT_VISUAL_BRAKE,
  ARTIFACT_BARRIER_TEXT_RHYTHM,
  ARTIFACT_VEIL,
  ARTIFACT_BARRIER_INTENT_THRESHOLD,
  ARTIFACT_VEIL_SOCIAL_METRICS,
  ARTIFACT_VEIL_TIME_SIGNALS,
  SITE_SLOT_1,
  SITE_SLOT_2,
  SITE_SLOT_3,
  SITE_SLOT_4,
  SITE_SLOT_5,
} = PROGRESSION_FEATURE_IDS;

export const PROGRESSION_UNLOCK_PRESENTATION_MODES = Object.freeze({
  QUIET: 'quiet',
  CEREMONIAL: 'ceremonial',
  SILHOUETTE: 'silhouette',
});

export const PROGRESSION_ARTIFACT_DISCLOSURE_GROUP_IDS = Object.freeze({
  FOUNDATION: 'foundation',
  GROUNDING: 'grounding',
  INTEGRATION: 'integration',
  BARRIER_EVIDENCE: 'barrier_evidence',
  FINAL_REFLECTION: 'final_reflection',
});

export const PROGRESSION_BONSAI_GROWTH_STAGE_IDS = PROGRESSION_BONSAI_RELEASE_STAGE_IDS;

function freezeArray(items) {
  return Object.freeze(items.map((item) => Object.freeze({ ...item })));
}

function condition(type, count = null) {
  return Object.freeze(count === null ? { type } : { type, count });
}

function all(...groups) {
  return freezeArray(groups.flat());
}

function qualifiedDaysAtLeast(count) {
  return freezeArray([condition(QUALIFIED_USE_DAY_COUNT_AT_LEAST, count)]);
}

const afterFirstVision = freezeArray([condition(FIRST_VISION_SPENT)]);

export const PROGRESSION_EXPERIENCE_PRESENTATION_POLICY = Object.freeze({
  firstVision: Object.freeze({
    artifactPresentation: 'visual_summary_only',
    artifactInteraction: 'name_visual_description',
    artifactConfiguration: 'none',
    artifactRuntimeChanges: 'none',
    transitionGate: Object.freeze({
      minimumVisionDurationMs: 12000,
      descentDelayAfterTriggerMs: 2800,
    }),
  }),
  seedlingReality: Object.freeze({
    activeProtectedSiteSlots: 1,
    bonsaiForm: 'lively_seedling',
    emptyGardenInvitationKoi: Object.freeze({
      enabled: true,
      target: 'protected_site_registration',
      scale: 'slightly_larger',
      outline: 'breathing_glow',
      feedback: 'hover_and_click',
    }),
  }),
});

export const PROGRESSION_BONSAI_GROWTH_POLICY = Object.freeze({
  scoreMax: 100,
  sources: freezeArray([
    {
      id: 'unlockDays',
      factKey: 'qualifiedUseDayCount',
      maxPoints: PROGRESSION_UNLOCK_BONSAI_FULL_FORM_SCORE,
      cap: PROGRESSION_BONSAI_FULL_FORM_DAY_COUNT,
    },
  ]),
  stages: PROGRESSION_BONSAI_RELEASE_STAGES,
});

export const PROGRESSION_SITE_SLOT_POLICY = Object.freeze([
  SITE_SLOT_1, SITE_SLOT_2, SITE_SLOT_3, SITE_SLOT_4, SITE_SLOT_5,
].map((featureId, index) => {
  const slotIndex = index + 1;
  const unlockDay = resolveProgressionSiteSlotUnlockDay(slotIndex);
  return Object.freeze({ featureId, slotIndex, unlockDay,
    reveal: afterFirstVision,
    unlock: unlockDay === 0 ? afterFirstVision : all(afterFirstVision, qualifiedDaysAtLeast(unlockDay)),
    presentationMode: PROGRESSION_UNLOCK_PRESENTATION_MODES.QUIET });
}));

export const PROGRESSION_SITE_SLOT_POLICY_BY_FEATURE_ID = Object.freeze(
  PROGRESSION_SITE_SLOT_POLICY.reduce((acc, entry) => {
    acc[entry.featureId] = entry;
    return acc;
  }, {}),
);

const PROGRESSION_ARTIFACT_POLICY_DEFINITION = Object.freeze({
  firstVisionPresentation: 'visual_summary_only',
  initialFamilyFeatureIds: Object.freeze([
    ARTIFACT_LENS,
    ARTIFACT_GATE,
    ARTIFACT_FLARE,
  ]),
  initialChildFeatureIds: Object.freeze([
    ARTIFACT_LENS_GRAYSCALE,
    ARTIFACT_LENS_BLUR,
    ARTIFACT_LENS_BRIGHTNESS,
    ARTIFACT_LENS_CONTRAST,
    ARTIFACT_LENS_SATURATION,
    ARTIFACT_BARRIER_TEXT_RHYTHM,
    ARTIFACT_BRAKE_INPUT_VISUAL_BRAKE,
    ARTIFACT_GATE_ENTRY_CHECKPOINT,
    ARTIFACT_GATE_RETURN_GUARD,
    ARTIFACT_FLARE_SENTINEL,
  ]),
  initialSetRealization: Object.freeze({
    mode: PROGRESSION_UNLOCK_PRESENTATION_MODES.CEREMONIAL,
    representativeFeatureId: ARTIFACT_LENS,
    triggerMilestoneId: PROGRESSION_MILESTONE_IDS.FIRST_PROTECTED_ENTRY,
    observedMilestoneId: PROGRESSION_MILESTONE_IDS.ARTIFACT_SHOJI_OBSERVED,
    realizedMilestoneId: PROGRESSION_MILESTONE_IDS.ARTIFACT_INITIAL_SET_REALIZED,
    ceremonyId: 'shoji_cube_radiance',
    visual: 'shoji_cube_faces_emit_light_then_apply_filter',
    realizesFeatureIds: Object.freeze([
      ARTIFACT_LENS,
    ]),
  }),
  sequence: Object.freeze({
    firstArtifactId: 'lens',
    finalArtifactId: 'veil',
    defaultOrder: ARTIFACT_DISCLOSURE_FAMILY_ORDER,
    disclosureCadence: Object.freeze({
      mode: 'activity_day',
      resetHour: DEFAULT_ACTIVITY_DAY_RESET_HOUR,
      initialVisibleCount: 3,
      artifactsPerCycle: 1,
      boundaryContinuityGraceMs: 0,
    }),
    groups: Object.freeze([
      Object.freeze({
        id: PROGRESSION_ARTIFACT_DISCLOSURE_GROUP_IDS.FOUNDATION,
        artifactIds: Object.freeze(['lens']),
        meaning: 'First visible proof that protection changes the surface.',
      }),
      Object.freeze({
        id: PROGRESSION_ARTIFACT_DISCLOSURE_GROUP_IDS.GROUNDING,
        artifactIds: Object.freeze(['brake', 'gate']),
        meaning: 'Low-level body rhythm and threshold friction.',
      }),
      Object.freeze({
        id: PROGRESSION_ARTIFACT_DISCLOSURE_GROUP_IDS.INTEGRATION,
        artifactIds: Object.freeze(['echo', 'flare']),
        meaning: 'Cleanup and time-bound awareness after the first frictions are established.',
      }),
      Object.freeze({
        id: PROGRESSION_ARTIFACT_DISCLOSURE_GROUP_IDS.BARRIER_EVIDENCE,
        artifactIds: Object.freeze(['barrier']),
        meaning: 'Barrier evidence remains observational and never changes durable disclosure order.',
      }),
      Object.freeze({
        id: PROGRESSION_ARTIFACT_DISCLOSURE_GROUP_IDS.FINAL_REFLECTION,
        artifactIds: Object.freeze(['veil']),
        meaning: 'Final Enso reflection after every practical friction has appeared.',
      }),
    ]),
    supportSignals: Object.freeze({
      artifactIds: Object.freeze(['brake', 'gate', 'echo', 'flare']),
      defaultOrder: Object.freeze(['brake', 'gate', 'echo', 'flare']),
      signalWeights: Object.freeze({
        brake: Object.freeze({
          scrollFriction: 0.55,
          navigationButtonLock: 0.32,
          scrollMomentum: 0.35,
          rapidScroll: 0.25,
        }),
        gate: Object.freeze({
          entryCheckpoint: 0.30,
          returnGuard: 0.42,
          rapidReturn: 0.45,
          protectedEntry: 0.20,
        }),
        echo: Object.freeze({
          historyCleanup: 0.34,
          bookmarkConceal: 0.34,
          traceReuse: 0.45,
          shortcutEntry: 0.25,
        }),
        flare: Object.freeze({
          sentinelFlare: 0.34,
          targetOverrun: 0.50,
          timeBudget: 0.42,
          longSession: 0.25,
        }),
      }),
    }),
    // Experiment-only evidence model. Durable disclosure always uses
    // ARTIFACT_DISCLOSURE_FAMILY_ORDER and never consumes these scores.
    barrierEvidence: Object.freeze({
      artifactId: 'barrier',
      defaultBand: 'baseline',
      bands: Object.freeze({
        strong: Object.freeze({
          minScore: 0.62,
        }),
        moderate: Object.freeze({
          minScore: 0.28,
        }),
        baseline: Object.freeze({
          minScore: -1,
        }),
      }),
      basePriority: -0.42,
      configuredSignalScale: 0.35,
      signalWeights: Object.freeze({
        intentThreshold: 0.56,
        textRhythm: 0.50,
        detourSpreadGuard: 0.26,
      }),
      interpretationKey: 'barrier_evidence_observation_only',
    }),
  }),
  featureMetadata: Object.freeze({
    [ARTIFACT_LENS]: Object.freeze({
      artifactId: 'lens',
    }),
    [ARTIFACT_LENS_GRAYSCALE]: Object.freeze({
      artifactId: 'lens',
      childId: 'grayscale',
    }),
    [ARTIFACT_LENS_BLUR]: Object.freeze({
      artifactId: 'lens',
      childId: 'blur',
    }),
    [ARTIFACT_LENS_BRIGHTNESS]: Object.freeze({
      artifactId: 'lens',
      childId: 'brightness',
    }),
    [ARTIFACT_LENS_CONTRAST]: Object.freeze({
      artifactId: 'lens',
      childId: 'contrast',
    }),
    [ARTIFACT_LENS_SATURATION]: Object.freeze({
      artifactId: 'lens',
      childId: 'saturation',
    }),
    [ARTIFACT_BARRIER_TEXT_RHYTHM]: Object.freeze({
      artifactId: 'barrier',
      childId: 'textRhythm',
    }),
    [ARTIFACT_BRAKE_INPUT_VISUAL_BRAKE]: Object.freeze({
      artifactId: 'brake',
      childId: 'inputVisualBrake',
    }),
    [ARTIFACT_VEIL]: Object.freeze({
      artifactId: 'veil',
    }),
    [ARTIFACT_VEIL_TIME_SIGNALS]: Object.freeze({
      artifactId: 'veil',
      childId: 'timeSignals',
    }),
    [ARTIFACT_VEIL_SOCIAL_METRICS]: Object.freeze({
      artifactId: 'veil',
      childId: 'socialMetrics',
    }),
    [ARTIFACT_BRAKE]: Object.freeze({
      artifactId: 'brake',
    }),
    [ARTIFACT_BARRIER_INTENT_THRESHOLD]: Object.freeze({
      artifactId: 'barrier',
      childId: 'intentThreshold',
    }),
    [ARTIFACT_BRAKE_SCROLL_FRICTION]: Object.freeze({
      artifactId: 'brake',
      childId: 'scrollFriction',
    }),
    [ARTIFACT_BRAKE_NAVIGATION_BUTTON_LOCK]: Object.freeze({
      artifactId: 'brake',
      childId: 'navigationButtonLock',
    }),
    [ARTIFACT_GATE]: Object.freeze({
      artifactId: 'gate',
    }),
    [ARTIFACT_GATE_ENTRY_CHECKPOINT]: Object.freeze({
      artifactId: 'gate',
      childId: 'entryCheckpoint',
    }),
    [ARTIFACT_GATE_RETURN_GUARD]: Object.freeze({
      artifactId: 'gate',
      childId: 'returnGuard',
    }),
    [ARTIFACT_BARRIER]: Object.freeze({
      artifactId: 'barrier',
    }),
    [ARTIFACT_VEIL_SHORTFORM_BLOCK]: Object.freeze({
      artifactId: 'veil',
      childId: 'shortformBlock',
    }),
    [ARTIFACT_BRAKE_SKIP_FRICTION]: Object.freeze({
      artifactId: 'brake',
      childId: 'skipFriction',
    }),
    [ARTIFACT_BARRIER_DETOUR_SPREAD_GUARD]: Object.freeze({
      artifactId: 'barrier',
      childId: 'detourSpreadGuard',
    }),
    [ARTIFACT_FLARE]: Object.freeze({
      artifactId: 'flare',
    }),
    [ARTIFACT_FLARE_SENTINEL]: Object.freeze({
      artifactId: 'flare',
      childId: 'sentinelFlare',
    }),
    [ARTIFACT_ECHO]: Object.freeze({
      artifactId: 'echo',
    }),
    [ARTIFACT_ECHO_HISTORY_CLEANUP]: Object.freeze({
      artifactId: 'echo',
      childId: 'historyCleanup',
    }),
    [ARTIFACT_ECHO_BOOKMARK_CONCEAL]: Object.freeze({
      artifactId: 'echo',
      childId: 'bookmarkConceal',
    }),
  }),
});

// Runtime disclosure state/order is owned by artifactDisclosurePolicy.js.
// These narrow views keep ceremony/catalog metadata separate from the
// experiment-only evidence model so neither can become a second grant owner.
export const PROGRESSION_ARTIFACT_PRESENTATION_POLICY = Object.freeze({
  firstVisionPresentation: PROGRESSION_ARTIFACT_POLICY_DEFINITION.firstVisionPresentation,
  initialFamilyFeatureIds: PROGRESSION_ARTIFACT_POLICY_DEFINITION.initialFamilyFeatureIds,
  initialChildFeatureIds: PROGRESSION_ARTIFACT_POLICY_DEFINITION.initialChildFeatureIds,
  initialSetRealization: PROGRESSION_ARTIFACT_POLICY_DEFINITION.initialSetRealization,
  featureMetadata: PROGRESSION_ARTIFACT_POLICY_DEFINITION.featureMetadata,
});

export const PROGRESSION_ARTIFACT_EXPERIMENT_POLICY = Object.freeze({
  sequence: PROGRESSION_ARTIFACT_POLICY_DEFINITION.sequence,
});

function resolveSourceContribution(facts, source) {
  const value = requireQualifiedUseDayCount(facts[source.factKey]);
  const ratio = source.cap > 0 ? Math.min(1, value / source.cap) : 0;
  const points = ratio * source.maxPoints;
  return Object.freeze({
    id: source.id,
    factKey: source.factKey,
    value,
    points,
    roundedPoints: Math.round(points),
    maxPoints: source.maxPoints,
    cap: source.cap,
  });
}

export function resolveProgressionBonsaiGrowth(facts) {
  requireQualifiedUseDayCount(facts?.qualifiedUseDayCount);
  const contributions = PROGRESSION_BONSAI_GROWTH_POLICY.sources
    .map((source) => resolveSourceContribution(facts, source));
  const release = buildProgressionBonsaiRelease(facts.qualifiedUseDayCount);
  const score = release.growthScore;
  const stage = PROGRESSION_BONSAI_GROWTH_POLICY.stages.find(
    (candidate) => candidate.id === release.stageId,
  );
  if (!stage) throw new Error('PROGRESSION_BONSAI_RELEASE_STAGE_REQUIRED');
  const nextStage = PROGRESSION_BONSAI_GROWTH_POLICY.stages.find((candidate) => (
    candidate.minScore > score
  )) || null;
  return Object.freeze({
    score,
    maxScore: PROGRESSION_BONSAI_GROWTH_POLICY.scoreMax,
    stage,
    nextStage,
    contributions: Object.freeze(contributions),
    release,
  });
}

export function getProgressionSiteSlotPolicy(featureId) {
  return typeof featureId === 'string'
    ? PROGRESSION_SITE_SLOT_POLICY_BY_FEATURE_ID[featureId.trim()] || null
    : null;
}
