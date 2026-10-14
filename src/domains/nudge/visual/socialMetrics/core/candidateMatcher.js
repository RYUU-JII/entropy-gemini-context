import { SOCIAL_METRIC_ATTRS } from '../../../core/constants.js';
import {
  removeAttribute,
  setAttribute,
} from '../../FastStyleEngine.js';

function queueCleanup(el, ctx, helpers) {
  helpers.markFacebookMetadataDirty?.(el, ctx);
  helpers.markYoutubeMetadataDirty?.(el, ctx);
  helpers.markXMetadataDirty?.(el, ctx);
  helpers.markRedditTimeSeparatorDirty?.(el, ctx);
}

function restoreMetricArtifacts(el, ctx, helpers) {
  if (ctx.isInstagram) {
    helpers.restoreInstagramText?.(el);
  }
  helpers.restoreYoutubeActionLabel?.(el);
  helpers.restoreYoutubeCommentLabel?.(el);
  helpers.restoreTikTokMetricLabel?.(el);
  helpers.restoreFacebookReplyLabel?.(el);
}

export function clearMetricMark(el, ctx, helpers, { restoreYoutubeLabel = true } = {}) {
  if (ctx.isTikTok) {
    const effectCleared = helpers.restoreTikTokMetricEffect(el);
    const labelCleared = helpers.restoreTikTokMetricLabel(el);
    return effectCleared || labelCleared;
  }
  // Capture decorated ancestors before their last metric mark disappears.
  if (ctx.isX) helpers.markXMetadataDirty?.(el, ctx);
  const restoredXNewsMetadata = ctx.isX
    ? helpers.restoreXNewsMetadataElement?.(el) === true
    : false;
  const hadMark = el.hasAttribute(ctx.attr)
    || helpers.hasInstagramMetricLabel?.(el)
    || helpers.hasFacebookReplyLabel?.(el)
    || el.hasAttribute(SOCIAL_METRIC_ATTRS.ACTION_LABEL)
    || el.hasAttribute(SOCIAL_METRIC_ATTRS.COMMENT_LABEL)
    || el.hasAttribute(SOCIAL_METRIC_ATTRS.INSTAGRAM_COLLAPSE)
    || el.hasAttribute(SOCIAL_METRIC_ATTRS.TIKTOK_LABEL)
    || el.hasAttribute(SOCIAL_METRIC_ATTRS.TIKTOK_COLLAPSE);
  if (el.hasAttribute(ctx.attr)) {
    removeAttribute(el, ctx.attr);
  }
  helpers.forgetXMetricEffect?.(el);
  if (!hadMark && !restoredXNewsMetadata) return false;

  if (ctx.isInstagram) {
    helpers.restoreInstagramText?.(el);
  }
  if (restoreYoutubeLabel) {
    helpers.restoreYoutubeActionLabel?.(el);
    helpers.restoreYoutubeCommentLabel?.(el);
  }
  helpers.restoreTikTokMetricLabel?.(el);
  helpers.restoreTikTokMetricTarget?.(el);
  helpers.restoreFacebookReplyLabel?.(el);
  queueCleanup(el, ctx, helpers);
  return true;
}

function removeOtherMetricMark(el, attr) {
  const otherAttr = attr === SOCIAL_METRIC_ATTRS.ENGAGEMENT
    ? SOCIAL_METRIC_ATTRS.EXPOSURE
    : SOCIAL_METRIC_ATTRS.ENGAGEMENT;
  if (el.hasAttribute(otherAttr)) {
    removeAttribute(el, otherAttr);
    return true;
  }
  return false;
}

function getCandidateText(el, ctx, helpers) {
  if (ctx.isX) return (helpers.getXMetricSourceText(el) || '').trim();
  if (ctx.isFacebook && helpers.getFacebookReplySourceText) return helpers.getFacebookReplySourceText(el).trim();
  const textSource =
    (ctx.isInstagram || ctx.isYoutube || ctx.isX || ctx.isTikTok)
      && el.hasAttribute(SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT)
      ? el.getAttribute(SOCIAL_METRIC_ATTRS.ORIGINAL_TEXT)
      : el.textContent;
  return (textSource || '').trim();
}

function resolveMetricMatch(el, ctx, helpers) {
  if (ctx.isYoutube && helpers.isYoutubeThumbnailBadge(el)) {
    const matched = ctx.group === 'exposure'
      && ctx.filterKeys.includes('timeSignals')
      && helpers.isYoutubeFreshnessBadge(el);
    return { matched, matchedKey: matched ? 'timeSignals' : null };
  }
  if (ctx.isFacebook && (helpers.isFacebookReplyLabelCandidate?.(el) || helpers.hasFacebookReplyLabel?.(el))) {
    const info = helpers.getFacebookReplyMetricInfo(el);
    if (info && info.group === ctx.group && ctx.filterKeys.includes(info.key)) {
      return { matched: true, matchedKey: info.key, facebookInfo: info };
    }
    return { matched: false, matchedKey: null };
  }
  if (ctx.isInstagram) {
    const info = helpers.getInstagramMetricInfo?.(el) || null;
    if (info && info.group === ctx.group && ctx.filterKeys.includes(info.key)) {
      return { matched: true, matchedKey: info.key, instagramInfo: info, xInfo: null };
    }
    return { matched: false, matchedKey: null, instagramInfo: null, xInfo: null };
  }

  if (ctx.isX) {
    const info = helpers.getXMetricInfo?.(el, ctx) || null;
    if (info && info.group === ctx.group && ctx.filterKeys.includes(info.key)) {
      return { matched: true, matchedKey: info.key, instagramInfo: null, xInfo: info };
    }
    if (helpers.requiresXActionMetricQualification?.(el, ctx)) {
      return { matched: false, matchedKey: null, instagramInfo: null, xInfo: null };
    }
    // A bare numeric string is not metric evidence after its selector/semantic
    // context disappeared. Revalidation must not turn this into a regex match.
    if (!el.matches(ctx.joinedSelector)) {
      return { matched: false, matchedKey: null, instagramInfo: null, xInfo: null };
    }
  }

  if (ctx.isTikTok) {
    const info = helpers.getTikTokMetricInfo?.(el) || null;
    if (info && info.group === ctx.group && ctx.filterKeys.includes(info.key)) {
      return {
        matched: true,
        matchedKey: info.key,
        instagramInfo: null,
        xInfo: null,
        tiktokInfo: info,
      };
    }
    // Replacement markers retain cleanup discovery after scope loss. Their
    // saved native count must not establish a new generic metric match.
    if (el.hasAttribute(SOCIAL_METRIC_ATTRS.TIKTOK_LABEL)) {
      return { matched: false, matchedKey: null, tiktokInfo: null };
    }
    if (!el.matches(ctx.joinedSelector)) {
      return { matched: false, matchedKey: null, tiktokInfo: null };
    }
  }

  const matchedKey = ctx.filterKeys.find((filterKey) => (
    ctx.patternMap?.[filterKey]?.some((re) => re.test(getCandidateText(el, ctx, helpers)))
  ));
  return {
    matched: !!matchedKey,
    matchedKey: matchedKey || null,
    instagramInfo: null,
    xInfo: null,
    tiktokInfo: null,
  };
}

function recordCandidateDecision(el, ctx, helpers, decision = {}) {
  const recoverySurface = helpers.getSelectorDriftSurface?.(el, ctx, decision) || null;
  helpers.recordCandidateDecision?.(el, ctx, {
    ...decision,
    recoverySurface,
  });
}

export function queryMetricCandidates({
  list,
  joinedSelector = '',
  roots = null,
}) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const selector = joinedSelector || list.join(',');
  if (roots === null) {
    return Array.from(document.querySelectorAll(selector));
  }
  if (!Array.isArray(roots) || roots.length === 0) return [];

  const candidates = new Set();
  roots.forEach((root) => {
    if (!(root instanceof Element)) return;
    if (root.matches?.(selector)) {
      candidates.add(root);
    }
    if (typeof root.querySelectorAll === 'function') {
      root.querySelectorAll(selector).forEach((el) => {
        candidates.add(el);
      });
    }
  });
  return Array.from(candidates);
}

export function collectMetricCandidates({
  list,
  joinedSelector = '',
  roots = null,
  shouldIncludeCandidate = null,
}) {
  return queryMetricCandidates({ list, joinedSelector, roots }).filter((el) => (
    typeof shouldIncludeCandidate === 'function' ? shouldIncludeCandidate(el) : true
  ));
}

export function applyMetricScanCandidate(el, ctx, helpers) {
  if (!(el instanceof Element)) return;
  if (!el.isConnected) return;

  const accessibleLabel = helpers.applyAccessibleMetricLabel?.(el, ctx);
  if (helpers.isAccessibleMetricLabelContainer?.(el)) {
    const cleared = clearMetricMark(el, ctx, helpers);
    recordCandidateDecision(el, ctx, helpers, {
      action: accessibleLabel
        ? accessibleLabel.changed ? 'replace:accessible-metric-label' : 'replace:accessible-label-unchanged'
        : cleared ? 'clear:accessible-metric-container' : 'skip:accessible-metric-container',
      target: el, matchedKey: accessibleLabel?.keys[0] || null, cleared,
    });
    return;
  }

  if (ctx.isInstagram && helpers.shouldReuseStableInstagramCandidate?.(el, ctx)) {
    recordCandidateDecision(el, ctx, helpers, {
      action: 'collapse:instagram-stable-candidate-unchanged',
      target: el,
    });
    return;
  }

  const text = getCandidateText(el, ctx, helpers);
  if (ctx.isInstagram && helpers.shouldFastRejectInstagramCandidate?.(el, text)) {
    const cleared = clearMetricMark(el, ctx, helpers);
    recordCandidateDecision(el, ctx, helpers, {
      action: 'clear:instagram-fast-reject',
      text,
      cleared,
    });
    return;
  }

  if (ctx.isInstagram && helpers.shouldSkipInstagramActionButton?.(el)) {
    const cleared = clearMetricMark(el, ctx, helpers, { restoreYoutubeLabel: false });
    recordCandidateDecision(el, ctx, helpers, {
      action: 'clear:instagram-action-button',
      text,
      cleared,
    });
    return;
  }

  if (ctx.isInstagram && helpers.hasInstagramIcon?.(el)) {
    const cleared = clearMetricMark(el, ctx, helpers, { restoreYoutubeLabel: false });
    recordCandidateDecision(el, ctx, helpers, {
      action: 'clear:instagram-icon',
      text,
      cleared,
    });
    return;
  }

  if (!text) {
    const cleared = clearMetricMark(el, ctx, helpers);
    recordCandidateDecision(el, ctx, helpers, {
      action: 'skip:empty-text',
      cleared,
    });
    return;
  }

  const {
    matched,
    matchedKey,
    instagramInfo,
    xInfo,
    tiktokInfo,
    facebookInfo,
  } = resolveMetricMatch(el, ctx, helpers);
  if (!matched) {
    const cleared = clearMetricMark(el, ctx, helpers);
    recordCandidateDecision(el, ctx, helpers, {
      action: 'clear:no-match',
      text,
      cleared,
    });
    return;
  }

  if (ctx.isFacebook && facebookInfo?.replacementLabel) {
    const target = helpers.applyFacebookReplyLabel(el, facebookInfo.replacementLabel);
    recordCandidateDecision(el, ctx, helpers, {
      action: 'replace:facebook-reply-label', matchedKey, target, text,
      label: facebookInfo.replacementLabel,
    });
    return;
  }

  if (ctx.isTikTok && tiktokInfo?.replacementLabel) {
    if (helpers.isTikTokMetricLabelApplied?.(el, tiktokInfo)) {
      recordCandidateDecision(el, ctx, helpers, {
        action: 'skip:tiktok-label-unchanged',
        matchedKey,
        text,
      });
      return;
    }
    const target = helpers.applyTikTokMetricLabel?.(el, tiktokInfo);
    recordCandidateDecision(el, ctx, helpers, {
      action: 'replace:tiktok-label',
      matchedKey,
      target,
      text,
      label: tiktokInfo.replacementLabel,
    });
    return;
  }

  if (ctx.isTikTok) {
    const projectedTargets = helpers.resolveTikTokMetricTargets(el, tiktokInfo);
    const targets = Array.isArray(projectedTargets) && projectedTargets.length > 0 ? projectedTargets : [el];
    const uniqueTargets = Array.from(new Set(
      targets.filter((target) => target instanceof Element),
    ));
    let changedTargetCount = 0;
    uniqueTargets.forEach((target) => {
      const targetChanged = helpers.applyTikTokMetricEffect(target, el, ctx, {
        key: matchedKey, kind: tiktokInfo?.kind ?? null, dependencyScope: tiktokInfo?.dependencyScope,
      });
      if (targetChanged) changedTargetCount += 1;
    });
    recordCandidateDecision(el, ctx, helpers, {
      action: changedTargetCount === 0
        ? 'mark:tiktok-targets-unchanged'
        : 'mark:tiktok-targets',
      matchedKey,
      target: uniqueTargets,
      text,
    });
    return;
  }

  if (
    ctx.group === 'engagement'
    && ctx.filterKeys.includes('feedbackCounts')
    && helpers.isYoutubeCommentCount?.(el)
  ) {
    if (helpers.isYoutubeCommentLabelApplied?.(el)) {
      recordCandidateDecision(el, ctx, helpers, {
        action: 'skip:youtube-comment-label-unchanged',
        matchedKey,
        text,
      });
      return;
    }
    const target = helpers.applyYoutubeCommentLabel?.(el);
    recordCandidateDecision(el, ctx, helpers, {
      action: 'replace:youtube-comment-label',
      matchedKey,
      target,
      text,
    });
    return;
  }

  if (
    ctx.group === 'engagement'
    && ctx.filterKeys.includes('feedbackCounts')
  ) {
    if (helpers.shouldCollapseYoutubeFeedbackCount?.(el)) {
      const target = helpers.applyYoutubeCollapsedFeedbackCount?.(el);
      recordCandidateDecision(el, ctx, helpers, {
        action: 'collapse:youtube-feedback-count',
        matchedKey,
        target,
        text,
      });
      return;
    }
    const youtubeActionInfo = helpers.getYoutubeActionLabelInfo?.(el);
    if (youtubeActionInfo?.label) {
      if (helpers.isYoutubeActionLabelApplied?.(el, youtubeActionInfo.label)) {
        recordCandidateDecision(el, ctx, helpers, {
          action: 'skip:youtube-action-label-unchanged',
          matchedKey,
          text,
          label: youtubeActionInfo.label,
        });
        return;
      }
      const target = helpers.applyYoutubeActionLabel?.(el, youtubeActionInfo.label);
      recordCandidateDecision(el, ctx, helpers, {
        action: 'replace:youtube-action-label',
        matchedKey,
        target,
        text,
        label: youtubeActionInfo.label,
      });
      return;
    }
    const youtubeFeedbackTarget = helpers.resolveYoutubeFeedbackCountTarget?.(el);
    if (youtubeFeedbackTarget instanceof Element) {
      if (youtubeFeedbackTarget !== el && el.hasAttribute(ctx.attr)) {
        removeAttribute(el, ctx.attr);
      }
      removeOtherMetricMark(youtubeFeedbackTarget, ctx.attr);
      const targetAlreadyMarked = youtubeFeedbackTarget.getAttribute(ctx.attr) === '1';
      if (!targetAlreadyMarked) {
        setAttribute(youtubeFeedbackTarget, ctx.attr, '1');
      }
      queueCleanup(youtubeFeedbackTarget, ctx, helpers);
      recordCandidateDecision(el, ctx, helpers, {
        action: targetAlreadyMarked
          ? 'mark:youtube-feedback-target-unchanged'
          : 'mark:youtube-feedback-target',
        matchedKey,
        target: youtubeFeedbackTarget,
        text,
      });
      return;
    }
  }

  if (ctx.isInstagram && instagramInfo) {
    if (instagramInfo.replacementLabel) {
      const target = helpers.applyInstagramMetricLabel(el, instagramInfo.replacementLabel);
      recordCandidateDecision(el, ctx, helpers, {
        action: 'replace:instagram-count-label', matchedKey, target, text,
      });
      return;
    }
    helpers.applyInstagramMetricCollapse?.(el, ctx.attr);
    recordCandidateDecision(el, ctx, helpers, {
      action: 'collapse:instagram-metric-leaf',
      matchedKey,
      target: el,
      text,
    });
    queueCleanup(el, ctx, helpers);
    return;
  }

  if (ctx.isX) {
    const newsMetadata = helpers.applyXNewsMetadataReplacement?.(
      el,
      ctx.filterKeys,
    );
    if (newsMetadata) {
      helpers.rememberXMetricEffect(newsMetadata.target, ctx);
      recordCandidateDecision(el, ctx, helpers, {
        action: newsMetadata.changed
          ? 'replace:x-news-metadata'
          : 'replace:x-news-metadata-unchanged',
        matchedKey,
        target: newsMetadata.target,
        text,
        label: newsMetadata.nextText,
      });
      return;
    }
    const targets = helpers.resolveXMetricTargets?.(el, ctx, { matchedKey, xInfo });
    const resolvedTargets = Array.isArray(targets) ? targets.filter((target) => target instanceof Element) : [el];
    const uniqueTargets = Array.from(new Set(resolvedTargets));
    if (uniqueTargets.length === 0) {
      const cleared = clearMetricMark(el, ctx, helpers, { restoreYoutubeLabel: false });
      recordCandidateDecision(el, ctx, helpers, {
        action: 'clear:x-no-target',
        matchedKey,
        text,
        cleared,
      });
      return;
    }
    if (!uniqueTargets.includes(el) && el.hasAttribute(ctx.attr)) {
      removeAttribute(el, ctx.attr);
      queueCleanup(el, ctx, helpers);
    }
    let changedTargetCount = 0;
    uniqueTargets.forEach((target) => {
      let targetChanged = removeOtherMetricMark(target, ctx.attr);
      if (target.getAttribute(ctx.attr) !== '1') {
        setAttribute(target, ctx.attr, '1');
        targetChanged = true;
      }
      if (targetChanged) changedTargetCount += 1;
      helpers.rememberXMetricEffect(target, ctx);
      queueCleanup(target, ctx, helpers);
    });
    recordCandidateDecision(el, ctx, helpers, {
      action: changedTargetCount === 0 ? 'mark:x-targets-unchanged' : 'mark:x-targets',
      matchedKey,
      target: uniqueTargets,
      text,
    });
    return;
  }

  const targetAlreadyMarked = el.getAttribute(ctx.attr) === '1';
  if (!targetAlreadyMarked) {
    setAttribute(el, ctx.attr, '1');
  }
  recordCandidateDecision(el, ctx, helpers, {
    action: targetAlreadyMarked ? 'mark:generic-unchanged' : 'mark:generic',
    matchedKey,
    target: el,
    text,
  });
  queueCleanup(el, ctx, helpers);
}

export function revalidateXMetricEffect(record, ctx, helpers) {
  const { target } = record;
  if (!target.isConnected
    || !getCandidateText(target, ctx, helpers)
    || !resolveMetricMatch(target, ctx, helpers).matched) {
    helpers.runWithReconciliationDisposition(target, 'clear', () => {
      clearMetricMark(target, ctx, helpers);
    });
  }
}

export function revalidateTikTokMetricEffect(record, ctx, helpers) {
  const { target, metricTarget } = record;
  const match = metricTarget.isConnected ? resolveMetricMatch(metricTarget, ctx, helpers) : null;
  const projected = match?.matched ? helpers.resolveTikTokMetricTargets(metricTarget, match.tiktokInfo) : null;
  const targets = Array.isArray(projected) && projected.length > 0 ? projected : [metricTarget];
  if (target.isConnected && match?.matched && match.matchedKey === record.key
    && (record.kind === null || match.tiktokInfo?.kind === record.kind) && targets.includes(target)) return;
  helpers.runWithReconciliationDisposition(target, 'clear', () => helpers.restoreTikTokMetricEffect(target));
}
