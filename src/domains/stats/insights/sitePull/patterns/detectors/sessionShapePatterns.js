import {
  SITE_PULL_PATTERN_CATEGORIES,
  SITE_PULL_PATTERN_POLARITIES,
  createSitePullPatternSignal,
} from '../sitePullPatternContracts.js';
import {
  clamp,
  toNumber,
} from '../patternUtils.js';
import { requireSitePullDetectorEvidenceProfile } from './detectorEvidenceProfiles.js';

function detectFocusedBlock({
  sustainedBlockEvidenceProfile = null,
}) {
  const profile = requireSitePullDetectorEvidenceProfile(sustainedBlockEvidenceProfile, 'sustained_block');
  if (!profile.canEmitAtomic) return null;

  return createSitePullPatternSignal({
    id: 'focused_block',
    category: SITE_PULL_PATTERN_CATEGORIES.IMMERSION,
    severity: 'neutral',
    tone: 'neutral',
    polarity: SITE_PULL_PATTERN_POLARITIES.NEUTRAL,
    score: profile.score,
    confidence: profile.confidence,
    evidence: profile.evidence,
    recommendedAction: null,
  });
}

function detectSessionFragmentation({
  checkingEvidenceProfile = null,
}) {
  const profile = requireSitePullDetectorEvidenceProfile(checkingEvidenceProfile, 'checking');
  const sessionFragmentation = profile.sessionFragmentation;
  if (!sessionFragmentation?.canEmitAtomic || !sessionFragmentation.evidence.hasSessionFacts) {
    return null;
  }

  return createSitePullPatternSignal({
    id: 'session_fragmentation',
    category: SITE_PULL_PATTERN_CATEGORIES.CHECKING,
    severity: 'warning',
    tone: 'warning',
    score: clamp(
      (toNumber(sessionFragmentation.evidence.shortSessionRate) * 75)
      + toNumber(sessionFragmentation.evidence.shortSessionCount),
      0,
      100,
    ),
    confidence: sessionFragmentation.evidence.hasMeasuredSessionFacts ? 0.82 : 0.62,
    evidence: {
      evidenceWindow: 'today',
      hasMeasuredSessionFacts: sessionFragmentation.evidence.hasMeasuredSessionFacts,
      sessionBasis: sessionFragmentation.evidence.sessionBasis,
      evidenceFamilyIds: sessionFragmentation.evidence.evidenceFamilyIds,
      sessionCount: sessionFragmentation.evidence.sessionCount,
      shortSessionCount: sessionFragmentation.evidence.shortSessionCount,
      shortSessionRate: sessionFragmentation.evidence.shortSessionRate,
      averageSessionMs: sessionFragmentation.evidence.averageSessionMs,
      maxSessionMs: sessionFragmentation.evidence.maxSessionMs,
      evidenceStatus: sessionFragmentation.status,
      caveats: sessionFragmentation.caveats,
    },
    recommendedAction: { type: 'session_checkin', actionId: 'enable_session_checkin' },
  });
}

function detectControlledBriefCheck({
  checkingEvidenceProfile = null,
  controlledBriefEvidenceProfile = null,
}) {
  requireSitePullDetectorEvidenceProfile(checkingEvidenceProfile, 'checking');
  const profile = requireSitePullDetectorEvidenceProfile(controlledBriefEvidenceProfile, 'controlled_brief');
  if (!profile.canEmitVisible) return null;

  return createSitePullPatternSignal({
    id: 'controlled_brief_check',
    category: SITE_PULL_PATTERN_CATEGORIES.STEADY,
    severity: 'neutral',
    tone: 'neutral',
    score: clamp(profile.score * 100, 0, 100),
    confidence: profile.confidence,
    evidence: profile.evidence,
    recommendedAction: null,
  });
}

function detectInterventionRecovery({
  interventionOutcomeEvidenceProfile = null,
}) {
  const profile = requireSitePullDetectorEvidenceProfile(
    interventionOutcomeEvidenceProfile,
    'intervention_outcome',
  );
  if (!profile.recovery?.canEmitAtomic) return null;
  return createSitePullPatternSignal({
    id: 'intervention_recovery',
    category: SITE_PULL_PATTERN_CATEGORIES.INTERVENTION,
    severity: 'neutral',
    tone: 'neutral',
    score: clamp(profile.recovery.strength * 100, 0, 100),
    confidence: profile.recovery.confidence,
    evidence: profile.recovery.evidence,
    recommendedAction: null,
  });
}

export function detectSessionShapePatterns({
  featureVector,
  subscores = {},
  facts = {},
  personalBaseline = null,
  checkingEvidenceProfile = null,
  controlledBriefEvidenceProfile = null,
  routePressureEvidenceProfile = null,
  sustainedBlockEvidenceProfile = null,
  timePressureEvidenceProfile = null,
  interventionOutcomeEvidenceProfile = null,
}) {
  if (!featureVector?.hasAnyActivity) return [];
  return [
    detectFocusedBlock({
      featureVector,
      subscores,
      facts,
      personalBaseline,
      sustainedBlockEvidenceProfile,
    }),
    detectSessionFragmentation({
      featureVector,
      facts,
      personalBaseline,
      checkingEvidenceProfile,
    }),
    detectControlledBriefCheck({
      featureVector,
      subscores,
      facts,
      checkingEvidenceProfile,
      controlledBriefEvidenceProfile,
      routePressureEvidenceProfile,
      timePressureEvidenceProfile,
    }),
    detectInterventionRecovery({ facts, subscores, interventionOutcomeEvidenceProfile }),
  ].filter(Boolean);
}
