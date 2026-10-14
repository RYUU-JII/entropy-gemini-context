import { validateInteractionTargets } from './interactionTargetProfiles.js';

export const CLICK_BOUNDARY_KINDS = Object.freeze({
  REWARD_ENTRY: 'reward_entry',
  REWARD_CONTINUATION: 'reward_continuation',
  SOCIAL_REINFORCEMENT: 'social_reinforcement',
  CONTINUOUS_FEED: 'continuous_feed',
  CURRENT_CONTENT: 'current_content',
  UTILITY: 'utility',
  ESCAPE: 'escape',
  NATIVE_CONTROL: 'native_control',
  UNKNOWN: 'unknown',
});

export const CLICK_BOUNDARY_BRAKES = Object.freeze({
  BYPASS: 'bypass',
  COMMIT_PAUSE: 'commit_pause',
  ENSO_GATE_ELIGIBLE: 'enso_gate_eligible',
});

const ENSO_GATE_ELIGIBLE_CONFIDENCE = 0.68;
const FORM_CONTROL_SELECTOR = 'input, textarea, select, option, label, [contenteditable]:not([contenteditable="false"])';
const CARDISH_CLASS_PATTERN = /(card|item|post|feed|story|product|thumb|tile|listing|result|recommend)/i;
const SOCIAL_ACTION_PATTERN = /\b(like|unlike|follow|unfollow|subscribe|repost|retweet|share|save|bookmark|comment|reply|react)\b/i;
const UTILITY_ACTION_PATTERN = /^(?:(?:(?:open|show) )?(?:settings?|menu|options?|filters?|sort|language|help|search)|more options|copy link|report|not interested)[.!…]?$/i;
const ESCAPE_ACTION_PATTERN = /^(?:(?:close|dismiss|cancel|exit|leave|hide)(?: (?:this |the )?(?:dialog|modal|menu|panel|popup|notification|banner|window|comments|settings|player|video|details|controls|search))?|(?:go )?back(?: to (?:home(?: page)?|(?:the )?(?:previous page|previous screen|search results|feed|profile|library)))?|not now|skip)[.!…]?$/i;
const KOREAN_UTILITY_ACTION_PATTERN = /^(?:(?:설정|메뉴|옵션|필터|정렬|언어|도움말|검색)(?: 열기)?|추가 옵션|옵션 더보기|링크 복사|신고|관심 없음)[.!…]?$/u;
const KOREAN_ESCAPE_ACTION_PATTERN = /^(?:(?:(?:이 |현재 )?(?:창|대화상자|메뉴|패널|알림|댓글|설정|검색) ?)?(?:닫기|숨기기)|취소|뒤로 ?가기|뒤로|이전 페이지로 돌아가기|홈으로 돌아가기|나가기|종료|나중에|지금은 안 함|건너뛰기)[.!…]?$/u;
const CONTINUATION_ACTION_PATTERN = /\b(next|more|related|recommended|continue|watch|open|view|play|see more)\b/i;
const validatedTargetCache = new WeakMap();

function resolveValidatedTargets(targets) {
  const cached = targets && typeof targets === 'object'
    ? validatedTargetCache.get(targets)
    : null;
  if (cached) return cached;
  const validated = validateInteractionTargets(targets);
  validatedTargetCache.set(targets, validated);
  return validated;
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function getSelectorFailureMessage(error) {
  return String(error?.message || error || 'CLICK_BOUNDARY_SELECTOR_FAILURE');
}

function reportSelectorFailure(context, operation, selector, error) {
  if (!context || !selector) return;
  const key = `${operation}:${selector}:${getSelectorFailureMessage(error)}`;
  if (context.failureKeys.has(key)) return;
  context.failureKeys.add(key);
  const failure = {
    operation,
    selector,
    error: getSelectorFailureMessage(error),
  };
  context.failures.push(failure);
  context.onSelectorFailure?.(operation, selector, error);
}

function createSelectorContext(onSelectorFailure = null) {
  return {
    onSelectorFailure: typeof onSelectorFailure === 'function' ? onSelectorFailure : null,
    failures: [],
    failureKeys: new Set(),
  };
}

function safeMatches(el, selector, context = null) {
  if (!(el instanceof Element) || !selector) return false;
  try {
    return el.matches(selector);
  } catch (error) {
    reportSelectorFailure(context, 'boundary_matches', selector, error);
    return false;
  }
}

function safeClosest(el, selector, context = null) {
  if (!(el instanceof Element) || !selector) return null;
  try {
    return el.closest(selector);
  } catch (error) {
    reportSelectorFailure(context, 'boundary_closest', selector, error);
    return null;
  }
}

function safeQuery(el, selector, context = null) {
  if (!(el instanceof Element) || !selector || typeof el.querySelector !== 'function') return null;
  try {
    return el.querySelector(selector);
  } catch (error) {
    reportSelectorFailure(context, 'boundary_query', selector, error);
    return null;
  }
}

function readSignalText(el) {
  if (!(el instanceof Element)) return '';
  return [
    el.getAttribute('aria-label'),
    el.getAttribute('title'),
    el.getAttribute('id'),
    typeof el.className === 'string' ? el.className : '',
    el.getAttribute('data-testid'),
    el.getAttribute('data-e2e'),
    el.getAttribute('href'),
    el.textContent,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeControlLabel(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function readControlSignal(el) {
  // IDREFs belong to this action's tree, in author order. Referenced naming
  // takes precedence over aria-label, including an explicitly empty name.
  // Do not follow another aria-labelledby edge while reading its references.
  const root = el.getRootNode();
  const ids = normalizeControlLabel(el.getAttribute('aria-labelledby')).split(' ').filter(Boolean);
  const references = Array.from(new Set(ids))
    .map((id) => root.getElementById?.(id))
    .filter((reference) => reference instanceof Element);
  if (references.length > 0) {
    const label = normalizeControlLabel(references.map((reference) => (
      normalizeControlLabel(reference.getAttribute('aria-label'))
      || normalizeControlLabel(reference.textContent)
      || normalizeControlLabel(reference.getAttribute('title'))
    )).join(' '));
    return { label, explicit: true };
  }
  const ariaLabel = normalizeControlLabel(el.getAttribute('aria-label'));
  const title = normalizeControlLabel(el.getAttribute('title'));
  const text = normalizeControlLabel(el.textContent);
  return {
    label: ariaLabel || text || title,
    explicit: !!ariaLabel || (!text && !!title),
  };
}

function getTagName(el) {
  return (el?.tagName || '').toLowerCase();
}

function getRole(el) {
  return String(el?.getAttribute?.('role') || '').trim().toLowerCase();
}

function matchesEither(rawTarget, target, selector, context = null) {
  if (!selector) return false;
  return safeMatches(target, selector, context)
    || safeMatches(rawTarget, selector, context)
    || !!safeClosest(rawTarget, selector, context)
    || !!safeClosest(target, selector, context);
}

function hasDescendant(el, selector, context = null) {
  if (!(el instanceof Element) || !selector) return false;
  return !!safeQuery(el, selector, context);
}

function isSpecialHref(target) {
  if (!(target instanceof Element)) return false;
  const href = String(target.getAttribute('href') || '').trim();
  return !!href && /^(#|mailto:|tel:|blob:|data:|javascript:)/i.test(href);
}

function isNavigationalHref(target) {
  if (!(target instanceof Element)) return false;
  const href = String(target.getAttribute('href') || '').trim();
  return !!href && !isSpecialHref(target);
}

function addEvidence(scores, kind, weight, reason) {
  if (!kind || weight <= 0) return;
  const next = scores.get(kind) || { score: 0, evidence: [] };
  next.score += weight;
  next.evidence.push(reason);
  scores.set(kind, next);
}

function resolveWinner(scores) {
  const priority = [
    CLICK_BOUNDARY_KINDS.NATIVE_CONTROL,
    CLICK_BOUNDARY_KINDS.CURRENT_CONTENT,
    CLICK_BOUNDARY_KINDS.ESCAPE,
    CLICK_BOUNDARY_KINDS.CONTINUOUS_FEED,
    CLICK_BOUNDARY_KINDS.UTILITY,
    CLICK_BOUNDARY_KINDS.SOCIAL_REINFORCEMENT,
    CLICK_BOUNDARY_KINDS.REWARD_CONTINUATION,
    CLICK_BOUNDARY_KINDS.REWARD_ENTRY,
  ];
  let winner = {
    kind: CLICK_BOUNDARY_KINDS.UNKNOWN,
    confidence: 0.2,
    evidence: [],
  };

  for (const kind of priority) {
    const candidate = scores.get(kind);
    if (!candidate) continue;
    const confidence = clamp(candidate.score, 0, 1);
    if (confidence > winner.confidence || (confidence === winner.confidence && winner.kind === CLICK_BOUNDARY_KINDS.UNKNOWN)) {
      winner = {
        kind,
        confidence,
        evidence: candidate.evidence.slice(0, 8),
      };
    }
  }

  return winner;
}

function resolveBrake(kind, confidence) {
  if (
    kind === CLICK_BOUNDARY_KINDS.NATIVE_CONTROL
    || kind === CLICK_BOUNDARY_KINDS.ESCAPE
    || kind === CLICK_BOUNDARY_KINDS.CONTINUOUS_FEED
    || kind === CLICK_BOUNDARY_KINDS.UTILITY
  ) {
    return CLICK_BOUNDARY_BRAKES.BYPASS;
  }

  if (kind === CLICK_BOUNDARY_KINDS.SOCIAL_REINFORCEMENT) return CLICK_BOUNDARY_BRAKES.COMMIT_PAUSE;

  if (
    (kind === CLICK_BOUNDARY_KINDS.REWARD_ENTRY || kind === CLICK_BOUNDARY_KINDS.REWARD_CONTINUATION)
    && confidence >= ENSO_GATE_ELIGIBLE_CONFIDENCE
  ) {
    return CLICK_BOUNDARY_BRAKES.ENSO_GATE_ELIGIBLE;
  }

  return CLICK_BOUNDARY_BRAKES.COMMIT_PAUSE;
}

export function classifyClickBoundary({
  rawTarget = null,
  target = null,
  selectors = null,
  onSelectorFailure = null,
} = {}) {
  const raw = rawTarget instanceof Element ? rawTarget : target;
  const el = target instanceof Element ? target : raw;
  if (!(el instanceof Element)) {
    return {
      kind: CLICK_BOUNDARY_KINDS.UNKNOWN,
      confidence: 0,
      brake: CLICK_BOUNDARY_BRAKES.BYPASS,
      evidence: [],
    };
  }

  const resolvedSelectors = resolveValidatedTargets(selectors);
  const hints = resolvedSelectors.clickBoundaryHints;
  const selectorContext = createSelectorContext(onSelectorFailure);
  const scores = new Map();
  const tagName = getTagName(el);
  const role = getRole(el);
  const rawText = readSignalText(raw);
  const targetText = readSignalText(el);
  const combinedText = `${rawText} ${targetText}`.trim();
  const controlSignal = readControlSignal(el);
  const contentItemSelector = resolvedSelectors.rewardContentItemTargets;
  const mediaSelector = resolvedSelectors.rewardMediaTargets;
  const rewardContainerSelector = resolvedSelectors.rewardContainerTargets;
  const rewardContainer = safeClosest(raw, rewardContainerSelector, selectorContext)
    || safeClosest(el, rewardContainerSelector, selectorContext);

  if (matchesEither(raw, el, hints.nativeControlTargets, selectorContext)) {
    addEvidence(scores, CLICK_BOUNDARY_KINDS.NATIVE_CONTROL, 1, 'native_control_selector');
  }
  // Match the resolved action itself, not its ancestors: a recommendation link
  // inside a player still opens another item. The player's own pause/resume
  // action remains eligible for the separate click pause, never an Enso Gate.
  if (safeMatches(el, hints.currentContentTargets, selectorContext)) {
    addEvidence(scores, CLICK_BOUNDARY_KINDS.CURRENT_CONTENT, 1, 'current_content_selector');
  }
  if (safeClosest(raw, FORM_CONTROL_SELECTOR, selectorContext)) {
    addEvidence(scores, CLICK_BOUNDARY_KINDS.NATIVE_CONTROL, 0.9, 'form_or_editable_surface');
  }
  if (matchesEither(raw, el, resolvedSelectors.continuousFeedContextTargets, selectorContext)) {
    addEvidence(scores, CLICK_BOUNDARY_KINDS.CONTINUOUS_FEED, 0.88, 'short_form_or_continuous_feed_context');
  }

  // Bypass authority belongs to this action, not an enclosing card's label,
  // URL, identity tokens, or a word inside its content title.
  if (safeMatches(el, hints.escapeTargets, selectorContext)) {
    addEvidence(scores, CLICK_BOUNDARY_KINDS.ESCAPE, 1, 'escape_control_selector');
  }
  if (ESCAPE_ACTION_PATTERN.test(controlSignal.label) || KOREAN_ESCAPE_ACTION_PATTERN.test(controlSignal.label)) {
    addEvidence(scores, CLICK_BOUNDARY_KINDS.ESCAPE, controlSignal.explicit ? 1 : 0.9, 'escape_label');
  }
  if (safeMatches(el, hints.utilityTargets, selectorContext)) {
    addEvidence(scores, CLICK_BOUNDARY_KINDS.UTILITY, 1, 'utility_control_selector');
  }
  if (UTILITY_ACTION_PATTERN.test(controlSignal.label) || KOREAN_UTILITY_ACTION_PATTERN.test(controlSignal.label)) {
    addEvidence(scores, CLICK_BOUNDARY_KINDS.UTILITY, controlSignal.explicit ? 1 : 0.78, 'utility_label');
  }

  if (matchesEither(raw, el, hints.socialReinforcementTargets, selectorContext) || SOCIAL_ACTION_PATTERN.test(combinedText)) {
    addEvidence(scores, CLICK_BOUNDARY_KINDS.SOCIAL_REINFORCEMENT, 0.74, 'social_action_label');
  }

  if (matchesEither(raw, el, hints.rewardContinuationTargets, selectorContext)) {
    addEvidence(scores, CLICK_BOUNDARY_KINDS.REWARD_CONTINUATION, 0.74, 'reward_continuation_hint');
  }
  if (CONTINUATION_ACTION_PATTERN.test(combinedText)) {
    addEvidence(scores, CLICK_BOUNDARY_KINDS.REWARD_CONTINUATION, 0.42, 'continuation_label');
  }

  if (matchesEither(raw, el, resolvedSelectors.clickDelayActionableTargets, selectorContext)) {
    addEvidence(scores, CLICK_BOUNDARY_KINDS.REWARD_ENTRY, 0.5, 'site_actionable_hint');
  }
  if (matchesEither(raw, el, hints.rewardEntryTargets, selectorContext)) {
    addEvidence(scores, CLICK_BOUNDARY_KINDS.REWARD_ENTRY, 0.5, 'reward_entry_hint');
  }
  if (safeClosest(raw, contentItemSelector, selectorContext) || safeMatches(el, contentItemSelector, selectorContext)) {
    addEvidence(scores, CLICK_BOUNDARY_KINDS.REWARD_ENTRY, 0.3, 'feed_item_context');
  }
  if (rewardContainer) {
    addEvidence(scores, CLICK_BOUNDARY_KINDS.REWARD_ENTRY, 0.2, 'reward_container_context');
  }
  if (tagName === 'article' || role === 'article' || role === 'listitem') {
    addEvidence(scores, CLICK_BOUNDARY_KINDS.REWARD_ENTRY, 0.42, 'content_item_role');
  }
  if (tagName === 'a' || role === 'link' || el.hasAttribute('href')) {
    addEvidence(scores, CLICK_BOUNDARY_KINDS.REWARD_ENTRY, isNavigationalHref(el) ? 0.38 : 0.18, 'link_transition');
  }
  if (hasDescendant(el, mediaSelector, selectorContext) || safeMatches(raw, mediaSelector, selectorContext)) {
    addEvidence(scores, CLICK_BOUNDARY_KINDS.REWARD_ENTRY, 0.26, 'media_or_thumbnail');
  }
  if (CARDISH_CLASS_PATTERN.test(String(el.className || '')) || CARDISH_CLASS_PATTERN.test(String(raw?.className || ''))) {
    addEvidence(scores, CLICK_BOUNDARY_KINDS.REWARD_ENTRY, 0.18, 'cardish_class');
  }

  if (selectorContext.failures.length > 0) {
    return {
      kind: CLICK_BOUNDARY_KINDS.UNKNOWN,
      confidence: 0,
      brake: CLICK_BOUNDARY_BRAKES.COMMIT_PAUSE,
      evidence: ['selector_failure'],
      selectorFailures: selectorContext.failures.slice(0, 8),
    };
  }

  const winner = resolveWinner(scores);
  const brake = resolveBrake(winner.kind, winner.confidence);

  return {
    ...winner,
    brake,
  };
}

export function isRewardClickBoundary(boundary = null) {
  return boundary?.kind === CLICK_BOUNDARY_KINDS.REWARD_ENTRY
    || boundary?.kind === CLICK_BOUNDARY_KINDS.REWARD_CONTINUATION;
}

export function isEnsoGateEligibleClickBoundary(boundary = null) {
  return isRewardClickBoundary(boundary) && boundary?.brake === CLICK_BOUNDARY_BRAKES.ENSO_GATE_ELIGIBLE;
}

export default classifyClickBoundary;
