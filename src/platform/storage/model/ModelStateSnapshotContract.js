import {
  ZEN_THEME_MODEL_STATE_KEYS,
  isZenThemeModelStateDiscardableCacheKey,
  isZenThemeModelStateSnapshotIncluded,
  requireZenThemeModelStateSnapshotValue,
} from '../themes/zen/ZenThemeModelStateContract.js';
import {
  FEED_TEMPO_PROFILE_CHECKPOINT_KEY,
  isFeedTempoProfileCheckpointKey,
  rebaseFeedTempoProfileCheckpoint,
  requireFeedTempoProfileCheckpoint,
} from './FeedTempoProfileCheckpointContract.js';
import {
  FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_KEY,
  isFeedTopologyCertificateCheckpointKey,
  rebaseFeedTopologyCertificateCheckpoint,
  requireFeedTopologyCertificateCheckpoint,
} from './FeedTopologyCertificateCheckpointContract.js';
import { CONSUMPTION_MEMORY_CHECKPOINT_KEY, requireConsumptionMemoryCheckpoint,
  rebaseConsumptionMemoryCheckpoint } from './ConsumptionMemoryCheckpointContract.js';

export function isModelStateDiscardableCacheKey(key) {
  if (key === CONSUMPTION_MEMORY_CHECKPOINT_KEY) return false;
  if (isFeedTempoProfileCheckpointKey(key)) return false;
  if (isFeedTopologyCertificateCheckpointKey(key)) return false;
  return isZenThemeModelStateDiscardableCacheKey(key);
}

export function isModelStateSnapshotIncluded(key) {
  if (key === CONSUMPTION_MEMORY_CHECKPOINT_KEY) return true;
  if (isFeedTempoProfileCheckpointKey(key)) return true;
  if (isFeedTopologyCertificateCheckpointKey(key)) return true;
  return isZenThemeModelStateSnapshotIncluded(key);
}

export function requireModelStateSnapshotValue(key, value) {
  if (key === CONSUMPTION_MEMORY_CHECKPOINT_KEY) return requireConsumptionMemoryCheckpoint(value);
  if (isFeedTempoProfileCheckpointKey(key)) {
    return requireFeedTempoProfileCheckpoint(value);
  }
  if (isFeedTopologyCertificateCheckpointKey(key)) {
    return requireFeedTopologyCertificateCheckpoint(value);
  }
  return requireZenThemeModelStateSnapshotValue(key, value);
}

export function readModelStateSnapshotProfileEpoch(key, value) {
  const normalized = requireModelStateSnapshotValue(key, value);
  if (
    key === CONSUMPTION_MEMORY_CHECKPOINT_KEY
    || key === FEED_TEMPO_PROFILE_CHECKPOINT_KEY
    || key === FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_KEY
    || key === ZEN_THEME_MODEL_STATE_KEYS.BONSAI_PROFILE_AGGREGATE
  ) {
    return normalized.profileEpoch;
  }
  return null;
}

export function rebaseModelStateSnapshotValue(key, value, targetProfileEpoch) {
  if (key === CONSUMPTION_MEMORY_CHECKPOINT_KEY) return rebaseConsumptionMemoryCheckpoint(value, targetProfileEpoch);
  if (key === FEED_TEMPO_PROFILE_CHECKPOINT_KEY) {
    return rebaseFeedTempoProfileCheckpoint(value, targetProfileEpoch);
  }
  if (key === FEED_TOPOLOGY_CERTIFICATE_CHECKPOINT_KEY) {
    return rebaseFeedTopologyCertificateCheckpoint(value, targetProfileEpoch);
  }
  if (key === ZEN_THEME_MODEL_STATE_KEYS.BONSAI_PROFILE_AGGREGATE) {
    return requireZenThemeModelStateSnapshotValue(key, {
      ...value,
      profileEpoch: targetProfileEpoch,
    });
  }
  requireModelStateSnapshotValue(key, value);
  return value;
}
