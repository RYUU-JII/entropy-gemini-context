import { resolveSiteId } from '../../targeting/siteIdentityCatalog.js';

export const YOUTUBE_SHORT_FORM_MUTATION_ATTRIBUTES = Object.freeze([
  'href',
  'id',
  'role',
  'tab-title',
  'title',
  'aria-label',
  'active',
  'hidden',
  'is-watch-page',
]);

const YOUTUBE_CONTINUATION_SELECTOR = 'ytd-continuation-item-renderer';
const YOUTUBE_SHORT_MARKER_SELECTOR = [
  'a[href*="/shorts/"]',
  'a[href^="/shorts"]',
  'ytd-reel-item-renderer',
  'ytd-reel-video-renderer',
  'ytd-reel-shelf-renderer',
  'grid-shelf-view-model',
  'ytm-shorts-lockup-view-model-v2',
  'ytm-shorts-lockup-view-model',
  '.shortsLockupViewModelHost',
  '[is-shorts]',
].join(', ');
const YOUTUBE_SHORTS_GRID_SHELF_SELECTOR = 'grid-shelf-view-model';
const YOUTUBE_HORIZONTAL_SHELF_SELECTOR = 'ytd-shelf-renderer';
const YOUTUBE_HORIZONTAL_LIST_SELECTOR = 'yt-horizontal-list-renderer';
const YOUTUBE_SHORTS_LOCKUP_SELECTOR = [
  'ytm-shorts-lockup-view-model-v2',
  'ytm-shorts-lockup-view-model',
  '.shortsLockupViewModelHost',
].join(', ');
const YOUTUBE_CHANNEL_TAB_GROUP_SELECTOR = 'yt-tab-group-shape';
const YOUTUBE_CHANNEL_TAB_SELECTOR = 'yt-tab-shape[role="tab"]';
const YOUTUBE_TAB_SELECTOR = '[role="tab"]';
const YOUTUBE_TABLIST_SELECTOR = '[role="tablist"]';
const YOUTUBE_FILTER_CHIP_OWNER_SELECTOR = 'yt-chip-cloud-chip-renderer';
const YOUTUBE_FILTER_CHIP_CONTEXT_SELECTOR = [
  'yt-chip-cloud-renderer',
  'ytd-search-header-renderer',
].join(', ');
const YOUTUBE_GUIDE_ENTRY_SELECTOR = [
  'ytd-guide-entry-renderer',
  'ytd-mini-guide-entry-renderer',
  'ytd-guide-collapsible-entry-renderer',
].join(', ');
const YOUTUBE_GUIDE_ENTRY_ROOT_SELECTOR = [
  'ytd-guide-entry-renderer',
  'ytd-mini-guide-entry-renderer',
  'ytd-guide-collapsible-entry-renderer',
].join(', ');
const YOUTUBE_LABEL_DISCOVERY_SELECTOR = [
  `${YOUTUBE_CHANNEL_TAB_GROUP_SELECTOR} ${YOUTUBE_CHANNEL_TAB_SELECTOR}`,
  YOUTUBE_GUIDE_ENTRY_ROOT_SELECTOR,
  ...YOUTUBE_FILTER_CHIP_CONTEXT_SELECTOR.split(', ').map((selector) => `${selector} ${YOUTUBE_TAB_SELECTOR}`),
].join(', ');
const YOUTUBE_GUIDE_CONTEXT_SELECTOR = [
  'ytd-guide-renderer',
  'ytd-guide-section-renderer',
  'ytd-mini-guide-renderer',
  '#guide-content',
  '#guide-inner-content',
].join(', ');
const YOUTUBE_SHORTS_GUIDE_TITLE_SET = new Set(['shorts', '쇼츠']);
const YOUTUBE_CHANNEL_SHORTS_FEED_ITEM_SELECTOR = 'ytd-rich-item-renderer';
const YOUTUBE_MEDIA_FEED_ITEM_SELECTOR = [
  'ytd-rich-grid-media',
  'ytd-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-compact-video-renderer',
  'yt-lockup-view-model',
].join(', ');
const YOUTUBE_FEED_ITEM_SELECTOR = [
  YOUTUBE_CHANNEL_SHORTS_FEED_ITEM_SELECTOR,
  YOUTUBE_MEDIA_FEED_ITEM_SELECTOR,
].join(', ');
const YOUTUBE_SHORTS_LINK_SELECTOR = 'a[href*="/shorts/"], a[href^="/shorts"]';
const YOUTUBE_HIDDEN_TARGET_SELECTOR = '[data-friction-shortform-hidden="1"]';
const YOUTUBE_CARD_OWNER_SELECTOR = `${YOUTUBE_SHORTS_LOCKUP_SELECTOR}, ${YOUTUBE_FEED_ITEM_SELECTOR}`;
const YOUTUBE_CARD_DISCOVERY_SELECTOR = [
  YOUTUBE_SHORTS_LOCKUP_SELECTOR,
  YOUTUBE_SHORTS_LINK_SELECTOR,
  ...YOUTUBE_FEED_ITEM_SELECTOR.split(', ').map((selector) => `${selector}${YOUTUBE_HIDDEN_TARGET_SELECTOR}`),
].join(', ');
const YOUTUBE_STANDARD_LINK_SELECTOR = 'a[href*="/watch"], a[href*="/live/"], a[href*="/clip/"]';
const YOUTUBE_ACTIVE_SPINNER_SELECTOR = [
  'tp-yt-paper-spinner[active]',
  'tp-yt-paper-spinner-lite[active]',
  '#spinner[active]',
  '#spinner:not([hidden])',
].join(', ');
const SHORTFORM_EXCLUDED_CONTEXT_SELECTOR = [
  'ytd-comments',
  'ytd-comments-header-renderer',
  'ytd-comment-thread-renderer',
  'ytd-comment-view-model',
  'ytd-comment-renderer',
  'ytd-comment-replies-renderer',
  '#comments',
  '#comment-teaser',
  '#comment-input',
].join(', ');

function createPruneIntent(target, reason, pruneModeOverride = null) {
  return Object.freeze({
    type: 'prune',
    target,
    candidate: target,
    reason,
    pruneModeOverride,
  });
}

function createRestoreIntent(target, reason = 'youtube_feed_item_no_longer_shorts_only', expectedPruneReason = null) {
  return Object.freeze({
    type: 'restore',
    target,
    reason,
    ...(expectedPruneReason === null ? {} : { expectedPruneReason }),
  });
}

function parseUrl(rawUrl, baseUrl) {
  try {
    return new URL(rawUrl, baseUrl);
  } catch (_) {
    return null;
  }
}

function isYouTubeChannelShortsSurface(currentUrl) {
  const parsed = parseUrl(currentUrl, currentUrl);
  if (!parsed || resolveSiteId(parsed.hostname) !== 'youtube') return false;
  return /^\/(?:channel|c|user)\/[^/]+\/shorts(?:\/|$)/i.test(parsed.pathname)
    || /^\/@[^/]+\/shorts(?:\/|$)/i.test(parsed.pathname);
}

function isYouTubeShortsHref(rawHref, currentUrl) {
  const parsed = parseUrl(rawHref, currentUrl);
  if (!parsed || resolveSiteId(parsed.hostname) !== 'youtube') return false;
  return /(?:^|\/)shorts(?:\/|$)/i.test(String(parsed.pathname || '').toLowerCase());
}

function classifyMediaHref(rawHref, currentUrl) {
  const parsed = parseUrl(rawHref, currentUrl);
  if (!parsed || resolveSiteId(parsed.hostname) !== 'youtube') return null;
  if (/^\/shorts\/[^/]+(?:\/|$)/i.test(parsed.pathname)) return 'shorts';
  if (/^\/(?:watch|live|clip)(?:\/|$)/i.test(parsed.pathname)) return 'standard';
  return null;
}

function hasStandardMediaLink(element, dom, currentUrl) {
  const links = dom.queryAll(element, YOUTUBE_STANDARD_LINK_SELECTOR, {
    reason: 'youtube_shorts_feed_item',
  });
  if (dom.isFailure(links)) return links;
  return links.some((link) => classifyMediaHref(link.getAttribute('href'), currentUrl) === 'standard');
}

function nodeHasShortsHref(element, dom, currentUrl, { deep = true } = {}) {
  if (!dom.isElement(element)) return false;
  const hrefValue = String(element.getAttribute?.('href') || element.href || '');
  if (isYouTubeShortsHref(hrefValue, currentUrl)) return true;
  if (!deep) return false;
  const hrefNodes = dom.queryAll(element, '[href]', { reason: 'youtube_shorts_href' });
  if (dom.isFailure(hrefNodes)) return hrefNodes;
  return hrefNodes.some((node) => isYouTubeShortsHref(
    String(node.getAttribute?.('href') || node.href || ''),
    currentUrl,
  ));
}

function hasShortsLabel(...values) {
  return values.some((value) => YOUTUBE_SHORTS_GUIDE_TITLE_SET.has(
    String(value || '').replace(/\s+/gu, ' ').trim().toLowerCase(),
  ));
}

function classifyChannelTab(element, dom, currentUrl) {
  if (!dom.isElement(element)) return false;
  if (String(element.tagName || '').toUpperCase() !== 'YT-TAB-SHAPE') return false;
  const isTab = dom.matches(element, YOUTUBE_CHANNEL_TAB_SELECTOR, {
    reason: 'youtube_shorts_channel_tab',
  });
  if (dom.isFailure(isTab) || !isTab) return isTab;
  const indicator = dom.closest(element, '[data-friction-indicator="1"]', {
    reason: 'youtube_shorts_channel_tab',
  });
  if (dom.isFailure(indicator)) return indicator;
  if (indicator) return false;
  const excluded = dom.closest(element, SHORTFORM_EXCLUDED_CONTEXT_SELECTOR, {
    reason: 'youtube_shorts_channel_tab',
  });
  if (dom.isFailure(excluded)) return excluded;
  if (excluded) return false;
  const tabGroup = dom.closest(element, YOUTUBE_CHANNEL_TAB_GROUP_SELECTOR, {
    reason: 'youtube_shorts_channel_tab',
  });
  if (dom.isFailure(tabGroup)) return tabGroup;
  if (!tabGroup) return false;
  const shortsHref = nodeHasShortsHref(element, dom, currentUrl, { deep: false });
  if (dom.isFailure(shortsHref)) return shortsHref;
  if (shortsHref) return true;
  const tabTitleNode = dom.queryOne(element, '.yt-tab-shape__tab', {
    reason: 'youtube_shorts_channel_tab',
  });
  if (dom.isFailure(tabTitleNode)) return tabTitleNode;
  return [
    element.getAttribute?.('tab-title'),
    element.getAttribute?.('title'),
    element.getAttribute?.('aria-label'),
    tabTitleNode?.textContent,
    element.textContent,
  ].some((value) => YOUTUBE_SHORTS_GUIDE_TITLE_SET.has(
    String(value || '').trim().toLowerCase(),
  ));
}

function resolveChannelTabIntents({ root, dom, currentUrl }) {
  if (!dom.isElement(root)) return [];
  const candidates = new Set([root]);
  const descendants = dom.queryAll(
    root,
    `${YOUTUBE_CHANNEL_TAB_GROUP_SELECTOR} ${YOUTUBE_CHANNEL_TAB_SELECTOR}, yt-tab-shape${YOUTUBE_HIDDEN_TARGET_SELECTOR}`,
    { reason: 'youtube_shorts_channel_tab' },
  );
  if (dom.isFailure(descendants)) return [];
  descendants.forEach((candidate) => candidates.add(candidate));
  const classified = [];
  for (const candidate of candidates) {
    const isShortsTab = classifyChannelTab(candidate, dom, currentUrl);
    if (dom.isFailure(isShortsTab)) return [];
    if (isShortsTab) classified.push(createPruneIntent(
      candidate,
      'youtube_shorts_channel_tab',
      'hide',
    ));
    else if (candidate.tagName === 'YT-TAB-SHAPE' && candidate.getAttribute('data-friction-shortform-hidden') === '1') {
      classified.push(createRestoreIntent(
        candidate,
        'youtube_channel_tab_no_longer_shorts',
        'youtube_shorts_channel_tab',
      ));
    }
  }
  return classified;
}

function resolveGuideEntryRoot(element, dom) {
  if (!dom.isElement(element)) return null;
  const owner = dom.closest(element, YOUTUBE_GUIDE_ENTRY_ROOT_SELECTOR, {
    reason: 'youtube_shorts_guide_entry',
  });
  if (dom.isFailure(owner)) return owner;
  return owner || element;
}

function classifyGuideEntry(element, dom, currentUrl) {
  if (!dom.isElement(element)) return false;
  const indicator = dom.closest(element, '[data-friction-indicator="1"]', {
    reason: 'youtube_shorts_guide_entry',
  });
  if (dom.isFailure(indicator)) return indicator;
  if (indicator) return false;
  const excluded = dom.closest(element, SHORTFORM_EXCLUDED_CONTEXT_SELECTOR, {
    reason: 'youtube_shorts_guide_entry',
  });
  if (dom.isFailure(excluded)) return excluded;
  if (excluded) return false;
  const guideContext = dom.closest(element, YOUTUBE_GUIDE_CONTEXT_SELECTOR, {
    reason: 'youtube_shorts_guide_entry',
  });
  if (dom.isFailure(guideContext)) return guideContext;
  if (!guideContext) return false;
  const shortsHref = nodeHasShortsHref(element, dom, currentUrl);
  if (dom.isFailure(shortsHref)) return shortsHref;
  if (shortsHref) return true;
  const guideRoot = resolveGuideEntryRoot(element, dom);
  if (dom.isFailure(guideRoot) || !guideRoot) return guideRoot;
  const titleNode = dom.queryOne(guideRoot, 'yt-formatted-string.title', {
    reason: 'youtube_shorts_guide_entry',
  });
  if (dom.isFailure(titleNode)) return titleNode;
  const endpoint = dom.queryOne(guideRoot, '#endpoint[title]', {
    reason: 'youtube_shorts_guide_entry',
  });
  if (dom.isFailure(endpoint)) return endpoint;
  const fallbackTitleNode = dom.queryOne(guideRoot, '.title', {
    reason: 'youtube_shorts_guide_entry',
  });
  if (dom.isFailure(fallbackTitleNode)) return fallbackTitleNode;
  return [
    titleNode?.textContent,
    endpoint?.getAttribute?.('title'),
    fallbackTitleNode?.textContent,
    guideRoot.getAttribute?.('title'),
  ].some((value) => YOUTUBE_SHORTS_GUIDE_TITLE_SET.has(
    String(value || '').trim().toLowerCase(),
  ));
}

function resolveGuideEntryIntents({ root, dom, currentUrl }) {
  if (!dom.isElement(root)) return [];
  const entries = dom.queryAll(root, YOUTUBE_GUIDE_ENTRY_SELECTOR, {
    reason: 'youtube_shorts_guide_entry',
  });
  if (dom.isFailure(entries)) return [];
  const candidates = new Set([root, ...entries]);
  const targets = new Set();
  for (const candidate of candidates) {
    const isShortsEntry = classifyGuideEntry(candidate, dom, currentUrl);
    if (dom.isFailure(isShortsEntry)) return [];
    if (!isShortsEntry) continue;
    const owner = resolveGuideEntryRoot(candidate, dom);
    if (dom.isFailure(owner)) return [];
    if (owner) targets.add(owner);
  }
  return Array.from(targets, (target) => createPruneIntent(
    target,
    'youtube_shorts_guide_entry',
  ));
}

function resolveFilterChipOwner(tab, tabList, dom) {
  const declaredOwner = dom.closest(tab, YOUTUBE_FILTER_CHIP_OWNER_SELECTOR, {
    reason: 'youtube_shorts_filter_chip',
  });
  if (dom.isFailure(declaredOwner)) return declaredOwner;
  if (declaredOwner && tabList.contains(declaredOwner)) return declaredOwner;

  let structuralOwner = tab;
  while (structuralOwner?.parentElement && structuralOwner.parentElement !== tabList) {
    structuralOwner = structuralOwner.parentElement;
  }
  return structuralOwner?.parentElement === tabList ? structuralOwner : null;
}

function resolveOwnedFilterChipAncestor(element, dom, readOwnedHideReason) {
  if (typeof readOwnedHideReason !== 'function') return null;
  let current = element;
  while (dom.isElement(current)) {
    const hiddenOwner = dom.closest(current, YOUTUBE_HIDDEN_TARGET_SELECTOR, {
      reason: 'youtube_hidden_mutation_owner',
    });
    if (dom.isFailure(hiddenOwner) || !hiddenOwner) return hiddenOwner;
    if (readOwnedHideReason(hiddenOwner) === 'youtube_shorts_filter_chip') return hiddenOwner;
    current = hiddenOwner.parentElement;
  }
  return null;
}

function classifyFilterChip(tab, dom) {
  if (!dom.isElement(tab)) return false;
  const isTab = dom.matches(tab, YOUTUBE_TAB_SELECTOR, {
    reason: 'youtube_shorts_filter_chip',
  });
  if (dom.isFailure(isTab) || !isTab) return isTab;
  const excluded = dom.closest(tab, SHORTFORM_EXCLUDED_CONTEXT_SELECTOR, {
    reason: 'youtube_shorts_filter_chip',
  });
  if (dom.isFailure(excluded)) return excluded;
  if (excluded) return false;
  const tabList = dom.closest(tab, YOUTUBE_TABLIST_SELECTOR, {
    reason: 'youtube_shorts_filter_chip',
  });
  if (dom.isFailure(tabList) || !tabList) return tabList;
  const filterContext = dom.closest(tabList, YOUTUBE_FILTER_CHIP_CONTEXT_SELECTOR, {
    reason: 'youtube_shorts_filter_chip',
  });
  if (dom.isFailure(filterContext) || !filterContext) return filterContext;
  const owner = resolveFilterChipOwner(tab, tabList, dom);
  if (dom.isFailure(owner) || !owner) return owner;
  return Object.freeze({
    owner,
    isShorts: hasShortsLabel(
      tab.getAttribute?.('aria-label'),
      tab.getAttribute?.('title'),
      owner.getAttribute?.('aria-label'),
      owner.getAttribute?.('title'),
      tab.textContent,
    ),
  });
}

function resolveFilterChipIntents({ root, dom, readOwnedHideReason }) {
  if (!dom.isElement(root)) return [];
  const closestTab = dom.closest(root, YOUTUBE_TAB_SELECTOR, {
    reason: 'youtube_shorts_filter_chip',
  });
  if (dom.isFailure(closestTab)) return [];
  const descendants = dom.queryAll(root, YOUTUBE_TAB_SELECTOR, {
    reason: 'youtube_shorts_filter_chip',
  });
  if (dom.isFailure(descendants)) return [];
  const candidates = new Set([closestTab, ...descendants].filter(Boolean));
  // Public hides are discovery only. Negative intents require the manager's
  // exact instance-owned chip reason before they may release any effect.
  const hiddenOwners = dom.queryAll(root, YOUTUBE_HIDDEN_TARGET_SELECTOR, {
    reason: 'youtube_shorts_filter_chip',
  });
  if (dom.isFailure(hiddenOwners)) return [];
  const closestHiddenOwner = resolveOwnedFilterChipAncestor(root, dom, readOwnedHideReason);
  if (dom.isFailure(closestHiddenOwner)) return [];
  if (closestHiddenOwner) hiddenOwners.push(closestHiddenOwner);
  const classifications = new Map();
  for (const candidate of candidates) {
    const classification = classifyFilterChip(candidate, dom);
    if (dom.isFailure(classification)) return [];
    if (classification) classifications.set(
      classification.owner,
      classifications.get(classification.owner) === true || classification.isShorts,
    );
  }
  for (const owner of hiddenOwners) {
    if (readOwnedHideReason?.(owner) === 'youtube_shorts_filter_chip' && !classifications.has(owner)) {
      classifications.set(owner, false);
    }
  }
  return Array.from(classifications, ([target, isShorts]) => (
    isShorts
      ? createPruneIntent(target, 'youtube_shorts_filter_chip', 'hide')
      : createRestoreIntent(target, 'youtube_filter_chip_no_longer_shorts', 'youtube_shorts_filter_chip')
  ));
}

function classifyGridShelf(element, dom) {
  if (!dom.isElement(element)) return false;
  if (String(element.tagName || '').toUpperCase() !== 'GRID-SHELF-VIEW-MODEL') return false;
  const indicator = dom.closest(element, '[data-friction-indicator="1"]', {
    reason: 'youtube_shorts_grid_shelf',
  });
  if (dom.isFailure(indicator)) return indicator;
  if (indicator) return false;
  const excluded = dom.closest(element, SHORTFORM_EXCLUDED_CONTEXT_SELECTOR, {
    reason: 'youtube_shorts_grid_shelf',
  });
  if (dom.isFailure(excluded)) return excluded;
  if (excluded) return false;
  const lockup = dom.queryOne(element, YOUTUBE_SHORTS_LOCKUP_SELECTOR, {
    reason: 'youtube_shorts_grid_shelf',
  });
  if (dom.isFailure(lockup)) return lockup;
  return !!lockup;
}

function resolveGridShelfIntents({ root, dom }) {
  if (!dom.isElement(root)) return [];
  const shelves = dom.queryAll(root, YOUTUBE_SHORTS_GRID_SHELF_SELECTOR, {
    reason: 'youtube_shorts_grid_shelf',
  });
  if (dom.isFailure(shelves)) return [];
  const candidates = new Set([root, ...shelves]);
  const intents = [];
  for (const candidate of candidates) {
    const isShortsShelf = classifyGridShelf(candidate, dom);
    if (dom.isFailure(isShortsShelf)) return [];
    if (isShortsShelf) intents.push(createPruneIntent(
      candidate,
      'youtube_shorts_grid_shelf',
    ));
  }
  return intents;
}

function classifyHorizontalShelf(element, dom, currentUrl) {
  if (!dom.isElement(element)) return false;
  if (String(element.tagName || '').toUpperCase() !== 'YTD-SHELF-RENDERER') return false;
  const indicator = dom.closest(element, '[data-friction-indicator="1"]', {
    reason: 'youtube_shorts_horizontal_shelf',
  });
  if (dom.isFailure(indicator)) return indicator;
  if (indicator) return false;
  const excluded = dom.closest(element, SHORTFORM_EXCLUDED_CONTEXT_SELECTOR, {
    reason: 'youtube_shorts_horizontal_shelf',
  });
  if (dom.isFailure(excluded)) return excluded;
  if (excluded) return false;
  const horizontalList = dom.queryOne(element, YOUTUBE_HORIZONTAL_LIST_SELECTOR, {
    reason: 'youtube_shorts_horizontal_shelf',
  });
  if (dom.isFailure(horizontalList)) return horizontalList;
  if (!horizontalList) return false;
  const lockup = dom.queryOne(horizontalList, YOUTUBE_SHORTS_LOCKUP_SELECTOR, {
    reason: 'youtube_shorts_horizontal_shelf',
  });
  if (dom.isFailure(lockup)) return lockup;
  if (!lockup) return false;
  const items = dom.queryOne(horizontalList, '#items', {
    reason: 'youtube_shorts_horizontal_shelf',
  });
  if (dom.isFailure(items)) return items;
  if (!items || items.children.length === 0) return false;
  // The horizontal shelf is shared with ordinary video cards. Only an entirely
  // declared Shorts slot list can own a whole-shelf hide; unknown slots stay local.
  for (const item of items.children) {
    const isLockup = dom.matches(item, YOUTUBE_SHORTS_LOCKUP_SELECTOR, {
      reason: 'youtube_shorts_horizontal_shelf',
    });
    if (dom.isFailure(isLockup)) return isLockup;
    if (!isLockup) return false;
  }
  const hasStandard = hasStandardMediaLink(items, dom, currentUrl);
  if (dom.isFailure(hasStandard)) return hasStandard;
  return !hasStandard;
}

function resolveHorizontalShelfIntents({ root, dom, currentUrl }) {
  if (!dom.isElement(root)) return [];
  const shelves = dom.queryAll(root, YOUTUBE_HORIZONTAL_SHELF_SELECTOR, {
    reason: 'youtube_shorts_horizontal_shelf',
  });
  if (dom.isFailure(shelves)) return [];
  const candidates = new Set([root, ...shelves]);
  const intents = [];
  for (const candidate of candidates) {
    const isShortsShelf = classifyHorizontalShelf(candidate, dom, currentUrl);
    if (dom.isFailure(isShortsShelf)) return [];
    if (isShortsShelf) {
      intents.push(createPruneIntent(
        candidate,
        'youtube_shorts_horizontal_shelf',
        'hide',
      ));
      continue;
    }
    if (String(candidate.tagName || '').toUpperCase() === 'YTD-SHELF-RENDERER'
      && candidate.hasAttribute('data-friction-shortform-hidden')) {
      intents.push(createRestoreIntent(
        candidate,
        'youtube_horizontal_shelf_no_longer_shorts_only',
      ));
    }
  }
  return intents;
}

function classifyFeedItem(element, dom, currentUrl, channelShortsSurface) {
  if (!dom.isElement(element)) return false;
  const feedItemMatch = dom.matches(element, YOUTUBE_CARD_OWNER_SELECTOR, {
    reason: 'youtube_shorts_feed_item',
  });
  if (dom.isFailure(feedItemMatch)) return feedItemMatch;
  if (!feedItemMatch) return false;
  if (
    String(element.tagName || '').toUpperCase() === 'YTD-RICH-ITEM-RENDERER'
    && !channelShortsSurface
  ) return false;
  const indicator = dom.closest(element, '[data-friction-indicator="1"]', {
    reason: 'youtube_shorts_feed_item',
  });
  if (dom.isFailure(indicator)) return indicator;
  if (indicator) return false;
  const excluded = dom.closest(element, SHORTFORM_EXCLUDED_CONTEXT_SELECTOR, {
    reason: 'youtube_shorts_feed_item',
  });
  if (dom.isFailure(excluded)) return excluded;
  if (excluded) return false;
  const isLockup = dom.matches(element, YOUTUBE_SHORTS_LOCKUP_SELECTOR, {
    reason: 'youtube_shorts_feed_item',
  });
  if (dom.isFailure(isLockup)) return isLockup;
  if (isLockup) {
    const hasStandard = hasStandardMediaLink(element, dom, currentUrl);
    if (dom.isFailure(hasStandard)) return hasStandard;
    return !hasStandard;
  }
  const links = dom.queryAll(element, 'a[href]', { reason: 'youtube_shorts_feed_item' });
  if (dom.isFailure(links)) return links;
  let shortsMediaLinkCount = 0;
  for (const link of links) {
    const href = String(link.getAttribute?.('href') || link.href || '');
    const kind = classifyMediaHref(href, currentUrl);
    if (kind === 'standard') return false;
    if (kind === 'shorts') shortsMediaLinkCount += 1;
  }
  return shortsMediaLinkCount > 0;
}

// Batch-local positive ownership only. parentElement stops at a shadow root,
// matching the light-DOM containment used by the previous pairwise checks.
function isWithinTargets(node, targets) {
  if (targets.size === 0) return false;
  for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) {
    if (targets.has(ancestor)) return true;
  }
  return false;
}

function resolveFeedItemIntents({ root, dom, currentUrl, prunedShelves = [] }) {
  if (!dom.isElement(root)) return [];
  const prunedShelfSet = new Set(prunedShelves);
  if (prunedShelfSet.has(root)) return [];
  const channelShortsSurface = isYouTubeChannelShortsSurface(currentUrl);
  const candidates = new Set();
  const descendants = dom.queryAll(root, YOUTUBE_CARD_DISCOVERY_SELECTOR, {
    reason: 'youtube_shorts_feed_item',
  });
  if (dom.isFailure(descendants)) return [];
  const rootMatches = dom.matches(root, YOUTUBE_CARD_DISCOVERY_SELECTOR, {
    reason: 'youtube_shorts_feed_item',
  });
  if (dom.isFailure(rootMatches)) return [];
  if (rootMatches) descendants.unshift(root);
  // A changed ordinary href still needs to restore an owner hidden previously.
  const previousOwner = dom.closest(root, YOUTUBE_HIDDEN_TARGET_SELECTOR, {
    reason: 'youtube_shorts_feed_item',
  });
  if (dom.isFailure(previousOwner)) return [];
  if (previousOwner) descendants.push(previousOwner);
  for (const candidate of descendants) {
    if (isWithinTargets(candidate, prunedShelfSet)) continue;
    let owner = dom.closest(candidate, YOUTUBE_CARD_OWNER_SELECTOR, {
      reason: 'youtube_shorts_feed_item',
    });
    if (dom.isFailure(owner)) return [];
    if (!owner) continue;
    // Nested v2/legacy lockups are one card. Channel Shorts grids likewise own
    // their rich-item wrapper, not a second nested media target.
    while (owner.parentElement) {
      const parentIsLockup = dom.matches(owner.parentElement, YOUTUBE_SHORTS_LOCKUP_SELECTOR, {
        reason: 'youtube_shorts_feed_item',
      });
      if (dom.isFailure(parentIsLockup)) return [];
      if (!parentIsLockup && !(channelShortsSurface
        && owner.parentElement.tagName === 'YTD-RICH-ITEM-RENDERER')) break;
      owner = owner.parentElement;
    }
    if (channelShortsSurface) {
      const channelOwner = dom.closest(owner, YOUTUBE_CHANNEL_SHORTS_FEED_ITEM_SELECTOR, {
        reason: 'youtube_shorts_feed_item',
      });
      if (dom.isFailure(channelOwner)) return [];
      if (channelOwner) owner = channelOwner;
    }
    if (!isWithinTargets(owner, prunedShelfSet)) candidates.add(owner);
  }

  const classifications = new Map();
  const positiveTargets = new Set();
  for (const candidate of candidates) {
    const classification = classifyFeedItem(candidate, dom, currentUrl, channelShortsSurface);
    if (dom.isFailure(classification)) return [];
    classifications.set(candidate, classification);
    if (classification === true) positiveTargets.add(candidate);
  }
  const intents = [];
  classifications.forEach((classification, target) => {
    if (classification) {
      const classifiedAncestor = isWithinTargets(target.parentElement, positiveTargets);
      if (!classifiedAncestor) intents.push(createPruneIntent(
        target,
        'youtube_shorts_feed_item',
        'hide',
      ));
      return;
    }
    if (target.hasAttribute('data-friction-shortform-hidden')) intents.push(createRestoreIntent(target));
  });
  return intents;
}

function classifyContinuation(element, dom) {
  if (!dom.isElement(element)) return false;
  if (String(element.tagName || '').toUpperCase() !== 'YTD-CONTINUATION-ITEM-RENDERER') {
    return false;
  }
  const indicator = dom.closest(element, '[data-friction-indicator="1"]', {
    reason: 'youtube_continuation_artifact',
  });
  if (dom.isFailure(indicator)) return indicator;
  if (indicator) return false;
  const excluded = dom.closest(element, SHORTFORM_EXCLUDED_CONTEXT_SELECTOR, {
    reason: 'youtube_continuation_artifact',
  });
  if (dom.isFailure(excluded)) return excluded;
  if (excluded) return false;
  const activeSpinner = dom.queryOne(element, YOUTUBE_ACTIVE_SPINNER_SELECTOR, {
    reason: 'youtube_continuation_artifact',
  });
  if (dom.isFailure(activeSpinner)) return activeSpinner;
  if (!activeSpinner) return false;
  const feedItem = dom.queryOne(element, YOUTUBE_FEED_ITEM_SELECTOR, {
    reason: 'youtube_continuation_artifact',
  });
  if (dom.isFailure(feedItem)) return feedItem;
  if (feedItem) return false;
  const shortMarker = dom.queryOne(element, YOUTUBE_SHORT_MARKER_SELECTOR, {
    reason: 'youtube_continuation_artifact',
  });
  if (dom.isFailure(shortMarker)) return shortMarker;
  if (shortMarker) return true;
  const ghostCard = dom.queryOne(element, '#ghost-cards, [id*="ghost-card"], [id^="ghost-"]', {
    reason: 'youtube_continuation_artifact',
  });
  if (dom.isFailure(ghostCard)) return ghostCard;
  if (!ghostCard) return false;
  const watchPageHint = dom.closest(element, '[is-watch-page]', {
    reason: 'youtube_continuation_artifact',
  });
  if (dom.isFailure(watchPageHint)) return watchPageHint;
  const loadMoreButton = dom.queryOne(element, '#button:not([hidden]), yt-button-renderer', {
    reason: 'youtube_continuation_artifact',
  });
  if (dom.isFailure(loadMoreButton)) return loadMoreButton;
  return element.hasAttribute('is-watch-page') || !!watchPageHint || !!loadMoreButton;
}

function resolveContinuationIntents({ root, dom }) {
  if (!dom.isElement(root)) return [];
  const descendants = dom.queryAll(root, YOUTUBE_CONTINUATION_SELECTOR, {
    reason: 'youtube_continuation_artifact',
  });
  if (dom.isFailure(descendants)) return [];
  const candidates = new Set([root, ...descendants]);
  const intents = [];
  for (const candidate of candidates) {
    const isShortsContinuation = classifyContinuation(candidate, dom);
    if (dom.isFailure(isShortsContinuation)) return [];
    if (isShortsContinuation) intents.push(createPruneIntent(
      candidate,
      'youtube_continuation_artifact',
    ));
  }
  return intents;
}

// Text changes can invalidate labels, but must not promote card metadata into shelf scans.
export function collectYouTubeShortFormLabelMutationRoots({ nodes = [], mutationPayload, dom } = {}) {
  const sources = new Set();
  for (const node of nodes) {
    if (node?.nodeType === 3 && node.parentElement) sources.add(node.parentElement);
  }
  for (const mutation of mutationPayload?.mutations || []) {
    if (mutation.type === 'childList' && mutation.removedNodes?.length > 0) sources.add(mutation.target);
  }
  const owners = new Set();
  for (const source of sources) {
    if (!dom.isElement(source) || !source.isConnected) continue;
    const owner = dom.closest(source, `${YOUTUBE_TAB_SELECTOR}, ${YOUTUBE_GUIDE_ENTRY_ROOT_SELECTOR}`, {
      reason: 'youtube_label_mutation_owner',
    });
    if (dom.isFailure(owner)) return Object.freeze([]);
    if (!owner || owners.has(owner)) continue;
    // Channel tabs and guide entries are structural owners. Generic tabs are labels only in chip contexts.
    if (owner.tagName !== 'YT-TAB-SHAPE' && !YOUTUBE_GUIDE_ENTRY_ROOT_SELECTOR.split(', ').includes(owner.localName)) {
      const tablist = dom.closest(owner, YOUTUBE_TABLIST_SELECTOR, { reason: 'youtube_label_mutation_owner' });
      const context = dom.closest(owner, YOUTUBE_FILTER_CHIP_CONTEXT_SELECTOR, { reason: 'youtube_label_mutation_owner' });
      if (dom.isFailure(tablist) || dom.isFailure(context)) return Object.freeze([]);
      if (!tablist || !context) continue;
    }
    owners.add(owner);
  }
  return Object.freeze([...owners]);
}

// Whole-shelf eligibility depends on direct Element slots, including unknown
// slots with no positive selector evidence. Keep their childList target.
export function collectYouTubeShortFormShelfMutationRoots({ mutationPayload, dom } = {}) {
  const itemLists = new Set();
  for (const mutation of mutationPayload?.mutations || []) {
    const target = mutation.target;
    if (mutation.type !== 'childList' || !dom.isElement(target)
      || !target.isConnected || target.id !== 'items' || itemLists.has(target)) continue;
    const changedSlot = [mutation.addedNodes, mutation.removedNodes].some((nodes) => {
      for (const node of nodes || []) {
        if (dom.isElement(node)) return true;
      }
      return false;
    });
    if (changedSlot) itemLists.add(target);
  }
  const owners = new Set();
  for (const items of itemLists) {
    const details = { reason: 'youtube_horizontal_shelf_slot_mutation' };
    let shelf = dom.closest(items, YOUTUBE_HORIZONTAL_SHELF_SELECTOR, details);
    if (dom.isFailure(shelf)) return shelf;
    // Match the exact list/items selected by classifyHorizontalShelf. A nested
    // metadata node with the same id is not this shelf's structural boundary.
    // Nested shelves can share that list; reconcile every dependent owner.
    while (shelf) {
      const horizontalList = dom.queryOne(shelf, YOUTUBE_HORIZONTAL_LIST_SELECTOR, details);
      if (dom.isFailure(horizontalList)) return horizontalList;
      if (horizontalList) {
        const selectedItems = dom.queryOne(horizontalList, '#items', details);
        if (dom.isFailure(selectedItems)) return selectedItems;
        if (selectedItems === items) owners.add(shelf);
      }
      shelf = shelf.parentElement
        ? dom.closest(shelf.parentElement, YOUTUBE_HORIZONTAL_SHELF_SELECTOR, details) : null;
      if (dom.isFailure(shelf)) return shelf;
    }
  }
  return Object.freeze([...owners]);
}

export function normalizeYouTubeShortFormMutationRoots({
  roots,
  dom,
  currentUrl,
  normalizeRoots,
  mutationPayload = null,
  readOwnedHideReason = null,
} = {}) {
  const idTargets = new Set((mutationPayload?.mutations || [])
    .filter(mutation => mutation.type === 'attributes' && mutation.attributeName === 'id')
    .map(mutation => mutation.target));
  const promoted = [];
  const continuationStateAttributes = new Set(['active', 'hidden', 'is-watch-page']);
  const continuationDependencyAttributes = new Set([
    ...continuationStateAttributes, 'id', 'href', 'is-shorts',
  ]);
  const stateTargets = new Set();
  const watchPageTargets = new Set();
  const dependencyTargets = new Set();
  const otherMutationAncestors = new Set();
  const addOtherMutationAncestors = (node) => {
    let current = node?.nodeType === 3 ? node.parentElement : node;
    while (dom.isElement(current) && !otherMutationAncestors.has(current)) {
      otherMutationAncestors.add(current);
      current = current.parentElement;
    }
  };
  for (const mutation of mutationPayload?.mutations || []) {
    if (mutation.type === 'attributes') {
      if (continuationDependencyAttributes.has(mutation.attributeName)) dependencyTargets.add(mutation.target);
      if (continuationStateAttributes.has(mutation.attributeName)) stateTargets.add(mutation.target);
      else addOtherMutationAncestors(mutation.target);
      if (mutation.attributeName === 'is-watch-page') watchPageTargets.add(mutation.target);
    } else {
      addOtherMutationAncestors(mutation.target);
      for (const node of mutation.addedNodes || []) addOtherMutationAncestors(node);
    }
  }
  for (const target of dependencyTargets) {
    if (!dom.isElement(target) || !target.isConnected) continue;
    const continuation = dom.closest(target, YOUTUBE_CONTINUATION_SELECTOR, {
      reason: 'youtube_continuation_mutation_owner',
    });
    if (dom.isFailure(continuation)) return Object.freeze([]);
    if (continuation) promoted.push(continuation);
    if (watchPageTargets.has(target)) {
      const continuations = dom.queryAll(target, YOUTUBE_CONTINUATION_SELECTOR, {
        reason: 'youtube_continuation_mutation_owner',
      });
      if (dom.isFailure(continuations)) return Object.freeze([]);
      promoted.push(...continuations);
    }
  }
  for (const root of roots || []) {
    if (!dom.isElement(root)) continue;
    // New state interests are continuation-local. Preserve independent inputs
    // collapsed into the same root without turning unrelated state churn into
    // card/shelf scans.
    if (stateTargets.has(root) && !otherMutationAncestors.has(root)) continue;
    const hiddenOwner = resolveOwnedFilterChipAncestor(root, dom, readOwnedHideReason);
    if (dom.isFailure(hiddenOwner)) return Object.freeze([]);
    if (hiddenOwner) {
      promoted.push(hiddenOwner);
      continue;
    }
    const tabOwner = dom.closest(root, YOUTUBE_TAB_SELECTOR, {
      reason: 'youtube_tab_mutation_owner',
    });
    if (dom.isFailure(tabOwner)) return Object.freeze([]);
    if (tabOwner) {
      promoted.push(tabOwner);
      continue;
    }
    const guideOwner = dom.closest(root, YOUTUBE_GUIDE_ENTRY_ROOT_SELECTOR, {
      reason: 'youtube_shorts_mutation_owner',
    });
    if (dom.isFailure(guideOwner)) return Object.freeze([]);
    if (guideOwner) {
      promoted.push(guideOwner);
      continue;
    }
    const relevantSelector = `${YOUTUBE_CARD_OWNER_SELECTOR}, a, ${YOUTUBE_HORIZONTAL_SHELF_SELECTOR}, ${YOUTUBE_SHORTS_GRID_SHELF_SELECTOR}, ${YOUTUBE_CONTINUATION_SELECTOR}, [is-shorts], ${YOUTUBE_LABEL_DISCOVERY_SELECTOR}, yt-tab-shape${YOUTUBE_HIDDEN_TARGET_SELECTOR}`;
    const selfRelevant = dom.matches(root, relevantSelector, { reason: 'youtube_shorts_mutation_owner' });
    if (dom.isFailure(selfRelevant)) return Object.freeze([]);
    if (!selfRelevant) {
      const relevantChild = dom.queryOne(root, relevantSelector, { reason: 'youtube_shorts_mutation_owner' });
      if (dom.isFailure(relevantChild)) return Object.freeze([]);
      if (!relevantChild) {
        const hiddenChildren = dom.queryAll(root, YOUTUBE_HIDDEN_TARGET_SELECTOR, {
          reason: 'youtube_hidden_mutation_owner',
        });
        if (dom.isFailure(hiddenChildren)) return Object.freeze([]);
        const ownedChips = hiddenChildren.filter(target => readOwnedHideReason?.(target) === 'youtube_shorts_filter_chip');
        promoted.push(...ownedChips);
        continue;
      }
    }
    const shelfOwner = dom.closest(root, YOUTUBE_HORIZONTAL_SHELF_SELECTOR, {
      reason: 'youtube_shorts_mutation_owner',
    });
    if (dom.isFailure(shelfOwner)) return Object.freeze([]);
    if (shelfOwner) {
      promoted.push(shelfOwner);
      // An ID change can revoke the first #items identity used by more than
      // one enclosing shelf. Reconcile only owners selecting this same list.
      if (idTargets.has(root)) {
        const list = dom.closest(root, YOUTUBE_HORIZONTAL_LIST_SELECTOR, {
          reason: 'youtube_horizontal_shelf_id_mutation',
        });
        if (dom.isFailure(list)) return Object.freeze([]);
        let ancestor = shelfOwner.parentElement;
        while (list && ancestor) {
          const owner = dom.closest(ancestor, YOUTUBE_HORIZONTAL_SHELF_SELECTOR, {
            reason: 'youtube_horizontal_shelf_id_mutation',
          });
          if (dom.isFailure(owner)) return Object.freeze([]);
          if (!owner) break;
          const selectedList = dom.queryOne(owner, YOUTUBE_HORIZONTAL_LIST_SELECTOR, {
            reason: 'youtube_horizontal_shelf_id_mutation',
          });
          if (dom.isFailure(selectedList)) return Object.freeze([]);
          if (selectedList === list) promoted.push(owner);
          ancestor = owner.parentElement;
        }
      }
      continue;
    }
    if (isYouTubeChannelShortsSurface(currentUrl)) {
      const channelOwner = dom.closest(root, YOUTUBE_CHANNEL_SHORTS_FEED_ITEM_SELECTOR, {
        reason: 'youtube_shorts_mutation_owner',
      });
      if (dom.isFailure(channelOwner)) return Object.freeze([]);
      if (channelOwner) {
        promoted.push(channelOwner);
        continue;
      }
    }
    const mediaOwner = dom.closest(root, YOUTUBE_CARD_OWNER_SELECTOR, {
      reason: 'youtube_shorts_mutation_owner',
    });
    if (dom.isFailure(mediaOwner)) return Object.freeze([]);
    promoted.push(mediaOwner || root);
  }
  return Object.freeze(normalizeRoots(promoted));
}

export function resolveYouTubeShortFormActionIntents({
  root,
  dom,
  currentUrl,
  readOwnedHideReason = null,
} = {}) {
  const isCardRoot = dom.matches(root, YOUTUBE_CARD_OWNER_SELECTOR, {
    reason: 'youtube_shorts_feed_item',
  });
  if (dom.isFailure(isCardRoot)) return Object.freeze([]);
  if (isCardRoot) return Object.freeze(resolveFeedItemIntents({ root, dom, currentUrl }));
  const gridIntents = resolveGridShelfIntents({ root, dom });
  const horizontalIntents = resolveHorizontalShelfIntents({ root, dom, currentUrl });
  const prunedShelves = [...gridIntents, ...horizontalIntents]
    .filter((intent) => intent.type === 'prune').map((intent) => intent.target);
  return Object.freeze([
    ...resolveChannelTabIntents({ root, dom, currentUrl }),
    ...resolveGuideEntryIntents({ root, dom, currentUrl }),
    ...resolveFilterChipIntents({ root, dom, readOwnedHideReason }),
    ...gridIntents,
    ...horizontalIntents,
    ...resolveFeedItemIntents({ root, dom, currentUrl, prunedShelves }),
    ...resolveContinuationIntents({ root, dom }),
  ]);
}
