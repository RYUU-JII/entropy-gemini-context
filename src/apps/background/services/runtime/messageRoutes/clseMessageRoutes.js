import { createCLSEMessageHandler } from '../../../../../domains/tracking/background/CLSEMessageHandler.js';

const CLSE_MESSAGE_TYPES = Object.freeze({
  CLSE_GET_STATUS: 'CLSE_GET_STATUS',
  CLSE_SET_ENABLED: 'CLSE_SET_ENABLED',
  CLSE_SET_SENSITIVITY: 'CLSE_SET_SENSITIVITY',
  CLSE_SET_ALERT_COOLDOWN: 'CLSE_SET_ALERT_COOLDOWN',
  CLSE_GET_BUCKETS: 'CLSE_GET_BUCKETS',
  CLSE_RESET_BASELINE: 'CLSE_RESET_BASELINE',
  CLSE_GET_AGGRESSION_LOGS: 'CLSE_GET_AGGRESSION_LOGS',
});

export function createClseMessageRoutes({
  bootPrewarmService,
  applyCLSESettingsPatch,
  clseRepository,
} = {}) {
  if (!bootPrewarmService || typeof bootPrewarmService.invalidate !== 'function') {
    throw new Error('CLSE_MESSAGE_ROUTE_BOOT_PREWARM_OWNER_REQUIRED');
  }
  if (typeof applyCLSESettingsPatch !== 'function') {
    throw new Error('CLSE_MESSAGE_ROUTE_SETTINGS_PIPELINE_OWNER_REQUIRED');
  }
  const handleCLSEMessage = createCLSEMessageHandler({
    applyCLSESettingsPatch,
    clseRepository,
  });

  const types = Object.create(null);
  Object.values(CLSE_MESSAGE_TYPES).forEach((type) => {
    types[type] = (message, sender, sendResponse) => {
      bootPrewarmService.invalidate(`clse:${type}`);
      void Promise.resolve()
        .then(() => handleCLSEMessage(message, sender, sendResponse))
        .catch((error) => {
          sendResponse?.({
            success: false,
            error: error?.message || 'CLSE_MESSAGE_HANDLER_LOAD_FAILED',
          });
        });
      return true;
    };
  });

  return { types };
}
