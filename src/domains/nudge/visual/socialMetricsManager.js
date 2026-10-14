import observerHub from '../../../lib/dom/ObserverHub.js';
import { recordProtectionFeatureError } from '../../protection/content/runtime/protectionRuntimeDiagnostics.js';
import {
  ROOT_ATTRS,
  SOCIAL_METRIC_ATTRS,
  removeRootAttribute,
  setRootAttribute,
} from '../core/index.js';
import {
  removeStyleProperty,
  setStyleProperty,
} from './FastStyleEngine.js';
import {
  collectMutationCausalRoots,
  collectMutationRoots,
  normalizeRoots,
} from './socialMetrics/core/dirtyRootReducer.js';
import {
  routeSocialMetricMutationGroups,
} from './socialMetrics/core/mutationGroupRouter.js';
import {
  applyInstagramMetricCollapse,
  createInstagramMetricLabelOwner,
  getInstagramMetricInfo,
  getInstagramSelectorDriftSurface,
  hasInstagramIcon,
  isInstagramMetricEffectCurrent,
  restoreInstagramText,
  shouldFastRejectInstagramCandidate,
  shouldReuseStableInstagramCandidate,
  shouldSkipInstagramActionButton,
} from './socialMetrics/adapters/instagramAdapter.js';
import {
  isFacebookHost,
  isInstagramHost,
  isRedditHost,
  isTikTokHost,
  isXHost,
  isYoutubeHost,
  normalizeSocialMetricsHost,
} from './socialMetrics/adapters/hostUtils.js';
import {
  getSocialMetricTextPatternsForHost,
} from './socialMetrics/adapters/hostTextPatternCatalog.js';
import {
  createFacebookReplyLabelOwner,
  flushDirtyFacebookMetadataClusters,
  getFacebookReplyMetricInfo,
  isFacebookReplyLabelCandidate,
  markFacebookMetadataDirty,
  isFacebookAccessibleMetricContainer,
  projectFacebookAccessibleMetricLabel,
  restoreFacebookMetadataClusters,
  syncFacebookMetadataForElement,
  syncFacebookMetadataCluster,
} from './socialMetrics/adapters/facebookAdapter.js';
import {
  createPlatformSemanticAdapter,
  getPlatformSemanticMutationAttributes,
} from './socialMetrics/adapters/platformSemanticAdapters.js';
import {
  createTikTokMetricLabelOwner,
  isTikTokAccessibleMetricContainer,
  projectTikTokAccessibleMetricLabel,
  collapseTikTokMetricTarget,
  getTikTokMetricInfo,
  resolveTikTokMetricTargets,
} from './socialMetrics/adapters/tiktokAdapter.js';
import {
  flushDirtyYoutubeMetadataRows,
  applyYoutubeCollapsedFeedbackCount,
  applyYoutubeActionLabel,
  applyYoutubeCommentLabel,
  getYoutubeActionLabelInfo,
  isYoutubeActionLabelApplied,
  isYoutubeCommentCount,
  isYoutubeCommentLabelApplied,
  isYoutubeSocialMetricRootRelevant,
  isYoutubeThumbnailBadge,
  isYoutubeFreshnessBadge,
  markYoutubeMetadataDirty,
  projectYoutubeAccessibleMetricLabel,
  isYoutubeAccessibleMetricContainer,
  restoreYoutubeActionLabel,
  restoreYoutubeCommentLabel,
  restoreYoutubeMetadataRows,
  resolveYoutubeFeedbackCountTarget,
  shouldCollapseYoutubeFeedbackCount,
  syncYoutubeMetadataForElement,
  syncYoutubeMetadataRow,
} from './socialMetrics/adapters/youtubeAdapter.js';
import {
  applyXNewsMetadataReplacement,
  flushDirtyXMetadataClusters,
  getXMetricInfo,
  getXMetricSourceText,
  getXSelectorDriftSurface,
  markXMetadataDirty,
  projectXAccessibleMetricLabel,
  isXAccessibleMetricContainer,
  restoreXMetadataClusters,
  restoreXNewsMetadata,
  restoreXNewsMetadataElement,
  resolveXMetricTargets,
  requiresXActionMetricQualification,
  syncXMetadataForElement,
  syncXMetadataCluster,
} from './socialMetrics/adapters/xAdapter.js';
import { createXMetricEffectOwner } from './socialMetrics/adapters/xMetricEffectOwner.js';
import { createTikTokMetricEffectOwner } from './socialMetrics/adapters/tiktokMetricEffectOwner.js';
import { createAccessibleMetricLabelOwner } from './socialMetrics/core/accessibleMetricLabelOwner.js';
import { clearMetricMark } from './socialMetrics/core/candidateMatcher.js';
import {
  flushDirtyRedditTimeSeparators,
  markRedditTimeSeparatorDirty,
  restoreRedditTimeSeparators,
  syncRedditTimeSeparatorsForElement,
} from './socialMetrics/adapters/redditAdapter.js';
import {
  createRedditShadowMetricsOwner,
} from './socialMetrics/adapters/redditShadowMetricsOwner.js';
import {
  clearMetricMarks,
  restoreAllMetricArtifacts,
} from './socialMetrics/core/cleanupCoordinator.js';
import {
  createSocialMetricRuntimeState,
} from './socialMetrics/core/runtimeState.js';
import {
  compileSocialMetricObserverInterest,
} from './socialMetrics/core/observerInterestPlan.js';
import {
  SOCIAL_METRICS_AUDIT_MODES,
  createSocialMetricsDiagnosticsRuntime,
  normalizeSocialMetricsAuditMode,
} from './socialMetrics/core/diagnosticsRuntimeBridge.js';
import { nowMs } from './socialMetrics/core/diagnosticsValueUtils.js';
import {
  createSocialMetricsScanRuntime,
} from './socialMetrics/core/scanRuntimeBridge.js';
import {
  createSocialMetricsOwnedMutationRuntime,
} from './socialMetrics/core/ownedMutationRuntimeBridge.js';

export {
  SOCIAL_METRICS_AUDIT_MODES,
  normalizeSocialMetricsAuditMode,
};

function getSocialMetricsErrorMessage(error, fallback = 'SOCIAL_METRICS_MANAGER_FAILURE') {
  return String(error?.message || error || fallback);
}

function reportSocialMetricsFailure(phase, error, details = {}) {
  const diagnostic = {
    phase,
    error: getSocialMetricsErrorMessage(error),
    ...details,
  };
  recordProtectionFeatureError('socialMetricsManager', error, diagnostic);
  if (typeof console !== 'undefined') {
    console.warn?.('[SocialMetricsManager] runtime failure', diagnostic);
  }
  return diagnostic;
}

function createSocialMetricsLifecycleError(message, errors) {
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

const readCurrentSocialMetricsHost = () => normalizeSocialMetricsHost(location.hostname || '');

export function createSocialMetricsRuntime({
  getHost = readCurrentSocialMetricsHost,
} = {}) {
  if (typeof getHost !== 'function') {
    throw new Error('SOCIAL_METRICS_RUNTIME_HOST_READER_REQUIRED');
  }
  const lifecycleState = {
    observerUnsub: null,
    activeEngagement: false,
    activeExposure: false,
    activeMetricKeys: [],
    activeScanGroups: [],
    compiledScanPlans: [],
    metricRootSelector: '',
    observerInterestPlan: null,
    lastUpdateSignature: null,
    redditShadowMetricsOwner: null,
  };
  let diagnosticsRuntime;
  let ownedMutationRuntime, scanRuntime;
  const xMetricEffects = createXMetricEffectOwner();
  const accessibleLabels = createAccessibleMetricLabelOwner();
  const instagramLabels = createInstagramMetricLabelOwner({
    runWithReconciliationDisposition: (target, disposition, work) => (
      ownedMutationRuntime.runWithReconciliationDisposition(target, disposition, work)
    ),
  });
  const tiktokLabels = createTikTokMetricLabelOwner();
  const tiktokMetricEffects = createTikTokMetricEffectOwner();
  const facebookReplyLabels = createFacebookReplyLabelOwner();

  const root = Object.freeze({
  _isYoutubeHost() {
    return isYoutubeHost(root._getHost());
  },
  _isFacebookHost() {
    return isFacebookHost(root._getHost());
  },
  _isXHost() {
    return isXHost(root._getHost());
  },
  _isInstagramHost() {
    return isInstagramHost(root._getHost());
  },
  _isRedditHost() {
    return isRedditHost(root._getHost());
  },
  _isTikTokHost() {
    return isTikTokHost(root._getHost());
  },
  _getMarkedMetricAttrSet() {
    return [
      SOCIAL_METRIC_ATTRS.ENGAGEMENT,
      SOCIAL_METRIC_ATTRS.EXPOSURE,
      SOCIAL_METRIC_ATTRS.INSTAGRAM_COLLAPSE,
    ];
  },
  _isMetricHidden(el) {
    if (!(el instanceof Element)) return false;
    return root._getMarkedMetricAttrSet().some((attr) => el.hasAttribute(attr));
  },
  _hideNode(el) {
    if (!(el instanceof Element)) return;
    setStyleProperty(el, 'visibility', 'hidden');
  },
  _showNode(el) {
    if (!(el instanceof Element)) return;
    removeStyleProperty(el, 'visibility');
  },
  _getMetricDomHelpers() {
    return {
      isMetricHidden: (el) => root._isMetricHidden(el),
      hideNode: (el) => root._hideNode(el),
      showNode: (el) => root._showNode(el),
      restoreOriginalText: (el) => restoreInstagramText(el),
      runWithReconciliationDisposition: (target, disposition, operation) => (
        ownedMutationRuntime.runWithReconciliationDisposition(
          target,
          disposition,
          operation,
        )
      ),
    };
  },
  _getCandidateMatcherHelpers() {
    return {
      applyAccessibleMetricLabel: (el) => {
        const project = root._isXHost() ? projectXAccessibleMetricLabel
          : root._isYoutubeHost() ? projectYoutubeAccessibleMetricLabel
            : root._isTikTokHost() ? projectTikTokAccessibleMetricLabel
              : root._isFacebookHost() ? projectFacebookAccessibleMetricLabel : null;
        return project ? accessibleLabels.apply(el, project, lifecycleState.activeMetricKeys) : null;
      },
      isAccessibleMetricLabelContainer: (el) => root._isXHost()
        ? isXAccessibleMetricContainer(el)
        : root._isYoutubeHost() ? isYoutubeAccessibleMetricContainer(el)
          : root._isTikTokHost() ? isTikTokAccessibleMetricContainer(el)
            : root._isFacebookHost() && isFacebookAccessibleMetricContainer(el),
      createAccessibleMetricLabelRevalidationCursor: (ctx) => accessibleLabels.createCursor(ctx.roots),
      revalidateAccessibleMetricLabel: (el) => {
        const project = root._isXHost() ? projectXAccessibleMetricLabel
          : root._isYoutubeHost() ? projectYoutubeAccessibleMetricLabel
            : root._isTikTokHost() ? projectTikTokAccessibleMetricLabel
              : root._isFacebookHost() ? projectFacebookAccessibleMetricLabel : null;
        if (!project) throw new Error('SOCIAL_METRICS_ACCESSIBLE_LABEL_PROJECTOR_REQUIRED');
        const disposition = accessibleLabels.reconciliationDisposition(el, project, lifecycleState.activeMetricKeys);
        ownedMutationRuntime.runWithReconciliationDisposition(el, disposition, () => {
          if (!el.isConnected) accessibleLabels.restore(el);
          else accessibleLabels.apply(el, project, lifecycleState.activeMetricKeys);
        });
      },
      shouldFastRejectInstagramCandidate: (el, text) => root._shouldFastRejectInstagramCandidate(el, text),
      shouldReuseStableInstagramCandidate: (el, ctx) => (
        root._shouldReuseStableInstagramCandidate(el, ctx)
      ),
      shouldSkipInstagramActionButton: (el) => root._shouldSkipInstagramActionButton(el),
      hasInstagramIcon: (el) => root._hasInstagramIcon(el),
      restoreInstagramText: (el) => root._restoreInstagramText(el),
      hasInstagramMetricLabel: instagramLabels.owns,
      createInstagramEffectRevalidationCursor: (ctx) => instagramLabels.createCursor(ctx.group, ctx.roots),
      revalidateInstagramMetricEffect: (record, ctx) => {
        if (isInstagramMetricEffectCurrent(
          record, root._getHost(), ctx, instagramLabels.sourceText(record.metricTarget),
        )) return;
        ownedMutationRuntime.runWithReconciliationDisposition(record.target, 'clear', () => {
          const cleared = clearMetricMark(record.target, ctx, root._getCandidateMatcherHelpers());
          if (!cleared) root._restoreInstagramText(record.target);
        });
      },
      getFacebookReplySourceText: facebookReplyLabels.sourceText,
      hasFacebookReplyLabel: facebookReplyLabels.owns,
      isFacebookReplyLabelCandidate,
      getFacebookReplyMetricInfo: (el) => (
        getFacebookReplyMetricInfo(el, facebookReplyLabels.sourceText(el))
      ),
      applyFacebookReplyLabel: facebookReplyLabels.apply,
      restoreFacebookReplyLabel: facebookReplyLabels.restore,
      restoreYoutubeActionLabel: (el) => root._restoreYoutubeActionLabel(el),
      restoreYoutubeCommentLabel: (el) => root._restoreYoutubeCommentLabel(el),
      restoreTikTokMetricLabel: (el) => root._restoreTikTokMetricLabel(el),
      restoreTikTokMetricTarget: (el) => root._restoreTikTokMetricTarget(el),
      markFacebookMetadataDirty: (el, ctx) => root._markFacebookMetadataDirty(el, ctx),
      markYoutubeMetadataDirty: (el, ctx) => root._markYoutubeMetadataDirty(el, ctx),
      markXMetadataDirty: (el, ctx) => root._markXMetadataDirty(el, ctx),
      markRedditTimeSeparatorDirty: (el, ctx) => root._markRedditTimeSeparatorDirty(el, ctx),
      getInstagramMetricInfo: (el) => root._getInstagramMetricInfo(el),
      getXMetricInfo: (el, ctx) => root._getXMetricInfo(el, ctx),
      requiresXActionMetricQualification,
      getXMetricSourceText,
      rememberXMetricEffect: (el, ctx) => xMetricEffects.remember(el, ctx),
      forgetXMetricEffect: (el) => xMetricEffects.forget(el),
      createXEffectRevalidationCursor: (ctx) => xMetricEffects.createCursor(ctx.group, ctx.roots),
      runWithReconciliationDisposition: (target, disposition, operation) => (
        ownedMutationRuntime.runWithReconciliationDisposition(target, disposition, operation)
      ),
      getSelectorDriftSurface: (el, ctx, decision) => (
        root._getSelectorDriftSurface(el, ctx, decision)
      ),
      getTikTokMetricInfo: (el) => root._getTikTokMetricInfo(el),
      applyTikTokMetricEffect: tiktokMetricEffects.apply,
      restoreTikTokMetricEffect: tiktokMetricEffects.restore,
      createTikTokEffectRevalidationCursor: (ctx) => tiktokMetricEffects.createCursor(ctx.group, ctx.roots),
      resolveTikTokMetricTargets: (el, info) => root._resolveTikTokMetricTargets(el, info),
      isTikTokMetricLabelApplied: (el, info) => root._isTikTokMetricLabelApplied(el, info),
      applyTikTokMetricLabel: (el, info) => root._applyTikTokMetricLabel(el, info),
      collapseTikTokMetricTarget: (el) => root._collapseTikTokMetricTarget(el),
      resolveXMetricTargets: (el, ctx, match) => root._resolveXMetricTargets(el, ctx, match),
      applyXNewsMetadataReplacement: (el, filterKeys) => (
        root._applyXNewsMetadataReplacement(el, filterKeys)
      ),
      restoreXNewsMetadataElement: (el) => root._restoreXNewsMetadataElement(el),
      getYoutubeActionLabelInfo: (el) => root._getYoutubeActionLabelInfo(el),
      isYoutubeThumbnailBadge,
      isYoutubeFreshnessBadge,
      isYoutubeActionLabelApplied: (el, label) => root._isYoutubeActionLabelApplied(el, label),
      isYoutubeCommentCount: (el) => root._isYoutubeCommentCount(el),
      isYoutubeCommentLabelApplied: (el) => root._isYoutubeCommentLabelApplied(el),
      shouldCollapseYoutubeFeedbackCount: (el) => root._shouldCollapseYoutubeFeedbackCount(el),
      resolveYoutubeFeedbackCountTarget: (el) => root._resolveYoutubeFeedbackCountTarget(el),
      applyYoutubeActionLabel: (el, label) => root._applyYoutubeActionLabel(el, label),
      applyYoutubeCollapsedFeedbackCount: (el) => root._applyYoutubeCollapsedFeedbackCount(el),
      applyYoutubeCommentLabel: (el) => root._applyYoutubeCommentLabel(el),
      applyInstagramMetricCollapse: (el, attr) => root._applyInstagramMetricCollapse(el, attr),
      applyInstagramMetricLabel: instagramLabels.apply,
      recordCandidateDecision: (el, ctx, decision) => diagnosticsRuntime._recordCandidateDecision(el, ctx, decision),
    };
  },
  _flushCleanupQueues(ctx) {
    const timingEnabled = diagnosticsRuntime.isAuditEnabled() && Boolean(ctx?._debugOperation);
    const startedAt = timingEnabled ? nowMs() : 0;
    ownedMutationRuntime.runWithMutationCapture(ctx, 'post_chunk_cleanup', () => {
      root._flushDirtyFacebookMetadataClusters(ctx);
      root._flushDirtyYoutubeMetadataRows(ctx);
      root._flushDirtyXMetadataClusters(ctx);
      root._flushDirtyRedditTimeSeparators(ctx);
    });
    if (timingEnabled) {
      diagnosticsRuntime._recordScanCleanupTiming(ctx, Math.max(0, nowMs() - startedAt));
    }
  },
  _getCleanupHelpers() {
    return {
      isInstagramActive: root._isInstagramHost(),
      isTikTokActive: root._isTikTokHost(),
      restoreInstagramText: (el) => root._restoreInstagramText(el),
      restoreYoutubeActionLabel: (el) => root._restoreYoutubeActionLabel(el),
      restoreYoutubeCommentLabel: (el) => root._restoreYoutubeCommentLabel(el),
      restoreTikTokMetricLabel: (el) => root._restoreTikTokMetricLabel(el),
      restoreTikTokMetricTarget: (el) => root._restoreTikTokMetricTarget(el),
      syncFacebookMetadataForElement: (el) => root._syncFacebookMetadataForElement(el),
      syncYoutubeMetadataForElement: (el) => root._syncYoutubeMetadataForElement(el),
      syncXMetadataForElement: (el) => root._syncXMetadataForElement(el),
      syncRedditTimeSeparatorsForElement: (el) => root._syncRedditTimeSeparatorsForElement(el),
      restoreYoutubeMetadataRows: () => root._restoreYoutubeMetadataRows(),
      restoreFacebookMetadataClusters: () => root._restoreFacebookMetadataClusters(),
      restoreXMetadataClusters: () => root._restoreXMetadataClusters(),
      restoreXNewsMetadata: () => root._restoreXNewsMetadata(),
      restoreRedditTimeSeparators: () => root._restoreRedditTimeSeparators(),
    };
  },
  _syncFacebookMetadataCluster(cluster) {
    syncFacebookMetadataCluster(cluster, root._getMetricDomHelpers());
  },
  _syncFacebookMetadataForElement(el) {
    if (!root._isFacebookHost() || !(el instanceof Element)) return;
    syncFacebookMetadataForElement(el, root._getMetricDomHelpers());
  },
  _markFacebookMetadataDirty(el, ctx) {
    if (
      !root._isFacebookHost()
      || !(el instanceof Element)
      || !ctx?.dirtyFacebookMetadataClusters
    ) return;
    markFacebookMetadataDirty(el, ctx);
  },
  _flushDirtyFacebookMetadataClusters(ctx) {
    if (!root._isFacebookHost()) return;
    flushDirtyFacebookMetadataClusters(ctx, root._getMetricDomHelpers());
  },
  _restoreFacebookMetadataClusters() {
    if (!root._isFacebookHost()) return;
    restoreFacebookMetadataClusters();
  },
  _syncYoutubeMetadataRow(row) {
    syncYoutubeMetadataRow(row, root._getMetricDomHelpers());
  },
  _syncYoutubeMetadataForElement(el) {
    if (!root._isYoutubeHost() || !(el instanceof Element)) return;
    syncYoutubeMetadataForElement(el, root._getMetricDomHelpers());
  },
  _markYoutubeMetadataDirty(el, ctx) {
    if (!root._isYoutubeHost() || !(el instanceof Element) || !ctx?.dirtyMetadataRows) return;
    markYoutubeMetadataDirty(el, ctx);
  },
  _flushDirtyYoutubeMetadataRows(ctx) {
    flushDirtyYoutubeMetadataRows(ctx, root._getMetricDomHelpers());
  },
  _restoreYoutubeMetadataRows() {
    if (!root._isYoutubeHost()) return;
    restoreYoutubeMetadataRows(root._getMetricDomHelpers());
  },
  _syncXMetadataCluster(cluster) {
    syncXMetadataCluster(cluster, root._getMetricDomHelpers());
  },
  _syncXMetadataForElement(el) {
    if (!root._isXHost() || !(el instanceof Element)) return;
    syncXMetadataForElement(el, root._getMetricDomHelpers());
  },
  _markXMetadataDirty(el, ctx) {
    if (!root._isXHost() || !(el instanceof Element) || !ctx?.dirtyXMetadataClusters) return;
    markXMetadataDirty(el, ctx);
  },
  _flushDirtyXMetadataClusters(ctx) {
    flushDirtyXMetadataClusters(ctx, root._getMetricDomHelpers());
  },
  _restoreXMetadataClusters() {
    if (!root._isXHost()) return;
    restoreXMetadataClusters();
  },
  _applyXNewsMetadataReplacement(el, filterKeys) {
    if (!root._isXHost() || !(el instanceof Element)) return null;
    return applyXNewsMetadataReplacement(el, filterKeys);
  },
  _restoreXNewsMetadataElement(el) {
    if (!root._isXHost() || !(el instanceof Element)) return false;
    return restoreXNewsMetadataElement(el);
  },
  _restoreXNewsMetadata() {
    if (!root._isXHost()) return;
    restoreXNewsMetadata();
  },
  _syncRedditTimeSeparatorsForElement(el) {
    if (!root._isRedditHost() || !(el instanceof Element)) return;
    syncRedditTimeSeparatorsForElement(el, root._getMetricDomHelpers());
  },
  _markRedditTimeSeparatorDirty(el, ctx) {
    if (!root._isRedditHost() || !(el instanceof Element) || !ctx?.dirtyRedditTimeNodes) return;
    markRedditTimeSeparatorDirty(el, ctx);
  },
  _flushDirtyRedditTimeSeparators(ctx) {
    if (!root._isRedditHost()) return;
    flushDirtyRedditTimeSeparators(ctx, root._getMetricDomHelpers());
  },
  _restoreRedditTimeSeparators() {
    if (!root._isRedditHost()) return;
    restoreRedditTimeSeparators();
  },
  _hasActiveRedditShadowMetricPlan() {
    if (!root._isRedditHost()) return false;
    return lifecycleState.activeScanGroups.some(({ group, filterKeys }) => (
      group === 'engagement'
      && Array.isArray(filterKeys)
      && filterKeys.includes('feedbackCounts')
    ));
  },
  _queueRedditShadowMetricScan(roots) {
    if (!root._hasActiveRedditShadowMetricPlan()) return;
    const plan = scanRuntime.getCompiledPlanForGroup('engagement');
    const filterKeys = plan?.filterKeys?.filter((key) => key === 'feedbackCounts') || [];
    if (filterKeys.length === 0) return;
    scanRuntime.scanAndMark('engagement', filterKeys, {
      roots,
      source: 'direct',
      debugScheduleContext: diagnosticsRuntime.isAuditEnabled()
        ? { scheduledAt: nowMs(), flushIds: [] }
        : null,
      routingEvidence: {
        mutationKinds: ['childList'],
        attributeNames: [],
        rootsPrevalidated: true,
      },
    });
  },
  _ensureRedditShadowMetricsOwner() {
    if (!root._hasActiveRedditShadowMetricPlan()) {
      root._teardownRedditShadowMetricsOwner();
      return;
    }
    if (!lifecycleState.redditShadowMetricsOwner) {
      lifecycleState.redditShadowMetricsOwner = createRedditShadowMetricsOwner({
        onDirtyRoots: (roots) => root._queueRedditShadowMetricScan(roots),
        onFailure: (phase, error, details) => {
          reportSocialMetricsFailure(`reddit_${phase}`, error, details);
        },
      });
    }
    lifecycleState.redditShadowMetricsOwner.reconcile();
  },
  _reconcileRedditShadowMetricsOwner() {
    if (!lifecycleState.redditShadowMetricsOwner) return;
    try {
      lifecycleState.redditShadowMetricsOwner.reconcile();
    } catch (error) {
      reportSocialMetricsFailure('reddit_shadow_owner_reconcile', error);
    }
  },
  _teardownRedditShadowMetricsOwner() {
    if (!lifecycleState.redditShadowMetricsOwner) return;
    lifecycleState.redditShadowMetricsOwner.teardown();
    lifecycleState.redditShadowMetricsOwner = null;
  },
  _getHost() {
    return normalizeSocialMetricsHost(getHost());
  },
  _getInstagramMetricInfo(el) {
    return getInstagramMetricInfo(root._getHost(), el, { sourceText: instagramLabels.sourceText(el) });
  },
  _getXMetricInfo(el, ctx) {
    if (!root._isXHost() || !(el instanceof Element)) return null;
    return getXMetricInfo(el, ctx);
  },
  _getSelectorDriftSurface(el) {
    if (root._isInstagramHost()) return getInstagramSelectorDriftSurface(el);
    if (root._isXHost()) return getXSelectorDriftSurface(el);
    return null;
  },
  _resolveXMetricTargets(el, ctx, match) {
    if (!root._isXHost() || !(el instanceof Element)) return [el];
    return resolveXMetricTargets(el, ctx, match);
  },
  _shouldFastRejectInstagramCandidate(el, text = '') {
    return shouldFastRejectInstagramCandidate(root._getHost(), el, text);
  },
  _shouldReuseStableInstagramCandidate(el, ctx = {}) {
    if (!root._isInstagramHost()) return false;
    return shouldReuseStableInstagramCandidate(el, ctx);
  },
  _shouldSkipInstagramActionButton(el) {
    return shouldSkipInstagramActionButton(root._getHost(), el, { sourceText: instagramLabels.sourceText(el) });
  },
  _hasInstagramIcon(el) {
    return hasInstagramIcon(el);
  },
  _applyInstagramMetricCollapse(el, attr) {
    const targets = applyInstagramMetricCollapse(el, attr);
    for (const target of targets) instagramLabels.rememberCollapse(target, el, attr);
  },
  _restoreInstagramText(el) {
    instagramLabels.restore(el);
    restoreInstagramText(el);
  },
  _isYoutubeCommentCount(el) {
    if (!root._isYoutubeHost() || !(el instanceof Element)) return false;
    return isYoutubeCommentCount(el);
  },
  _isYoutubeCommentLabelApplied(el) {
    if (!root._isYoutubeHost() || !(el instanceof Element)) return false;
    return isYoutubeCommentLabelApplied(el);
  },
  _getYoutubeActionLabelInfo(el) {
    if (!root._isYoutubeHost() || !(el instanceof Element)) return null;
    return getYoutubeActionLabelInfo(el);
  },
  _isYoutubeActionLabelApplied(el, label) {
    if (!root._isYoutubeHost() || !(el instanceof Element)) return false;
    return isYoutubeActionLabelApplied(el, label);
  },
  _shouldCollapseYoutubeFeedbackCount(el) {
    if (!root._isYoutubeHost() || !(el instanceof Element)) return false;
    return shouldCollapseYoutubeFeedbackCount(el);
  },
  _resolveYoutubeFeedbackCountTarget(el) {
    if (!root._isYoutubeHost() || !(el instanceof Element)) return null;
    return resolveYoutubeFeedbackCountTarget(el);
  },
  _applyYoutubeActionLabel(el, label) {
    return applyYoutubeActionLabel(el, label);
  },
  _applyYoutubeCollapsedFeedbackCount(el) {
    return applyYoutubeCollapsedFeedbackCount(el);
  },
  _restoreYoutubeActionLabel(el) {
    restoreYoutubeActionLabel(el, root._getMetricDomHelpers());
  },
  _applyYoutubeCommentLabel(el) {
    return applyYoutubeCommentLabel(el);
  },
  _restoreYoutubeCommentLabel(el) {
    restoreYoutubeCommentLabel(el, root._getMetricDomHelpers());
  },
  _getTikTokMetricInfo(el) {
    if (!root._isTikTokHost() || !(el instanceof Element)) return null;
    return getTikTokMetricInfo(el);
  },
  _resolveTikTokMetricTargets(el, info) {
    if (!root._isTikTokHost() || !(el instanceof Element)) return null;
    return resolveTikTokMetricTargets(el, info);
  },
  _isTikTokMetricLabelApplied(el, info) {
    if (!root._isTikTokHost() || !(el instanceof Element)) return false;
    return tiktokLabels.isApplied(el, info);
  },
  _applyTikTokMetricLabel(el, info) {
    if (!root._isTikTokHost() || !(el instanceof Element)) return null;
    return tiktokLabels.apply(el, info);
  },
  _restoreTikTokMetricLabel(el) {
    if (!(el instanceof Element)) return false;
    return tiktokLabels.restore(el);
  },
  _collapseTikTokMetricTarget(el) {
    if (!root._isTikTokHost() || !(el instanceof Element)) return false;
    return collapseTikTokMetricTarget(el);
  },
  _restoreTikTokMetricTarget(el) {
    if (!(el instanceof Element)) return false;
    return tiktokMetricEffects.restore(el);
  },
  _normalizeRoots(roots) {
    return normalizeRoots(roots);
  },
  _filterScanRootsForGroup(group, filterKeys, roots) {
    if (!Array.isArray(roots) || roots.length === 0) return roots;
    if (!root._isYoutubeHost()) return roots;
    try {
      return roots.filter((root) => accessibleLabels.owns(root)
        || accessibleLabels.hasPendingRemovals()
        || isYoutubeSocialMetricRootRelevant(root, group, filterKeys));
    } catch (error) {
      reportSocialMetricsFailure('youtube_root_relevance_selector_failed', error, {
        group,
        filterKeys: Array.isArray(filterKeys) ? [...filterKeys] : [],
        selector: error?.selector || null,
        rootCount: roots.length,
      });
      return [];
    }
  },
  _getSemanticAdapter() {
    return createPlatformSemanticAdapter(root._getHost(), lifecycleState.activeScanGroups || []);
  },
  _collectMutationRoots(payload = {}) {
    const causalRoots = collectMutationCausalRoots(payload);
    const roots = root._isInstagramHost()
      ? causalRoots
      : collectMutationRoots(payload, { rootSelector: lifecycleState.metricRootSelector });
    const semanticRoots = root._getSemanticAdapter().collectMutationRoots(payload);
    // X can lose the last selector and semantic clue on the same mutation.
    // Retain the local causal subtree so its previous effects can be revoked.
    const resolvedRoots = root._normalizeRoots([
      ...roots, ...semanticRoots,
      ...tiktokMetricEffects.collectMutationRoots(payload),
      ...(root._isXHost() || accessibleLabels.hasRecords() || facebookReplyLabels.hasRecords()
        || tiktokMetricEffects.hasRecords() ? causalRoots : []),
    ]);
    diagnosticsRuntime._recordMutationRootDebug(payload, roots, semanticRoots, resolvedRoots);
    return resolvedRoots;
  },

  _collectMutationCausalRoots(payload = {}) {
    return collectMutationCausalRoots(payload);
  },

  _routeMutationGroups(payload = {}, roots = []) {
    let routes = [];
    const dispositions = [];
    try {
      routes = routeSocialMetricMutationGroups({
        payload,
        activeGroups: lifecycleState.activeScanGroups,
        roots,
        isRootRelevant: (mutationRoot, group, filterKeys) => (
          root._filterScanRootsForGroup(group, filterKeys, [mutationRoot]).length > 0
        ),
        recordDisposition: (entry) => dispositions.push(entry),
      });
    } catch (error) {
      reportSocialMetricsFailure('mutation_group_route', error, {
        rootCount: Array.isArray(roots) ? roots.length : 0,
      });
      return [];
    }

    diagnosticsRuntime._recordMutationRoutingDebug(routes, dispositions, roots);
    const causalRoots = root._collectMutationCausalRoots(payload);
    return routes.map((route) => ({
      ...route,
      causalRoots,
      rootsPrevalidated: true,
    }));
  },

  _shouldIncludeCollectedCandidate(el, ctx = {}) {
    if (!(el instanceof Element)) return false;
    if (!ctx?.isInstagram) return true;
    return !root._shouldFastRejectInstagramCandidate(el);
  },

  _clearMarks(type) {
    const timingEnabled = diagnosticsRuntime.isAuditEnabled();
    const startedAt = timingEnabled ? nowMs() : 0;
    try {
      return ownedMutationRuntime.runWithMutationCapture(
        null,
        'configuration_cleanup',
        () => {
          xMetricEffects.clearGroup(type, (record) => {
            const ctx = {
              ...record, isX: true,
              dirtyXMetadataClusters: new Set(),
            };
            clearMetricMark(record.target, ctx, root._getCandidateMatcherHelpers());
            root._flushDirtyXMetadataClusters(ctx);
          });
          instagramLabels.clearGroup(type, (record) => {
            clearMetricMark(record.target, {
              ...record, isInstagram: true,
            }, root._getCandidateMatcherHelpers());
          });
          tiktokMetricEffects.clearGroup(type);
          clearMetricMarks(type, root._getCleanupHelpers());
          accessibleLabels.clearGroup(type);
          if (type === 'engagement') {
            instagramLabels.restoreAll();
            tiktokLabels.restoreAll();
            facebookReplyLabels.restoreAll();
          }
        },
      );
    } finally {
      if (timingEnabled) {
        diagnosticsRuntime._recordConfigurationCleanupTiming(Math.max(0, nowMs() - startedAt));
      }
    }
  },

  update(socialMetricsSetting, { targetProfile = null } = {}) {
    const runtimeState = createSocialMetricRuntimeState({
      socialMetricsSetting,
      hostname: root._getHost(),
      targetProfile,
      resolveTextPatterns: getSocialMetricTextPatternsForHost,
    });
    const observerInterestPlan = compileSocialMetricObserverInterest({
      rootSelector: runtimeState.compiled.rootSelector,
      plans: runtimeState.compiled.plans,
      semanticMutationAttributes: getPlatformSemanticMutationAttributes(root._getHost()),
      ownerMutationAttributes: root._getMarkedMetricAttrSet(),
    });
    const previousObserverInterestSignature = lifecycleState.observerInterestPlan?.signature || null;
    const previousEngagementActive = lifecycleState.activeEngagement;
    const previousExposureActive = lifecycleState.activeExposure;
    const engagementActive = runtimeState.engagementActive;
    const exposureActive = runtimeState.exposureActive;
    if (!engagementActive && !exposureActive) {
      root.remove();
      return;
    }

    lifecycleState.activeEngagement = engagementActive;
    lifecycleState.activeExposure = exposureActive;
    lifecycleState.activeMetricKeys = runtimeState.activeMetricKeys;
    if (!runtimeState.hasPlans) {
      root.remove();
      return;
    }
    lifecycleState.compiledScanPlans = runtimeState.compiled.plans;
    lifecycleState.metricRootSelector = runtimeState.compiled.rootSelector;
    lifecycleState.observerInterestPlan = observerInterestPlan;
    lifecycleState.activeScanGroups = runtimeState.activeScanGroups.map((entry) => ({
      ...entry,
      attributeNames: observerInterestPlan.groupAttributeNames[entry.group] || [],
    }));

    const rejectUpdate = (error) => {
      reportSocialMetricsFailure('manager_update', error, {
        hostname: root._getHost(),
        engagementActive,
        exposureActive,
      });
      try {
        root._cleanupInFlight({ deactivate: true, throwOnFailure: true });
      } catch (cleanupError) {
        if (error && typeof error === 'object') error.cleanupError = cleanupError;
      }
      root._resetRuntimeState();
      throw error;
    };

    try {
      if (
        lifecycleState.observerUnsub
        && previousObserverInterestSignature !== observerInterestPlan.signature
      ) {
        root._teardownObserver();
      }
      setRootAttribute(ROOT_ATTRS.SOCIAL_METRICS, '1');

      const nextSignature = runtimeState.signature;
      const isSameConfig = nextSignature === lifecycleState.lastUpdateSignature;
      lifecycleState.lastUpdateSignature = nextSignature;

      if (!isSameConfig) {
        scanRuntime.cancel();
      }
      if (!root._hasActiveRedditShadowMetricPlan()) {
        root._teardownRedditShadowMetricsOwner();
      }
      const shouldClearEngagement = previousEngagementActive
        && (!engagementActive || !isSameConfig);
      const shouldClearExposure = previousExposureActive
        && (!exposureActive || !isSameConfig);
      if (shouldClearEngagement) root._clearMarks('engagement');
      if (shouldClearExposure) root._clearMarks('exposure');
      root._ensureRedditShadowMetricsOwner();
      if (!isSameConfig) {
        lifecycleState.activeScanGroups.forEach(({ group, filterKeys }) => {
          scanRuntime.scanAndMark(group, filterKeys, {
            source: 'update',
            fullScanEvidence: {
              dirtyRootsSufficient: false,
              dirtyRootCount: 0,
              reason: 'activation_configuration_changed',
            },
          });
        });
      }
      root._ensureObserver();
      if (!isSameConfig) {
        return scanRuntime.whenSettled().catch((error) => rejectUpdate(error));
      }
      return undefined;
    } catch (error) {
      return rejectUpdate(error);
    }
  },

  remove() {
    try {
      root._cleanupInFlight({
        deactivate: true,
        throwOnFailure: true,
        preserveActiveOnFailure: true,
      });
    } catch (error) {
      const removeError = createSocialMetricsLifecycleError(
        'SOCIAL_METRICS_MANAGER_REMOVE_FAILED',
        error?.errors || [error]
      );
      reportSocialMetricsFailure('manager_remove', removeError);
      throw removeError;
    }
  },

  _ensureObserver() {
    if (lifecycleState.observerUnsub) return;
    const attributeFilter = lifecycleState.observerInterestPlan?.observedAttributes;
    if (!Array.isArray(attributeFilter) || attributeFilter.length === 0) {
      throw new Error('SOCIAL_METRIC_OBSERVER_INTEREST_REQUIRED');
    }
    try {
      lifecycleState.observerUnsub = observerHub.subscribe(
        (payload, debugContext) => {
          root._reconcileRedditShadowMetricsOwner();
          const filteredPayload = ownedMutationRuntime.filterPayload(payload);
          if (filteredPayload) {
            xMetricEffects.observeRemovals(filteredPayload, lifecycleState.activeScanGroups);
            accessibleLabels.observeRemovals(filteredPayload);
            instagramLabels.observeRemovals(filteredPayload, lifecycleState.activeScanGroups);
            tiktokMetricEffects.observeRemovals(filteredPayload, lifecycleState.activeScanGroups);
            scanRuntime.scheduleScan(filteredPayload, debugContext);
          }
        },
        {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter,
          debugLabel: 'SocialMetricsManager.observer',
        }
      );
      ownedMutationRuntime.syncObservationContext();
    } catch (error) {
      lifecycleState.observerUnsub = null;
      reportSocialMetricsFailure('observer_subscribe', error);
      throw error;
    }
  },

  _teardownObserver() {
    if (!lifecycleState.observerUnsub) return;
    try {
      lifecycleState.observerUnsub();
      lifecycleState.observerUnsub = null;
      ownedMutationRuntime.resetRuntimeState();
    } catch (error) {
      reportSocialMetricsFailure('observer_unsubscribe', error);
      throw error;
    }
  },

  _resetRuntimeState() {
    lifecycleState.activeEngagement = false;
    lifecycleState.activeExposure = false;
    lifecycleState.activeMetricKeys = [];
    lifecycleState.activeScanGroups = [];
    lifecycleState.compiledScanPlans = [];
    lifecycleState.metricRootSelector = '';
    lifecycleState.observerInterestPlan = null;
    lifecycleState.lastUpdateSignature = null;
    scanRuntime.resetRuntimeState();
    ownedMutationRuntime.resetRuntimeState();
    ownedMutationRuntime.resetCaptureState();
    diagnosticsRuntime.resetRuntimeState();
  },

  _cleanupInFlight({
    deactivate = false,
    throwOnFailure = false,
    preserveActiveOnFailure = false,
  } = {}) {
    const previousState = {
      activeEngagement: lifecycleState.activeEngagement,
      activeExposure: lifecycleState.activeExposure,
    };
    const errors = [];

    root._runCleanupStep('cleanup_observer', () => root._teardownObserver(), errors);
    root._runCleanupStep(
      'cleanup_reddit_shadow_owner',
      () => root._teardownRedditShadowMetricsOwner(),
      errors,
    );
    root._runCleanupStep('cleanup_scan_timer', () => scanRuntime.clearTimer(), errors);
    root._runCleanupStep('cleanup_scan_queue', () => scanRuntime.cancel(), errors);
    root._runCleanupStep('cleanup_engagement_marks', () => root._clearMarks('engagement'), errors);
    root._runCleanupStep('cleanup_exposure_marks', () => root._clearMarks('exposure'), errors);
    root._runCleanupStep('cleanup_metric_artifacts', () => {
      restoreAllMetricArtifacts(root._getCleanupHelpers());
    }, errors);
    root._runCleanupStep('cleanup_root_attribute', () => {
      removeRootAttribute(ROOT_ATTRS.SOCIAL_METRICS);
    }, errors);

    const shouldThrow = errors.length > 0 && throwOnFailure;
    if (shouldThrow && deactivate && preserveActiveOnFailure) {
      lifecycleState.activeEngagement = previousState.activeEngagement;
      lifecycleState.activeExposure = previousState.activeExposure;
      throw createSocialMetricsLifecycleError('SOCIAL_METRICS_MANAGER_CLEANUP_FAILED', errors);
    }
    if (deactivate) {
      root._resetRuntimeState();
    }
    if (shouldThrow) {
      throw createSocialMetricsLifecycleError('SOCIAL_METRICS_MANAGER_CLEANUP_FAILED', errors);
    }
  },

  _runCleanupStep(phase, cleanup, errors) {
    try {
      cleanup();
    } catch (error) {
      errors.push(error);
      reportSocialMetricsFailure(phase, error);
    }
  },
  });

  const readLifecycleSnapshot = () => Object.freeze({
    activeEngagement: lifecycleState.activeEngagement,
    activeExposure: lifecycleState.activeExposure,
    activeMetricKeys: Object.freeze([...lifecycleState.activeMetricKeys]),
    activeScanGroups: Object.freeze(lifecycleState.activeScanGroups.map((entry) => ({
      ...entry,
      filterKeys: Array.isArray(entry.filterKeys) ? [...entry.filterKeys] : [],
      attributeNames: Array.isArray(entry.attributeNames) ? [...entry.attributeNames] : [],
    }))),
    compiledScanPlans: Object.freeze([...lifecycleState.compiledScanPlans]),
    lastUpdateSignature: lifecycleState.lastUpdateSignature,
    metricRootSelector: lifecycleState.metricRootSelector,
    observerAttached: typeof lifecycleState.observerUnsub === 'function',
    observerInterestPlan: lifecycleState.observerInterestPlan,
    redditShadowObserverRootCount:
      lifecycleState.redditShadowMetricsOwner?.getObservedRootCount?.() || 0,
  });
  const requirePeer = (peer, code) => {
    if (!peer) throw new Error(code);
    return peer;
  };

  const diagnosticsOwnerPort = Object.freeze({
    getHost: () => root._getHost(),
    readLifecycleSnapshot,
  });
  const diagnosticsScanPort = Object.freeze({
    readSnapshot: () => requirePeer(
      scanRuntime,
      'SOCIAL_METRICS_SCAN_RUNTIME_NOT_INITIALIZED',
    ).readSnapshot(),
  });
  const diagnosticsOwnedMutationPort = Object.freeze({
    getActiveCandidateWriteCapture: () => requirePeer(
      ownedMutationRuntime,
      'SOCIAL_METRICS_OWNED_MUTATION_RUNTIME_NOT_INITIALIZED',
    ).getActiveCandidateWriteCapture(),
    getPendingSnapshot: () => requirePeer(
      ownedMutationRuntime,
      'SOCIAL_METRICS_OWNED_MUTATION_RUNTIME_NOT_INITIALIZED',
    ).getPendingSnapshot(),
    syncObservationContext: () => requirePeer(
      ownedMutationRuntime,
      'SOCIAL_METRICS_OWNED_MUTATION_RUNTIME_NOT_INITIALIZED',
    ).syncObservationContext(),
  });
  diagnosticsRuntime = createSocialMetricsDiagnosticsRuntime({
    ownerPort: diagnosticsOwnerPort,
    scanPort: diagnosticsScanPort,
    ownedMutationPort: diagnosticsOwnedMutationPort,
  });

  const ownedMutationOwnerPort = Object.freeze({
    isObserverAttached: () => typeof lifecycleState.observerUnsub === 'function',
  });
  const ownedMutationDiagnosticsPort = Object.freeze({
    formatNodeIdentity: (identity) => diagnosticsRuntime.formatNodeIdentity(identity),
    getNodeIdentity: (node) => diagnosticsRuntime.getNodeIdentity(node),
    isAuditEnabled: () => diagnosticsRuntime.isAuditEnabled(),
    recordOwnedMutationFilter: (details) => (
      diagnosticsRuntime.recordOwnedMutationFilter(details)
    ),
    recordOwnedMutationLedgerAttempt: (details) => (
      diagnosticsRuntime.recordOwnedMutationLedgerAttempt(details)
    ),
    recordWriteAttempt: (ctx, details) => diagnosticsRuntime.recordWriteAttempt(ctx, details),
    recordWriteProbeDuration: (durationMs) => (
      diagnosticsRuntime.recordWriteProbeDuration(durationMs)
    ),
    registerActualWriteTarget: (target) => (
      diagnosticsRuntime.registerActualWriteTarget(target)
    ),
  });
  ownedMutationRuntime = createSocialMetricsOwnedMutationRuntime({
    nowMs,
    ownerPort: ownedMutationOwnerPort,
    diagnosticsPort: ownedMutationDiagnosticsPort,
  });

  const scanOwnerPort = Object.freeze({
    collectMutationRoots: (payload) => root._collectMutationRoots(payload),
    filterScanRootsForGroup: (group, filterKeys, roots) => (
      root._filterScanRootsForGroup(group, filterKeys, roots)
    ),
    flushCleanupQueues: (ctx) => root._flushCleanupQueues(ctx),
    getCandidateMatcherHelpers: () => root._getCandidateMatcherHelpers(),
    getSemanticAdapter: () => root._getSemanticAdapter(),
    normalizeRoots: (roots) => root._normalizeRoots(roots),
    readScanConfiguration: () => {
      const lifecycle = readLifecycleSnapshot();
      return Object.freeze({
        activeScanGroups: lifecycle.activeScanGroups,
        compiledScanPlans: lifecycle.compiledScanPlans,
        lastUpdateSignature: lifecycle.lastUpdateSignature,
      });
    },
    routeMutationGroups: (payload, roots) => root._routeMutationGroups(payload, roots),
    shouldIncludeCollectedCandidate: (candidate, context) => (
      root._shouldIncludeCollectedCandidate(candidate, context)
    ),
  });
  const scanDiagnosticsPort = Object.freeze({
    beginScanChunk: (entry) => diagnosticsRuntime._beginScanChunk(entry),
    canRunDeepSelectorProbe: () => diagnosticsRuntime._canRunDeepSelectorProbe(),
    clearMutationScheduleContext: () => diagnosticsRuntime.clearMutationScheduleContext(),
    consumeMutationScheduleContext: () => diagnosticsRuntime._consumeMutationScheduleContext(),
    finishScanChunk: (entry, details) => diagnosticsRuntime._finishScanChunk(entry, details),
    finishScanOperation: (entry, outcome, error) => (
      diagnosticsRuntime._finishScanOperation(entry, outcome, error)
    ),
    isAuditEnabled: () => diagnosticsRuntime.isAuditEnabled(),
    recordCandidateCollection: (entry, count) => (
      diagnosticsRuntime._recordCandidateCollectionDebug(entry, count)
    ),
    recordCandidateDiscoveryVisit: (entry, node) => (
      diagnosticsRuntime._recordCandidateDiscoveryVisit(entry, node)
    ),
    recordCandidateProvenance: (entry, candidate, provenance) => (
      diagnosticsRuntime.recordCandidateProvenance(entry, candidate, provenance)
    ),
    recordMutationScheduleContext: (debugContext) => (
      diagnosticsRuntime._recordMutationScheduleContext(debugContext)
    ),
    recordProcessedCandidate: () => diagnosticsRuntime._recordProcessedCandidate(),
    recordQueuedScan: (...args) => diagnosticsRuntime._recordQueuedScanDebug(...args),
    recordScanApplyTiming: (entry, durationMs) => (
      diagnosticsRuntime._recordScanApplyTiming(entry, durationMs)
    ),
    recordScanCollectionTiming: (entry, details) => (
      diagnosticsRuntime._recordScanCollectionTiming(entry, details)
    ),
    recordScanIdleScheduled: (entry) => diagnosticsRuntime._recordScanIdleScheduled(entry),
    recordScanRootDiscoveryVisit: (entry, node) => (
      diagnosticsRuntime._recordScanRootDiscoveryVisit(entry, node)
    ),
    recordSelectorAudit: (entry, audit) => diagnosticsRuntime._recordSelectorAudit(entry, audit),
    recordSkippedRootScan: (...args) => diagnosticsRuntime._recordSkippedRootScanDebug(...args),
    startScanOperation: (entry) => diagnosticsRuntime._startScanOperation(entry),
  });
  const scanOwnedMutationPort = Object.freeze({
    runWithCandidateWriteCapture: (ctx, operation) => (
      ownedMutationRuntime.runWithCandidateWriteCapture(ctx, operation)
    ),
    runWithScanChunkMutationCapture: (ctx, operation) => (
      ownedMutationRuntime.runWithScanChunkMutationCapture(ctx, operation)
    ),
  });
  scanRuntime = createSocialMetricsScanRuntime({
    reportFailure: reportSocialMetricsFailure,
    ownerPort: scanOwnerPort,
    diagnosticsPort: scanDiagnosticsPort,
    ownedMutationPort: scanOwnedMutationPort,
  });

  return Object.freeze({
    update(socialMetricsSetting, options = {}) {
      return root.update(socialMetricsSetting, options);
    },
    remove() {
      return root.remove();
    },
    setDebugAuditMode(mode, options = {}) {
      return diagnosticsRuntime.setDebugAuditMode(mode, options);
    },
    getDebugSnapshot() {
      return diagnosticsRuntime.getDebugSnapshot();
    },
    getTargetingHealthSnapshot() {
      return diagnosticsRuntime.getTargetingHealthSnapshot();
    },
    resetDebugSnapshot() {
      return diagnosticsRuntime.resetDebugSnapshot();
    },
    beginDebugMeasurementEpoch() {
      return diagnosticsRuntime.beginDebugMeasurementEpoch();
    },
  });
}

const SocialMetricsManager = createSocialMetricsRuntime();

export default SocialMetricsManager;
