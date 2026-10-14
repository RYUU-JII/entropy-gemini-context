import { runtimeSendMessage } from '../../../platform/chrome/ChromeService.js';
import { requireDashboardProfileGeneration } from '../bootstrap/dashboardProfileGenerationOwner.js';

// Every Dashboard progression query/command stays bound to its admitted page.
// A worker reset/import cannot turn an outstanding request into a new lease.
export function assertDashboardProgressionGeneration(profileGeneration) {
  let observedGeneration;
  try {
    observedGeneration = requireDashboardProfileGeneration();
  } catch (cause) {
    throw new Error('PROGRESSION_PROFILE_GENERATION_CHANGED_DURING_REQUEST', { cause });
  }
  if (observedGeneration !== profileGeneration) {
    throw new Error('PROGRESSION_PROFILE_GENERATION_CHANGED_DURING_REQUEST');
  }
}

export async function requestDashboardProgression(action, {
  payload = {},
  failureCode = 'PROGRESSION_REQUEST_FAILED',
} = {}) {
  const profileGeneration = requireDashboardProfileGeneration();
  const response = await runtimeSendMessage({ action, ...payload, profileGeneration });
  assertDashboardProgressionGeneration(profileGeneration);
  if (response?.profileGeneration !== profileGeneration) {
    throw new Error('PROGRESSION_PROFILE_GENERATION_RESPONSE_MISMATCH');
  }
  if (response?.success !== true) {
    throw new Error(typeof response?.error === 'string' && response.error.trim()
      ? response.error.trim() : failureCode);
  }
  return response;
}
