import { SITE_PULL_PATTERN_LEVELS } from './sitePullPatternContracts.js';
import { composeSitePullCompositePatterns } from './sitePullPatternComposer.js';
import {
  SITE_PULL_PATTERN_DEFINITION_VERSION,
  annotateSitePullPatternSignal,
} from './sitePullPatternDefinitions.js';
import {
  SITE_PULL_PATTERN_CALIBRATION_VERSION,
  calibrateSitePullPatternSignals,
} from './sitePullPatternCalibration.js';
import {
  SITE_PULL_PATTERN_PRESENTER_VERSION,
  presentSitePullPatterns,
} from './sitePullPatternPresenter.js';
import {
  SITE_PULL_PATTERN_REQUIREMENTS_VERSION,
  rejectSitePullPattern,
  rejectsDetectorCompositePattern,
  validateSitePullPatternSignals,
} from './sitePullPatternRequirements.js';

export const SITE_PULL_PATTERN_LAYER_VERSION = 'site-pull-pattern-layers-v1';

function isCompositePattern(pattern) {
  return pattern?.level === SITE_PULL_PATTERN_LEVELS.COMPOSITE;
}

function buildCompositeEdges(compositePatterns) {
  return compositePatterns
    .filter((pattern) => pattern.componentIds.length > 0)
    .map((pattern) => ({
      id: pattern.id,
      componentIds: [...pattern.componentIds],
    }));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function mergeUnique(values = []) {
  const seen = new Set();
  return values.filter((value) => {
    if (typeof value !== 'string' || value.length === 0 || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function sourcePriority(pattern) {
  if (pattern?.source === 'pattern_composer') return 100;
  if (pattern?.source === 'transition_edges') return 90;
  if (pattern?.source === 'rule') return 80;
  if (pattern?.source === 'personal_baseline') return 70;
  return 50;
}

function mergePriority(pattern) {
  return sourcePriority(pattern)
    + (Number(pattern?.confidence || 0) * 20)
    + Number(pattern?.score || 0) / 100;
}

function choosePrimaryPattern(left, right) {
  const leftPriority = mergePriority(left);
  const rightPriority = mergePriority(right);
  if (rightPriority > leftPriority) return right;
  if (leftPriority > rightPriority) return left;
  const leftDetectorIndex = Number(left?.presentation?.detectorIndex);
  const rightDetectorIndex = Number(right?.presentation?.detectorIndex);
  return rightDetectorIndex < leftDetectorIndex ? right : left;
}

function mergeDuplicatePatternSignals(existing, incoming) {
  const primary = choosePrimaryPattern(existing, incoming);
  const secondary = primary === existing ? incoming : existing;
  const sourceList = mergeUnique([
    ...asArray(existing.sourceList),
    existing.source,
    ...asArray(incoming.sourceList),
    incoming.source,
  ]);
  const mergedSignalCount = Math.max(1, Number(existing.mergedSignalCount) || 1)
    + Math.max(1, Number(incoming.mergedSignalCount) || 1);
  return {
    ...secondary,
    ...primary,
    score: Number(primary.score || 0),
    confidence: Number(primary.confidence || 0),
    // A selected signal owns its complete evidence population. Metadata from
    // another window/source must not fill holes in that population.
    evidence: primary.evidence,
    componentIds: mergeUnique([
      ...asArray(existing.componentIds),
      ...asArray(incoming.componentIds),
    ]),
    suppresses: mergeUnique([
      ...asArray(existing.suppresses),
      ...asArray(incoming.suppresses),
    ]),
    sourceList,
    mergedSignalCount,
  };
}

function dedupeAnnotatedPatternSignals(patternSignals) {
  const patternIndex = new Map();
  const patterns = [];
  (Array.isArray(patternSignals) ? patternSignals : []).forEach((signal, detectorIndex) => {
    const annotated = annotateSitePullPatternSignal(signal, { detectorIndex });
    if (!annotated?.id) return;
    const existing = patternIndex.get(annotated.id);
    if (!existing) {
      patternIndex.set(annotated.id, annotated);
      patterns.push(annotated);
      return;
    }
    const merged = mergeDuplicatePatternSignals(existing, annotated);
    patternIndex.set(annotated.id, merged);
    const existingIndex = patterns.findIndex((pattern) => pattern.id === annotated.id);
    if (existingIndex >= 0) {
      patterns[existingIndex] = merged;
    }
  });
  return patterns;
}

function indexPatterns(patterns) {
  const patternIndex = new Map();
  patterns.forEach((pattern) => {
    if (pattern?.id && !patternIndex.has(pattern.id)) {
      patternIndex.set(pattern.id, pattern);
    }
  });
  return patternIndex;
}

function dedupeRejectedPatterns(rejectedPatterns) {
  const seen = new Set();
  return rejectedPatterns.filter((rejection) => {
    const key = `${rejection.id}:${rejection.reason}:${rejection.source || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function calibrationRowsForStage(rows, stage) {
  return rows.map((row) => ({
    stage,
    ...row,
  }));
}

export function buildSitePullPatternLayers(patternSignals = [], context = {}) {
  const detectorPatterns = dedupeAnnotatedPatternSignals(patternSignals);
  const detectorCompositeRejections = detectorPatterns
    .filter(rejectsDetectorCompositePattern)
    .map((pattern) => rejectSitePullPattern(
      pattern,
      'composite_requires_composer',
      ['source=pattern_composer'],
    ));
  const detectorCandidatePatterns = detectorPatterns.filter((pattern) => !isCompositePattern(pattern));
  const detectorValidation = validateSitePullPatternSignals(detectorCandidatePatterns, context);
  const detectorCalibration = calibrateSitePullPatternSignals(detectorValidation.validPatterns);
  const composedPatterns = composeSitePullCompositePatterns(detectorCalibration.patterns, context);
  const candidatePatterns = dedupeAnnotatedPatternSignals([
    ...detectorCalibration.patterns,
    ...composedPatterns,
  ]);
  const patternIndex = indexPatterns(candidatePatterns);
  const finalValidation = validateSitePullPatternSignals(candidatePatterns, {
    ...context,
    patternIndex,
  });
  const finalCalibration = calibrateSitePullPatternSignals(finalValidation.validPatterns);
  const detectorCalibrationRows = calibrationRowsForStage(detectorCalibration.rows, 'detector');
  const finalCalibrationRows = calibrationRowsForStage(finalCalibration.rows, 'final');
  const patterns = finalCalibration.patterns;
  const atomicPatterns = patterns.filter((pattern) => (
    pattern.level === SITE_PULL_PATTERN_LEVELS.ATOMIC
  ));
  const compositePatterns = patterns.filter((pattern) => (
    pattern.level === SITE_PULL_PATTERN_LEVELS.COMPOSITE
  ));
  const statePatterns = patterns.filter((pattern) => (
    pattern.level === SITE_PULL_PATTERN_LEVELS.STATE
  ));
  const presentation = presentSitePullPatterns(patterns);

  return {
    version: SITE_PULL_PATTERN_LAYER_VERSION,
    calibrationVersion: SITE_PULL_PATTERN_CALIBRATION_VERSION,
    definitionVersion: SITE_PULL_PATTERN_DEFINITION_VERSION,
    presenterVersion: SITE_PULL_PATTERN_PRESENTER_VERSION,
    requirementsVersion: SITE_PULL_PATTERN_REQUIREMENTS_VERSION,
    calibration: {
      version: SITE_PULL_PATTERN_CALIBRATION_VERSION,
      detector: {
        summary: { ...detectorCalibration.summary },
        rows: detectorCalibrationRows,
      },
      final: {
        summary: { ...finalCalibration.summary },
        rows: finalCalibrationRows,
      },
      rows: [
        ...detectorCalibrationRows,
        ...finalCalibrationRows,
      ],
    },
    primaryEvidenceProfiles: {
      checking: context.checkingEvidenceProfile || null,
      controlledBrief: context.controlledBriefEvidenceProfile || null,
      timePressure: context.timePressureEvidenceProfile || null,
      trendPressure: context.trendPressureEvidenceProfile || null,
      habitConsistency: context.habitConsistencyEvidenceProfile || null,
      nightPressure: context.nightPressureEvidenceProfile || null,
      routePressure: context.routePressureEvidenceProfile || null,
      immersion: context.immersionEvidenceProfile || null,
      sessionDepth: context.sessionDepthEvidenceProfile || null,
      sustainedBlock: context.sustainedBlockEvidenceProfile || null,
      interventionOutcome: context.interventionOutcomeEvidenceProfile || null,
      backgroundResidency: context.backgroundResidencyEvidenceProfile || null,
      contentFlow: context.contentFlowEvidenceProfile || null,
      tabContext: context.tabContextEvidenceProfile || null,
    },
    patterns,
    atomicPatterns,
    compositePatterns,
    statePatterns,
    rejectedPatterns: dedupeRejectedPatterns([
      ...detectorCompositeRejections,
      ...detectorValidation.rejectedPatterns,
      ...detectorCalibration.rejectedPatterns,
      ...finalValidation.rejectedPatterns,
      ...finalCalibration.rejectedPatterns,
    ]),
    presentationPatterns: presentation.presentationPatterns,
    suppressedPatterns: presentation.suppressedPatterns,
    suppressedPatternIds: presentation.suppressedPatternIds,
    presentationPolicy: presentation.policy,
    graph: {
      definitionVersion: SITE_PULL_PATTERN_DEFINITION_VERSION,
      compositeEdges: buildCompositeEdges(compositePatterns),
    },
  };
}
