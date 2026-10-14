import {
  BUILD_RELEASE_CAPABILITIES,
} from '../../../platform/build/releaseCapabilities.js';

const CONTENT_BEHAVIOR_CAPABILITIES = Object.freeze({
  protectionSignalsEnabled: true,
  contentFlowSignalsEnabled: BUILD_RELEASE_CAPABILITIES.enableContentFlowSignals === true,
  clseReporterEnabled: BUILD_RELEASE_CAPABILITIES.enableContentClseReporter === true,
  clseAlertOverlayEnabled: BUILD_RELEASE_CAPABILITIES.enableContentClseAlertOverlay === true,
});

export function getContentBehaviorCapabilities() {
  return CONTENT_BEHAVIOR_CAPABILITIES;
}

export function areContentBehaviorSignalsEnabled() {
  return CONTENT_BEHAVIOR_CAPABILITIES.protectionSignalsEnabled === true;
}

export function areContentFlowSignalsEnabled() {
  return CONTENT_BEHAVIOR_CAPABILITIES.contentFlowSignalsEnabled === true;
}

export function isContentClseReporterEnabled() {
  return CONTENT_BEHAVIOR_CAPABILITIES.clseReporterEnabled === true;
}

export function isContentClseAlertOverlayEnabled() {
  return CONTENT_BEHAVIOR_CAPABILITIES.clseAlertOverlayEnabled === true;
}
