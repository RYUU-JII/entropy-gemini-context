import {
  collapseMutationSourceNodes,
  collectUniqueMutationSourceNodes,
  collectRemovalMutationTargets,
} from './dirtyRootReducer.js';

const DEFAULT_GRAPHIC_SELECTOR = 'svg, img, canvas, video, [role="img"]';
const DEFAULT_ACTION_BUTTON_SELECTOR =
  ':is(button[aria-label], button[title], [role="button"][aria-label], [role="button"][title])';
const DEFAULT_ACTION_CONTAINER_SELECTOR = 'label';
const DEFAULT_CANDIDATE_SELECTOR = ':is(span, div, strong, [role="text"])';

const DEFAULT_LIMITS = Object.freeze({
  maxRoots: 24,
  maxButtons: 32,
  maxCandidateTextLength: 96,
  maxCandidatesPerButton: 48,
  maxAncestorDepth: 5,
  threshold: 110,
  minScoreMargin: 0,
});

const DEFAULT_SCORES = Object.freeze({
  actionType: 70,
  candidateText: 35,
  insideButton: 28,
  outsideButton: 18,
  sameLabel: 42,
  buttonParentContains: 18,
  siblingUnderButtonParent: 14,
  roleText: 12,
  leaf: 18,
  nonLeaf: -12,
  labelEcho: 30,
  orderExact: 20,
  orderNear: 8,
  orderMissPenalty: -4,
  maxOrderPenalty: -16,
  depthPenalty: -4,
  maxDepthPenaltyUnits: 8,
});

function getLimit(profile, key) {
  return Number.isFinite(profile?.limits?.[key])
    ? profile.limits[key]
    : DEFAULT_LIMITS[key];
}

function getScore(profile, key) {
  return Number.isFinite(profile?.scores?.[key])
    ? profile.scores[key]
    : DEFAULT_SCORES[key];
}

export function toSemanticElement(node) {
  if (node instanceof Element) return node;
  if (node?.nodeType === 3) return node.parentElement;
  return null;
}

export function resolveClosestElementCached(element, selector, cache) {
  if (!(element instanceof Element)) return null;
  if (typeof selector !== 'string' || selector.length === 0) {
    throw new Error('SOCIAL_METRIC_CLOSEST_SELECTOR_REQUIRED');
  }
  if (!(cache instanceof WeakMap)) {
    throw new Error('SOCIAL_METRIC_CLOSEST_CACHE_REQUIRED');
  }
  const visited = [];
  let current = element;
  let match = null;
  while (current instanceof Element) {
    if (cache.has(current)) {
      match = cache.get(current);
      break;
    }
    visited.push(current);
    if (current.matches?.(selector)) {
      match = current;
      break;
    }
    current = current.parentElement;
  }
  visited.forEach((candidate) => cache.set(candidate, match));
  return match;
}

export function addUniqueCapped(targets, element, cap) {
  if (!(element instanceof Element)) return;
  if (!element.isConnected) return;
  if (targets.includes(element)) return;
  if (targets.length >= cap) return;
  targets.push(element);
}

export function collectMatchingElements(root, selector, cap) {
  if (!(root instanceof Element) || !selector) return [];
  const results = [];
  if (root.matches?.(selector)) addUniqueCapped(results, root, cap);
  if (results.length >= cap || typeof root.querySelectorAll !== 'function') return results;
  root.querySelectorAll(selector).forEach((element) => {
    addUniqueCapped(results, element, cap);
  });
  return results;
}

export function normalizeSemanticMetricText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getAncestorDistance(child, ancestor, maxDepth = 12) {
  if (!(child instanceof Element) || !(ancestor instanceof Element)) return null;
  if (child === ancestor) return 0;
  let distance = 0;
  let current = child;
  while (current instanceof Element && distance <= maxDepth) {
    if (current === ancestor) return distance;
    current = current.parentElement;
    distance += 1;
  }
  return null;
}

function getActionButtonSelector(profile) {
  return profile?.actionButtonSelector || DEFAULT_ACTION_BUTTON_SELECTOR;
}

function getActionContainerSelector(profile) {
  return profile?.actionContainerSelector || DEFAULT_ACTION_CONTAINER_SELECTOR;
}

function getCandidateSelector(profile) {
  return profile?.candidateSelector || DEFAULT_CANDIDATE_SELECTOR;
}

function getGraphicSelector(profile) {
  return profile?.graphicSelector || DEFAULT_GRAPHIC_SELECTOR;
}

function getElementText(el, profile) {
  if (typeof profile?.getCandidateText === 'function') {
    return normalizeSemanticMetricText(profile.getCandidateText(el));
  }
  return normalizeSemanticMetricText(el?.textContent);
}

function getActionLabelText(button, profile) {
  if (typeof profile?.getActionLabelText === 'function') {
    return normalizeSemanticMetricText(profile.getActionLabelText(button));
  }
  return normalizeSemanticMetricText([
    button?.getAttribute?.('aria-label'),
    button?.getAttribute?.('title'),
  ].filter(Boolean).join(' '));
}

function resolveActionType(button, profile) {
  const labelText = getActionLabelText(button, profile);
  if (typeof profile?.resolveActionType === 'function') {
    return profile.resolveActionType(button, labelText) || null;
  }
  return null;
}

function hasGraphicDescendant(el, profile) {
  const selector = getGraphicSelector(profile);
  return !!el?.querySelector?.(selector);
}

function isMetricCandidateText(candidate, profile) {
  if (!(candidate instanceof Element)) return false;
  if (hasGraphicDescendant(candidate, profile)) return false;

  const text = getElementText(candidate, profile);
  const maxLength = getLimit(profile, 'maxCandidateTextLength');
  if (!text || text.length > maxLength) return false;

  if (typeof profile?.isCandidateText === 'function') {
    return !!profile.isCandidateText(candidate, text);
  }
  if (profile?.candidateTextPattern instanceof RegExp) {
    return profile.candidateTextPattern.test(text);
  }
  return true;
}

export function collectSemanticActionRoots(button, profile = {}) {
  const roots = [];
  if (!(button instanceof Element)) return roots;
  const maxRoots = getLimit(profile, 'maxRoots');
  const maxDepth = getLimit(profile, 'maxAncestorDepth');
  const actionRootSelector = profile.actionRootSelector || '';
  const actionContainerSelector = getActionContainerSelector(profile);

  addUniqueCapped(roots, button, maxRoots);

  const labelRoot = button.closest?.('label');
  if (labelRoot) addUniqueCapped(roots, labelRoot, maxRoots);

  const semanticRoot = actionRootSelector ? button.closest?.(actionRootSelector) : null;
  if (semanticRoot) addUniqueCapped(roots, semanticRoot, maxRoots);

  let current = button.parentElement;
  let depth = 0;
  while (
    current instanceof Element
    && current !== document.body
    && current !== document.documentElement
    && depth < maxDepth
  ) {
    if (depth <= 1 || current.matches?.(actionContainerSelector)) {
      addUniqueCapped(roots, current, maxRoots);
    }
    current = current.parentElement;
    depth += 1;
  }

  return roots;
}

export function collectNearbySemanticActionButtons(el, profile = {}) {
  const buttons = [];
  if (!(el instanceof Element)) return buttons;

  const maxButtons = getLimit(profile, 'maxButtons');
  const maxRoots = getLimit(profile, 'maxRoots');
  const maxDepth = getLimit(profile, 'maxAncestorDepth');
  const actionButtonSelector = getActionButtonSelector(profile);
  const actionRootSelector = profile.actionRootSelector || '';
  const actionContainerSelector = getActionContainerSelector(profile);

  const closestButton = el.closest?.(actionButtonSelector);
  if (closestButton) addUniqueCapped(buttons, closestButton, maxButtons);

  const containers = [];
  const labelRoot = el.closest?.('label');
  if (labelRoot) addUniqueCapped(containers, labelRoot, maxRoots);
  const semanticRoot = actionRootSelector ? el.closest?.(actionRootSelector) : null;
  if (semanticRoot) addUniqueCapped(containers, semanticRoot, maxRoots);

  let current = el.parentElement;
  let depth = 0;
  while (
    current instanceof Element
    && current !== document.body
    && current !== document.documentElement
    && depth < maxDepth
  ) {
    if (depth <= 1 || current.matches?.(actionContainerSelector)) {
      addUniqueCapped(containers, current, maxRoots);
    }
    current = current.parentElement;
    depth += 1;
  }

  containers.forEach((container) => {
    collectMatchingElements(container, actionButtonSelector, maxButtons)
      .forEach((button) => addUniqueCapped(buttons, button, maxButtons));
  });

  return buttons.filter((button) => !!resolveActionType(button, profile));
}

function hasActionLabelCountEcho(button, candidate, profile) {
  const labelText = getActionLabelText(button, profile).replace(/\s+/g, '');
  const candidateText = getElementText(candidate, profile).replace(/\s+/g, '');
  return !!candidateText && labelText.includes(candidateText);
}

function scoreExpectedOrder(button, root, actionType, profile) {
  const expectedOrder = profile?.actions?.[actionType]?.expectedOrder;
  if (!Number.isFinite(expectedOrder)) return 0;
  const actionButtons = collectMatchingElements(
    root,
    getActionButtonSelector(profile),
    getLimit(profile, 'maxButtons')
  );
  if (actionButtons.length <= 1 || actionButtons.length <= expectedOrder) return 0;
  const index = actionButtons.indexOf(button);
  if (index < 0) return 0;
  const delta = Math.abs(index - expectedOrder);
  if (delta === 0) return getScore(profile, 'orderExact');
  if (delta === 1) return getScore(profile, 'orderNear');
  return Math.max(
    getScore(profile, 'maxOrderPenalty'),
    delta * getScore(profile, 'orderMissPenalty')
  );
}

export function scoreSemanticActionMetricCandidate(button, candidate, root, actionType, profile = {}) {
  if (!(button instanceof Element) || !(candidate instanceof Element) || !(root instanceof Element)) {
    return null;
  }
  if (!actionType || !isMetricCandidateText(candidate, profile)) return null;
  if (!root.contains(button) || !root.contains(candidate)) return null;

  const actionButtonSelector = getActionButtonSelector(profile);
  const candidateButton = candidate.closest?.(actionButtonSelector);
  if (candidateButton instanceof Element && candidateButton !== button) return null;

  const buttonDistance = getAncestorDistance(button, root);
  const candidateDistance = getAncestorDistance(candidate, root);
  if (buttonDistance === null || candidateDistance === null) return null;

  let score = getScore(profile, 'actionType') + getScore(profile, 'candidateText');

  if (button.contains(candidate)) {
    score += getScore(profile, 'insideButton');
  } else {
    score += getScore(profile, 'outsideButton');
    const sharedLabel = button.closest?.('label');
    if (sharedLabel instanceof Element && sharedLabel.contains(candidate)) {
      score += getScore(profile, 'sameLabel');
    }
    if (button.parentElement instanceof Element && button.parentElement.contains(candidate)) {
      score += getScore(profile, 'buttonParentContains');
    }
    if (
      candidate.parentElement instanceof Element
      && button.parentElement instanceof Element
      && candidate.parentElement.parentElement === button.parentElement
    ) {
      score += getScore(profile, 'siblingUnderButtonParent');
    }
  }

  if (candidate.getAttribute?.('role') === 'text') score += getScore(profile, 'roleText');
  score += candidate.children.length === 0
    ? getScore(profile, 'leaf')
    : getScore(profile, 'nonLeaf');
  if (hasActionLabelCountEcho(button, candidate, profile)) score += getScore(profile, 'labelEcho');

  score += scoreExpectedOrder(button, root, actionType, profile);
  score += Number(profile?.actions?.[actionType]?.scoreBonus) || 0;

  const depthUnits = Math.min(
    buttonDistance + candidateDistance,
    getScore(profile, 'maxDepthPenaltyUnits')
  );
  score += depthUnits * getScore(profile, 'depthPenalty');

  if (typeof profile?.scoreCandidate === 'function') {
    score += Number(profile.scoreCandidate({ button, candidate, root, actionType, score })) || 0;
  }

  return score;
}

export function resolveSemanticActionMetricCandidate(button, profile = {}) {
  const actionType = resolveActionType(button, profile);
  if (!actionType) return null;

  const matchesByCandidate = new Map();
  const threshold = getLimit(profile, 'threshold');
  const candidateLimit = getLimit(profile, 'maxCandidatesPerButton');
  let truncated = false;
  collectSemanticActionRoots(button, profile).forEach((root) => {
    const candidates = [];
    const selector = getCandidateSelector(profile);
    const actionSelector = getActionButtonSelector(profile);
    const acceptCandidate = (candidate) => {
      const owner = candidate.closest(actionSelector);
      if (owner && owner !== button) return;
      if (!isMetricCandidateText(candidate, profile)) return;
      addUniqueCapped(candidates, candidate, candidateLimit + 1);
    };
    if (root.matches(selector)) acceptCandidate(root);
    for (const candidate of root.querySelectorAll(selector)) {
      acceptCandidate(candidate);
      if (candidates.length > candidateLimit) break;
    }
    // A bounded point verdict cannot certify a winner while another numeric
    // edge may be outside its evidence window. Decorative text and another
    // button's descendants do not consume this numeric evidence budget.
    // Collection exhaustion and
    // owner-local qualification exhaustion are different facts.
    if (candidates.length > candidateLimit) { truncated = true; return; }
    candidates.forEach((candidate) => {
      const score = scoreSemanticActionMetricCandidate(button, candidate, root, actionType, profile);
      if (score === null || score < threshold) return;
      const current = matchesByCandidate.get(candidate);
      if (!current || score > current.score) {
        matchesByCandidate.set(candidate, { button, target: candidate, type: actionType, score });
      }
    });
  });
  if (truncated) return null;
  const matches = Array.from(matchesByCandidate.values())
    .sort((left, right) => right.score - left.score);
  const best = matches[0] || null;
  const runnerUp = matches[1] || null;
  const minScoreMargin = getLimit(profile, 'minScoreMargin');
  if (best && runnerUp && best.score - runnerUp.score < minScoreMargin) return null;
  return best;
}

export function resolveSemanticActionMetricMatchForElement(el, profile = {}) {
  if (!isMetricCandidateText(el, profile)) return null;

  const matchesByButton = new Map();
  const threshold = getLimit(profile, 'threshold');
  collectNearbySemanticActionButtons(el, profile).forEach((button) => {
    const actionType = resolveActionType(button, profile);
    if (!actionType) return;
    collectSemanticActionRoots(button, profile).forEach((root) => {
      const score = scoreSemanticActionMetricCandidate(button, el, root, actionType, profile);
      if (score === null || score < threshold) return;
      const current = matchesByButton.get(button);
      if (!current || score > current.score) {
        matchesByButton.set(button, { button, target: el, type: actionType, score });
      }
    });
  });
  const matches = Array.from(matchesByButton.values())
    .sort((left, right) => right.score - left.score);
  const best = matches[0] || null;
  const runnerUp = matches[1] || null;
  const minScoreMargin = getLimit(profile, 'minScoreMargin');
  if (best && runnerUp && best.score - runnerUp.score < minScoreMargin) return null;
  return best;
}

export function collectSemanticActionMetricCandidates(scope, profile = {}) {
  const candidates = [];
  collectMatchingElements(scope, getActionButtonSelector(profile), getLimit(profile, 'maxButtons'))
    .forEach((button) => {
      const match = resolveSemanticActionMetricCandidate(button, profile);
      if (match?.target) {
        addUniqueCapped(candidates, match.target, getLimit(profile, 'maxCandidatesPerButton'));
      }
    });
  return candidates;
}

export function collectSemanticActionMutationRoots(payload = {}, profile = {}) {
  const roots = [];
  const sources = collectUniqueMutationSourceNodes([
    ...(Array.isArray(payload.addedNodes) ? payload.addedNodes : []),
    ...(Array.isArray(payload.attributeTargets) ? payload.attributeTargets : []),
    ...(Array.isArray(payload.textNodes) ? payload.textNodes : []),
    ...collectRemovalMutationTargets(payload),
  ]);
  const maxRoots = getLimit(profile, 'maxRoots');
  const actionButtonSelector = getActionButtonSelector(profile);
  const actionContainerSelector = getActionContainerSelector(profile);
  const closestButtonCache = new WeakMap();
  const closestContainerCache = new WeakMap();
  const acceptedButtonCache = new WeakMap();
  const resolvedButtons = new WeakSet();
  const acceptsActionButton = (button) => {
    if (acceptedButtonCache.has(button)) return acceptedButtonCache.get(button);
    const accepted = typeof profile?.resolveActionType !== 'function'
      || !!resolveActionType(button, profile);
    acceptedButtonCache.set(button, accepted);
    return accepted;
  };
  const broadSources = [];

  sources.forEach((node) => {
    if (roots.length >= maxRoots) return;
    const element = toSemanticElement(node);
    if (!(element instanceof Element) || !element.isConnected) return;
    let hasResolvedLocalRoot = false;

    const closestButton = resolveClosestElementCached(
      element,
      actionButtonSelector,
      closestButtonCache,
    );
    if (closestButton && acceptsActionButton(closestButton)) {
      if (!resolvedButtons.has(closestButton)) {
        resolvedButtons.add(closestButton);
        collectSemanticActionRoots(closestButton, profile)
          .forEach((root) => addUniqueCapped(roots, root, maxRoots));
      }
      hasResolvedLocalRoot = true;
    }

    const closestActionContainer = resolveClosestElementCached(
      element,
      actionContainerSelector,
      closestContainerCache,
    );
    if (closestActionContainer) {
      addUniqueCapped(roots, closestActionContainer, maxRoots);
      hasResolvedLocalRoot = true;
    }

    if (hasResolvedLocalRoot) return;

    broadSources.push(element);
  });

  collapseMutationSourceNodes(broadSources).forEach((element) => {
    if (roots.length >= maxRoots) return;
    collectMatchingElements(element, actionButtonSelector, maxRoots)
      .filter(acceptsActionButton)
      .forEach((button) => {
        collectSemanticActionRoots(button, profile)
          .forEach((root) => addUniqueCapped(roots, root, maxRoots));
      });
  });

  return roots;
}
