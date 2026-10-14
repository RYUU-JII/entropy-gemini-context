import { createStatsTickRuntimeService } from '../../../../domains/stats/background/runtime/statsTickRuntimeService.js';

export function createBackgroundKernelTrackingStatsBindings({
  tabTimeTracker,
  statsRuntimeService,
} = {}) {
  const statsTickRuntimeService = createStatsTickRuntimeService({
    TabTimeTracker: tabTimeTracker,
    runStatsMutationBatch: statsRuntimeService.runStatsMutationBatch,
    runStatsRolloverMutationBatch: statsRuntimeService.runStatsRolloverMutationBatch,
  });

  return {
    statsTickRuntimeService,
  };
}
