import { SOCIAL_METRIC_ATTRS } from '../../../core/constants.js';
import { removeAttribute } from '../../FastStyleEngine.js';

function createCleanupError(message, errors) {
  const normalizedErrors = Array.isArray(errors) ? errors.filter(Boolean) : [];
  const AggregateErrorCtor = globalThis?.AggregateError;
  if (typeof AggregateErrorCtor === 'function') {
    return new AggregateErrorCtor(normalizedErrors, message);
  }
  const error = new Error(message);
  error.errors = normalizedErrors;
  if (normalizedErrors[0]) error.cause = normalizedErrors[0];
  return error;
}

function runCleanupStep(errors, cleanup) {
  try {
    cleanup();
  } catch (error) {
    errors.push(error);
  }
}

function getMetricAttr(type) {
  return type === 'engagement'
    ? SOCIAL_METRIC_ATTRS.ENGAGEMENT
    : SOCIAL_METRIC_ATTRS.EXPOSURE;
}

export function clearMetricMarks(type, helpers = {}) {
  const attr = getMetricAttr(type);
  const errors = [];
  // TikTok count/time effects are cleared through its exact instance ledger,
  // including detached targets. Sweeping public markers would claim foreigners.
  const marked = helpers.isTikTokActive ? [] : document.querySelectorAll(`[${attr}]`);
  marked.forEach((el) => {
    runCleanupStep(errors, () => removeAttribute(el, attr));
    if (helpers.isInstagramActive) {
      runCleanupStep(errors, () => helpers.restoreInstagramText?.(el));
    }
    runCleanupStep(errors, () => helpers.restoreYoutubeActionLabel?.(el));
    runCleanupStep(errors, () => helpers.restoreYoutubeCommentLabel?.(el));
    runCleanupStep(errors, () => helpers.restoreTikTokMetricLabel?.(el));
    runCleanupStep(errors, () => helpers.restoreTikTokMetricTarget?.(el));
    runCleanupStep(errors, () => helpers.syncFacebookMetadataForElement?.(el));
    runCleanupStep(errors, () => helpers.syncYoutubeMetadataForElement?.(el));
    runCleanupStep(errors, () => helpers.syncXMetadataForElement?.(el));
    runCleanupStep(errors, () => helpers.syncRedditTimeSeparatorsForElement?.(el));
  });
  if (type === 'engagement') {
    document.querySelectorAll(`[${SOCIAL_METRIC_ATTRS.ACTION_LABEL}]`).forEach((el) => {
      runCleanupStep(errors, () => helpers.restoreYoutubeActionLabel?.(el));
    });
    document.querySelectorAll(`[${SOCIAL_METRIC_ATTRS.COMMENT_LABEL}]`).forEach((el) => {
      runCleanupStep(errors, () => helpers.restoreYoutubeCommentLabel?.(el));
    });
    document.querySelectorAll(`[${SOCIAL_METRIC_ATTRS.TIKTOK_LABEL}]`).forEach((el) => {
      runCleanupStep(errors, () => helpers.restoreTikTokMetricLabel?.(el));
    });
  }
  if (type === 'exposure') {
    runCleanupStep(errors, () => helpers.restoreXNewsMetadata?.());
    runCleanupStep(errors, () => helpers.restoreRedditTimeSeparators?.());
  }
  if (errors.length > 0) {
    throw createCleanupError(`SOCIAL_METRIC_${String(type || 'unknown').toUpperCase()}_MARK_CLEANUP_FAILED`, errors);
  }
}

export function restoreAllMetricArtifacts(helpers = {}) {
  const errors = [];
  runCleanupStep(errors, () => helpers.restoreFacebookMetadataClusters?.());
  runCleanupStep(errors, () => helpers.restoreYoutubeMetadataRows?.());
  runCleanupStep(errors, () => helpers.restoreXMetadataClusters?.());
  runCleanupStep(errors, () => helpers.restoreXNewsMetadata?.());
  runCleanupStep(errors, () => helpers.restoreRedditTimeSeparators?.());
  if (helpers.isInstagramActive) {
    document.querySelectorAll([
      `[${SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT}]`,
      `[${SOCIAL_METRIC_ATTRS.ORIGINAL_DISPLAY}]`,
      `[${SOCIAL_METRIC_ATTRS.INSTAGRAM_COLLAPSE}]`,
    ].join(',')).forEach((el) => {
      runCleanupStep(errors, () => helpers.restoreInstagramText?.(el));
    });
  }
  document.querySelectorAll(`[${SOCIAL_METRIC_ATTRS.ACTION_LABEL}]`).forEach((el) => {
    runCleanupStep(errors, () => helpers.restoreYoutubeActionLabel?.(el));
  });
  document.querySelectorAll(`[${SOCIAL_METRIC_ATTRS.COMMENT_LABEL}]`).forEach((el) => {
    runCleanupStep(errors, () => helpers.restoreYoutubeCommentLabel?.(el));
  });
  document.querySelectorAll(`[${SOCIAL_METRIC_ATTRS.TIKTOK_LABEL}]`).forEach((el) => {
    runCleanupStep(errors, () => helpers.restoreTikTokMetricLabel?.(el));
  });
  document.querySelectorAll(`[${SOCIAL_METRIC_ATTRS.TIKTOK_COLLAPSE}]`).forEach((el) => {
    runCleanupStep(errors, () => helpers.restoreTikTokMetricTarget?.(el));
  });
  if (errors.length > 0) {
    throw createCleanupError('SOCIAL_METRIC_ARTIFACT_CLEANUP_FAILED', errors);
  }
}
