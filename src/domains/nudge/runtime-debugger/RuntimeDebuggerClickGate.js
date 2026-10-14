export const CLICK_GATE_TAB_ID = 'click';
export const CLICK_ROUTING_DECISION_EVENT = 'click_routing_decision';

function fmtNum(value) {
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : '0';
}

export function getClickIntentGateFeature(protection = {}) {
  return protection?.features?.ensoGate || {};
}

export function findLastClickRoutingDecision(feature = {}) {
  const history = Array.isArray(feature.history) ? feature.history : [];
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const entry = history[i];
    if (entry?.type === 'event' && entry.name === CLICK_ROUTING_DECISION_EVENT) return entry;
  }
  return null;
}

export function createClickGateSnapshot(protection = {}) {
  const feature = getClickIntentGateFeature(protection);
  const delayFeature = protection?.features?.clickDelay || {};
  const summary = protection?.summary?.features?.ensoGate || {};
  const history = [
    ...(Array.isArray(feature.history) ? feature.history : []),
    ...(Array.isArray(delayFeature.history) ? delayFeature.history : []),
  ].sort((left, right) => (Number(left?.at) || 0) - (Number(right?.at) || 0));
  const routingDecisions = history
    .filter((entry) => entry?.type === 'event' && entry.name === CLICK_ROUTING_DECISION_EVENT)
    .slice(-10)
    .reverse();
  return {
    active: feature.active === true || delayFeature.active === true,
    status: summary.status || (feature.active || delayFeature.active ? 'active' : 'inactive'),
    applyCount: (Number(feature.applyCount) || 0) + (Number(delayFeature.applyCount) || 0),
    unmountCount: (Number(feature.unmountCount) || 0) + (Number(delayFeature.unmountCount) || 0),
    eventCounts: feature.eventCounts || {},
    lastEvent: feature.lastEvent || null,
    lastError: feature.lastError || null,
    hints: Array.isArray(summary.hints) ? summary.hints : [],
    limits: Array.isArray(summary.limits) ? summary.limits : [],
    lastDecision: routingDecisions[0] || findLastClickRoutingDecision(feature),
    recentDecisions: routingDecisions,
    recentHistory: history.slice(-14).reverse(),
  };
}

export function formatClickBoundarySummary(boundary = {}) {
  if (!boundary || typeof boundary !== 'object') return '-';
  return [
    boundary.kind ? `kind=${boundary.kind}` : '',
    boundary.brake ? `brake=${boundary.brake}` : '',
    boundary.confidence !== null && boundary.confidence !== undefined
      ? `confidence=${boundary.confidence}`
      : '',
    boundary.evidence ? `evidence=${boundary.evidence}` : '',
    boundary.selectorFailures ? `selectorFailures=${boundary.selectorFailures}` : '',
  ].filter(Boolean).join(' ');
}

export function formatSelectorMatchSummary(matches = {}) {
  if (!matches || typeof matches !== 'object') return '-';
  return [
    `interactive=${matches.interactive === true ? 'Y' : 'N'}${matches.interactiveNode ? `:${matches.interactiveNode}` : ''}`,
    `actionable=${matches.actionable === true ? 'Y' : 'N'}${matches.actionableNode ? `:${matches.actionableNode}` : ''}`,
    `explicitBypass=${matches.explicitBypass === true ? 'Y' : 'N'}${matches.explicitBypassNode ? `:${matches.explicitBypassNode}` : ''}`,
    `nativeGestureBypass=${matches.nativeGestureBypass === true ? 'Y' : 'N'}${matches.nativeGestureBypassNode ? `:${matches.nativeGestureBypassNode}` : ''}`,
    matches.trustedBypassFamily ? `trustedBypass=${matches.trustedBypassFamily}:${matches.trustedBypassNode || '-'}` : '',
  ].filter(Boolean).join(' | ');
}

export function formatYouTubeContractSummary(youtube = {}) {
  if (!youtube || typeof youtube !== 'object') return '-';
  return [
    `player=${youtube.insidePlayer === true ? 'Y' : 'N'}${youtube.playerNode ? `:${youtube.playerNode}` : ''}`,
    `chromeBottom=${youtube.insideChromeBottom === true ? 'Y' : 'N'}${youtube.chromeBottomNode ? `:${youtube.chromeBottomNode}` : ''}`,
    `chromeControls=${youtube.insideChromeControls === true ? 'Y' : 'N'}${youtube.chromeControlsNode ? `:${youtube.chromeControlsNode}` : ''}`,
    `button=${youtube.insideButton === true ? 'Y' : 'N'}${youtube.buttonNode ? `:${youtube.buttonNode}` : ''}`,
    `progress=${youtube.insideProgress === true ? 'Y' : 'N'}${youtube.progressNode ? `:${youtube.progressNode}` : ''}`,
    `menu=${youtube.insideMenu === true ? 'Y' : 'N'}${youtube.menuNode ? `:${youtube.menuNode}` : ''}`,
    `volume=${youtube.insideVolume === true ? 'Y' : 'N'}${youtube.volumeNode ? `:${youtube.volumeNode}` : ''}`,
  ].join(' | ');
}

export function formatEnsoGateReadinessSummary(ensoGate = {}) {
  if (!ensoGate || typeof ensoGate !== 'object') return '-';
  return [
    ensoGate.reason ? `reason=${ensoGate.reason}` : '',
    ensoGate.cadence
      ? `consumedMs=${ensoGate.cadence.consumedMs}/${ensoGate.cadence.intervalMs} remainingMs=${ensoGate.cadence.remainingMs} timeReason=${ensoGate.cadence.reason} revision=${ensoGate.cadence.revision}`
      : 'cadence=unavailable',
    ensoGate.pending === true ? `pending=${ensoGate.pendingReason || 'Y'}` : '',
  ].filter(Boolean).join(' ');
}

export function summarizeClickRoutingDecision(entry = null) {
  if (!entry) return '- 아직 클릭 라우팅 판정 이벤트가 없습니다.';
  const details = entry.details && typeof entry.details === 'object' ? entry.details : {};
  const parts = [
    `action=${details.action || '-'}`,
    details.reason ? `reason=${details.reason}` : '',
    details.phase ? `phase=${details.phase}` : '',
    details.eventType ? `event=${details.eventType}` : '',
    typeof details.isTrusted === 'boolean' ? `trusted=${details.isTrusted}` : '',
    details.rawTarget ? `raw=${details.rawTarget}` : '',
    details.target ? `target=${details.target}` : '',
    details.delayMs !== undefined ? `delayMs=${fmtNum(details.delayMs)}` : '',
    details.ensoGate ? `ensoGate=[${formatEnsoGateReadinessSummary(details.ensoGate)}]` : '',
  ].filter(Boolean);
  return `- ${parts.join(' ')}`;
}

export function summarizeClickRoutingTimeline(decisions = []) {
  if (!Array.isArray(decisions) || decisions.length === 0) {
    return '- 최근 클릭 라우팅 판정이 없습니다.';
  }
  return decisions.map((entry, index) => {
    const details = entry.details && typeof entry.details === 'object' ? entry.details : {};
    return [
      `${index + 1}. ${details.action || '-'} reason=${details.reason || '-'} event=${details.eventType || '-'}`,
      `   target=${details.target || '-'} raw=${details.rawTarget || '-'}`,
      `   selectors=${formatSelectorMatchSummary(details.selectorMatches)}`,
      `   boundary=${formatClickBoundarySummary(details.clickBoundary)}`,
    ].join('\n');
  }).join('\n');
}
