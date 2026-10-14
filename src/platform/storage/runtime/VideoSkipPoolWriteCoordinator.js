import VideoSkipPoolStore from '../internal/chrome-storage/stores/VideoSkipPoolStore.js';
import { mergeVideoSkipPoolSnapshots } from './videoSkipPoolContract.js';

export class VideoSkipPoolWriteCoordinator {
  constructor({ poolStore = VideoSkipPoolStore.getInstance() } = {}) {
    if (!poolStore || typeof poolStore.get !== 'function' || typeof poolStore.set !== 'function') {
      throw new Error('VIDEO_SKIP_POOL_WRITE_COORDINATOR_STORE_REQUIRED');
    }
    this.poolStore = poolStore;
    this._mergeChain = Promise.resolve();
  }

  static getInstance() {
    if (!VideoSkipPoolWriteCoordinator.instance) {
      VideoSkipPoolWriteCoordinator.instance = new VideoSkipPoolWriteCoordinator();
    }
    return VideoSkipPoolWriteCoordinator.instance;
  }

  merge(candidateSnapshot) {
    const mergePromise = this._mergeChain.then(async () => {
      const currentSnapshot = await this.poolStore.get();
      const result = mergeVideoSkipPoolSnapshots(currentSnapshot, candidateSnapshot);
      if (result.changed) {
        await this.poolStore.set(result.snapshot);
      }
      return result.snapshot;
    });
    this._mergeChain = mergePromise.catch(() => undefined);
    return mergePromise;
  }
}

export default VideoSkipPoolWriteCoordinator;
