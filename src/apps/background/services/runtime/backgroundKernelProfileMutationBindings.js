import { createProfileMutationCoordinator } from './support/ProfileMutationCoordinator.js';
import { createProfileMutationRuntimeGate } from './support/ProfileMutationRuntimeGate.js';

const bindMutationOwner = (owner, method = 'quiesceForProfileMutation') => (
  owner?.[method]?.bind(owner)
);

export function createBackgroundKernelProfileMutationRuntimeGate({
  profileResetLifecycleRepository,
} = {}) {
  return createProfileMutationRuntimeGate({
    readLifecycle: profileResetLifecycleRepository?.read?.bind(
      profileResetLifecycleRepository,
    ),
  });
}

export function createBackgroundKernelProfileMutationCoordinator({
  profileResetLifecycleRepository,
  progressionService,
  settingsService,
  settingsPropagationCoordinator,
  quiesceTrackingTickRunnerForProfileMutation,
  nudgeWindowBlurController,
  nudgeTerminalEffectCoordinator,
  quiesceCLSEForProfileMutation,
  tabTimeTracker,
  statsRuntimeService,
  cycleStateManager,
  eventLogRepository,
  zenModelRepository,
  zenPairwiseGpService,
  workerRuntimeEventCapability,
  runtimeAdmissionGate,
  getRuntimeReadinessPromise,
} = {}) {
  return createProfileMutationCoordinator({
    lifecycleRepository: profileResetLifecycleRepository,
    runtimeAdmissionGate,
    getRuntimeReadinessPromise,
    participants: [
      { name: 'tracking_tick_runner', quiesceForProfileMutation: quiesceTrackingTickRunnerForProfileMutation },
      { name: 'nudge_window_blur', quiesceForProfileMutation: bindMutationOwner(nudgeWindowBlurController) },
      { name: 'nudge_terminal_effects', quiesceForProfileMutation: bindMutationOwner(nudgeTerminalEffectCoordinator) },
      { name: 'cycle_state', quiesceForProfileMutation: bindMutationOwner(cycleStateManager) },
      { name: 'settings', quiesceForProfileMutation: bindMutationOwner(settingsService) },
      { name: 'settings_propagation', quiesceForProfileMutation: bindMutationOwner(settingsPropagationCoordinator) },
      { name: 'clse_runtime', quiesceForProfileMutation: quiesceCLSEForProfileMutation },
      { name: 'tab_time_tracker', quiesceForProfileMutation: bindMutationOwner(tabTimeTracker) },
      { name: 'stats_runtime', quiesceForProfileMutation: bindMutationOwner(statsRuntimeService) },
      { name: 'progression', quiesceForProfileMutation: bindMutationOwner(progressionService) },
      { name: 'event_log', quiesceForProfileMutation: bindMutationOwner(eventLogRepository) },
      { name: 'zen_pairwise_gp', quiesceForProfileMutation: bindMutationOwner(zenPairwiseGpService) },
      { name: 'zen_model_repository', quiesceForProfileMutation: bindMutationOwner(zenModelRepository, 'closeForProfileMutation') },
      { name: 'worker_runtime_events', quiesceForProfileMutation: bindMutationOwner(workerRuntimeEventCapability) },
    ],
  });
}

export default createBackgroundKernelProfileMutationCoordinator;
