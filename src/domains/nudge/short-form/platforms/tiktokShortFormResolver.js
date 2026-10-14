const TIKTOK_FEED_ITEM_SELECTOR = '[data-e2e="recommend-list-item-container"]';
const TIKTOK_HIDDEN_TARGET_SELECTOR = '[data-friction-shortform-hidden="1"]';
const TIKTOK_RECONCILIATION_SELECTOR = `${TIKTOK_FEED_ITEM_SELECTOR}, ${TIKTOK_HIDDEN_TARGET_SELECTOR}`;
const TIKTOK_SINGLE_VIDEO_PATH_RE = /^\/@[^/]+\/video\/\d+(?:\/|$)/i;
export const TIKTOK_SHORT_FORM_MUTATION_ATTRIBUTES = Object.freeze(['data-e2e']);

function createPruneIntent(target) {
  return Object.freeze({
    type: 'prune',
    target,
    candidate: target,
    reason: 'tiktok_single_video_followup',
    pruneModeOverride: 'hide',
  });
}

function createRestoreIntent(target, reason = 'tiktok_selected_video_or_non_feed_surface') {
  return Object.freeze({
    type: 'restore',
    target,
    reason,
    expectedPruneReason: 'tiktok_single_video_followup',
  });
}

function isTikTokSingleVideoPath(pathname = '') {
  return TIKTOK_SINGLE_VIDEO_PATH_RE.test(String(pathname || ''));
}

function collectTikTokFeedItems(root, dom) {
  if (!dom.isElement(root)) return Object.freeze({ failed: false, items: [], revoked: [] });
  const items = new Set();
  const revoked = new Set();
  const addCandidate = (candidate) => {
    if (!dom.isElement(candidate) || !candidate.isConnected) return true;
    const matches = dom.matches(candidate, TIKTOK_FEED_ITEM_SELECTOR, {
      reason: 'tiktok_single_video_feed_item',
    });
    if (dom.isFailure(matches)) return false;
    if (matches) items.add(candidate);
    else if (candidate.getAttribute('data-friction-shortform-hidden') === '1') revoked.add(candidate);
    return true;
  };

  if (!addCandidate(root)) return Object.freeze({ failed: true, items: [] });
  const owner = dom.closest(root, TIKTOK_RECONCILIATION_SELECTOR, {
    reason: 'tiktok_single_video_feed_item',
  });
  if (dom.isFailure(owner) || !addCandidate(owner)) {
    return Object.freeze({ failed: true, items: [] });
  }
  // The existing selector query is synchronous; an output cap cannot bound its
  // work and must not silently discard already-present follow-up items.
  const descendants = dom.queryAll(root, TIKTOK_RECONCILIATION_SELECTOR, {
    reason: 'tiktok_single_video_feed_item',
  });
  if (dom.isFailure(descendants)) return Object.freeze({ failed: true, items: [] });
  for (const candidate of descendants) {
    if (!addCandidate(candidate)) return Object.freeze({ failed: true, items: [] });
  }
  return Object.freeze({ failed: false, items: Array.from(items), revoked: Array.from(revoked) });
}

export function resolveTikTokShortFormActionIntents({
  root,
  pathname,
  documentElement,
  dom,
} = {}) {
  const collection = collectTikTokFeedItems(root, dom);
  if (collection.failed) return Object.freeze([]);
  const { items, revoked } = collection;
  // Hidden membership is discovery only. The manager's exact actuation reason
  // remains required before these negative intents can release an effect.
  const revokedIntents = revoked.map(target => createRestoreIntent(target, 'tiktok_feed_membership_revoked'));
  if (!isTikTokSingleVideoPath(pathname)) {
    return Object.freeze([...items.map((target) => createRestoreIntent(target)), ...revokedIntents]);
  }

  const selected = dom.queryOne(documentElement, TIKTOK_FEED_ITEM_SELECTOR, {
    reason: 'tiktok_single_video_selected_item',
  });
  if (dom.isFailure(selected)) return Object.freeze([]);
  const intents = [...revokedIntents];
  if (selected && items.includes(selected)) intents.push(createRestoreIntent(selected));
  for (const target of items) {
    if (target === selected) continue;
    const indicator = dom.closest(target, '[data-friction-indicator="1"]', {
      reason: 'tiktok_single_video_followup',
    });
    if (dom.isFailure(indicator)) return Object.freeze([]);
    if (!indicator) intents.push(createPruneIntent(target));
  }
  return Object.freeze(intents);
}
