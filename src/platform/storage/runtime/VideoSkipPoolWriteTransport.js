import { MESSAGE_ACTIONS } from '../../messaging/messageTypes.js';
import { runtimeSendMessageReliable } from '../../messaging/runtime/runtimeMessaging.js';
import { normalizeVideoSkipPoolSnapshot } from './videoSkipPoolContract.js';

const VIDEO_SKIP_POOL_WRITE_TIMEOUT_MS = 2000;

export class VideoSkipPoolWriteTransport {
  static getInstance() {
    if (!VideoSkipPoolWriteTransport.instance) {
      VideoSkipPoolWriteTransport.instance = new VideoSkipPoolWriteTransport();
    }
    return VideoSkipPoolWriteTransport.instance;
  }

  async merge(snapshot) {
    const result = await runtimeSendMessageReliable({
      action: MESSAGE_ACTIONS.MERGE_VIDEO_SKIP_POOL,
      snapshot: normalizeVideoSkipPoolSnapshot(snapshot),
    }, {
      timeoutMs: VIDEO_SKIP_POOL_WRITE_TIMEOUT_MS,
    });

    if (!result.ok) {
      throw new Error(`VIDEO_SKIP_POOL_WRITE_TRANSPORT_FAILED:${result.error || 'UNKNOWN'}`);
    }
    if (result.response?.success !== true) {
      throw new Error(result.response?.error || 'VIDEO_SKIP_POOL_WRITE_REJECTED');
    }
    return normalizeVideoSkipPoolSnapshot(result.response.snapshot);
  }
}

export default VideoSkipPoolWriteTransport;
