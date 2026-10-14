import {
  getQaTarget,
} from '../qa/catalog/qaTargetRegistry.mjs';
import {
  QA_MODES,
} from '../qa/contracts/qaTargetContract.mjs';

export const FEED_HORIZON_QA_MODES = QA_MODES;

const LEGACY_TARGET_TO_QA_TARGET = Object.freeze({
  'tiktok-feed': 'feed/tiktok',
  'youtube-shorts': 'feed/youtube-shorts',
  'instagram-reels': 'feed/instagram-reels',
  'x-home': 'feed/x-home',
  'instagram-home': 'feed/instagram-home',
  'facebook-home': 'feed/facebook-home',
  'youtube-home': 'feed/youtube-home',
});

export function resolveFeedHorizonQaMode(value) {
  const mode = String(value || '').trim();
  if (!Object.values(FEED_HORIZON_QA_MODES).includes(mode)) {
    throw new Error(`FEED_HORIZON_QA_MODE_UNSUPPORTED:${mode || 'missing'}`);
  }
  return mode;
}

export function resolveFeedHorizonQaPreset(value) {
  const target = String(value || '').trim();
  const qaTargetId = LEGACY_TARGET_TO_QA_TARGET[target];
  if (!qaTargetId) {
    throw new Error(`FEED_HORIZON_QA_TARGET_UNSUPPORTED:${target || 'missing'}`);
  }
  const qaTarget = getQaTarget(qaTargetId);
  return Object.freeze({
    target,
    qaTargetId,
    siteId: qaTarget.protocolOptions.siteId,
    surfaceMode: qaTarget.protocolOptions.surfaceMode,
  });
}

export function listFeedHorizonQaTargets() {
  return Object.keys(LEGACY_TARGET_TO_QA_TARGET);
}
