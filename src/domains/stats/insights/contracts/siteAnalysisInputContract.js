// Final interpretations may be displayed or evaluated, never recycled as facts.
// Intermediate facts/baseline evidence have their own validated, one-way seams.
export const SITE_ANALYSIS_OUTPUT_FIELDS = Object.freeze([
  'analysis', 'sitePullProfile', 'primaryInsight', 'patterns', 'patternLayers',
  'patternDiagnostics', 'badges', 'feedbackSurfaces', 'contributionBreakdown',
  'recommendedNudge', 'riskBand', 'score', 'confidence', 'verdict', 'interpretation', 'reading',
]);

export function assertSiteAnalysisSourceInput(value, source) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const field = SITE_ANALYSIS_OUTPUT_FIELDS.find((key) => Object.hasOwn(value, key));
  if (field) {
    const error = new Error(`SITE_ANALYSIS_OUTPUT_AS_INPUT:${source}.${field}`);
    error.code = 'SITE_ANALYSIS_OUTPUT_AS_INPUT';
    error.source = source;
    error.field = field;
    throw error;
  }
}
