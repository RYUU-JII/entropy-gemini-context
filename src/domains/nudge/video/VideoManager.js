import VideoSkipManager from '../video-skip/index.js';
import ShortFormBlockManager from '../short-form/index.js';
import { videoElementObserver } from './VideoElementObserver.js';

async function settleVideoActivation(applyResult, remove, isCurrent) {
  try {
    await applyResult;
    await videoElementObserver.whenSettled();
  } catch (error) {
    if (!isCurrent()) throw error;
    try {
      await remove();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'VIDEO_MANAGER_ACTIVATION_ROLLBACK_FAILED');
    }
    throw error;
  }
}

function createVideoManagerCleanupError(errors) {
  const AggregateErrorCtor = globalThis?.AggregateError;
  if (typeof AggregateErrorCtor === 'function') {
    return new AggregateErrorCtor(errors, 'VIDEO_MANAGER_REMOVE_FAILED');
  }
  const error = new Error('VIDEO_MANAGER_REMOVE_FAILED');
  error.errors = errors;
  if (errors[0]) error.cause = errors[0];
  return error;
}

class VideoManager {
  constructor() {
    this._videoSkipEpoch = 0;
    this._shortFormEpoch = 0;
  }

  setVideoSkipEnabled(nextEnabled, nextSettings = null) {
    const epoch = ++this._videoSkipEpoch;
    if (nextEnabled) {
      return settleVideoActivation(
        VideoSkipManager.apply(nextSettings), () => VideoSkipManager.remove(),
        () => this._videoSkipEpoch === epoch,
      );
    }
    return VideoSkipManager.remove();
  }

  getVideoSkipRuntimeSnapshot() {
    return VideoSkipManager.getRuntimeSnapshot();
  }

  setShortFormBlockEnabled(nextEnabled) {
    const epoch = ++this._shortFormEpoch;
    if (nextEnabled) {
      return settleVideoActivation(
        ShortFormBlockManager.apply(), () => ShortFormBlockManager.remove(),
        () => this._shortFormEpoch === epoch,
      );
    }
    return ShortFormBlockManager.remove();
  }

  remove() {
    this._videoSkipEpoch += 1;
    this._shortFormEpoch += 1;
    const errors = [];
    try {
      VideoSkipManager.remove();
    } catch (error) {
      errors.push(error);
    }
    try {
      ShortFormBlockManager.remove();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length > 0) throw createVideoManagerCleanupError(errors);
  }
}

export default VideoManager;
