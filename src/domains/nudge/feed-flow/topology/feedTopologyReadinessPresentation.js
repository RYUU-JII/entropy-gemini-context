import {
  FEED_TOPOLOGY_AUTHORITY_STATES,
  FEED_TOPOLOGY_AUTHORITY_VERSION,
  isFeedTopologyActuationAuthorized,
} from '../../../protection/contracts/feedTopologyAuthorityContract.js';

export const FEED_TOPOLOGY_READINESS_PRESENTATION_CONTRACT =
  'feed-topology-readiness-presentation-v1';

const COPY = Object.freeze({
  ko: Object.freeze({
    unavailable: '피드 대기',
    learning: '학습 중',
    ready: '학습 완료 · 작동 가능',
    drift: '구조 변동 · 관찰 중',
    observeOnly: '관찰 전용',
  }),
  en: Object.freeze({
    unavailable: 'Feed pending',
    learning: 'Learning',
    ready: 'Learned · ready',
    drift: 'Structure changed · observing',
    observeOnly: 'Observe only',
  }),
});

function resolveLocale(value) {
  return typeof value === 'string' && value.toLowerCase().startsWith('en')
    ? 'en'
    : 'ko';
}

/**
 * Pure consumer projection for the canonical topology authority snapshot.
 *
 * This seam never queries a detector or DOM. UI owners can render the result
 * without creating a second readiness source of truth.
 */
export function presentFeedTopologyReadiness(
  readiness = null,
  { locale = 'ko' } = {},
) {
  const copy = COPY[resolveLocale(locale)];
  let state = 'unavailable';
  let tone = 'neutral';
  let label = copy.unavailable;

  if (
    readiness
    && readiness.contractVersion === FEED_TOPOLOGY_AUTHORITY_VERSION
  ) {
    if (isFeedTopologyActuationAuthorized(readiness)) {
      state = 'ready';
      tone = 'ready';
      label = copy.ready;
    } else if (
      readiness.topologyState === FEED_TOPOLOGY_AUTHORITY_STATES.DRIFT_SUSPECTED
      || readiness.topologyState === FEED_TOPOLOGY_AUTHORITY_STATES.QUARANTINED
    ) {
      state = 'drift';
      tone = 'warning';
      label = copy.drift;
    } else if (
      readiness.topologyState === FEED_TOPOLOGY_AUTHORITY_STATES.UNSUPPORTED
    ) {
      state = 'observe_only';
      tone = 'neutral';
      label = copy.observeOnly;
    } else {
      state = 'learning';
      tone = 'learning';
      label = copy.learning;
    }
  }

  return Object.freeze({
    contract: FEED_TOPOLOGY_READINESS_PRESENTATION_CONTRACT,
    state,
    tone,
    label,
    ariaLabel: label,
  });
}

export default presentFeedTopologyReadiness;
