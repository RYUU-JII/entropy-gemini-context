import { createTrackingContentRuntimeHandlers } from '../../../../../domains/tracking/background/trackingContentRuntimeHandlers.js';
import { createTrackingSpecialRuntimeHandlers } from '../../../../../domains/tracking/background/trackingSpecialRuntimeHandlers.js';
import { createTrackingFrameMediaHandlers } from '../../../../../domains/tracking/background/trackingFrameMediaHandlers.js';

export function createTrackingRuntimeMessageRoutes({
  trackingRuntime,
} = {}) {
  return {
    types: {
      ...createTrackingSpecialRuntimeHandlers(trackingRuntime),
      ...createTrackingContentRuntimeHandlers(trackingRuntime),
      ...createTrackingFrameMediaHandlers(trackingRuntime),
    },
  };
}
