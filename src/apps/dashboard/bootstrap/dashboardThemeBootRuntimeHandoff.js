const HANDOFF_PHASE = Object.freeze({
  IDLE: 'idle',
  PREPARING: 'preparing',
  RESERVED: 'reserved',
  ADOPTED: 'adopted',
  RELEASED: 'released',
  NOT_DECLARED: 'not_declared',
  FAILED: 'failed',
});

const requireReason = (value) => {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    throw new Error('DASHBOARD_THEME_BOOT_RUNTIME_RELEASE_REASON_REQUIRED');
  }
  return value;
};

const requirePreparedRuntime = (runtime, expectedThemeId) => {
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) {
    throw new Error('DASHBOARD_THEME_BOOT_RUNTIME_HANDOFF_RESULT_REQUIRED');
  }
  if (runtime.themeId !== expectedThemeId) {
    throw new Error('DASHBOARD_THEME_BOOT_RUNTIME_HANDOFF_THEME_MISMATCH');
  }
  if (runtime.status === HANDOFF_PHASE.NOT_DECLARED) {
    if (
      runtime.reservationId !== null
      || runtime.reservationState !== null
      || runtime.release !== null
    ) {
      throw new Error('DASHBOARD_THEME_BOOT_RUNTIME_NOT_DECLARED_INVALID');
    }
    return runtime;
  }
  if (
    runtime.status !== 'started'
    || typeof runtime.reservationId !== 'string'
    || !runtime.reservationId
    || typeof runtime.release !== 'function'
    || runtime.reservationState !== 'active'
  ) {
    throw new Error('DASHBOARD_THEME_BOOT_RUNTIME_HANDOFF_RESULT_INVALID');
  }
  return runtime;
};

export function createDashboardThemeBootRuntimeHandoffOwner() {
  let phase = HANDOFF_PHASE.IDLE;
  let themeId = null;
  let preparationPromise = null;
  let preparedRuntime = null;
  let releasePromise = null;
  let releaseRequestedReason = null;
  let terminalError = null;

  const resolvePhase = () => {
    if (
      phase === HANDOFF_PHASE.RESERVED
      && preparedRuntime?.reservationState === HANDOFF_PHASE.ADOPTED
    ) {
      return HANDOFF_PHASE.ADOPTED;
    }
    return phase;
  };

  const releasePreparedRuntime = (reason) => {
    if (preparedRuntime?.status !== 'started') return false;
    const released = preparedRuntime.release(reason);
    if (released === true) {
      phase = HANDOFF_PHASE.RELEASED;
      return true;
    }
    if (preparedRuntime.reservationState === HANDOFF_PHASE.ADOPTED) {
      phase = HANDOFF_PHASE.ADOPTED;
    }
    return false;
  };

  const start = ({
    bootThemeId,
    loadRuntime,
  } = {}) => {
    if (preparationPromise) {
      if (themeId !== bootThemeId) {
        throw new Error(
          `DASHBOARD_THEME_BOOT_RUNTIME_HANDOFF_THEME_CONFLICT`
          + `:expected=${String(themeId)}:actual=${String(bootThemeId)}`,
        );
      }
      return preparationPromise;
    }
    if (typeof bootThemeId !== 'string' || !bootThemeId) {
      throw new Error('DASHBOARD_THEME_BOOT_RUNTIME_HANDOFF_THEME_REQUIRED');
    }
    if (typeof loadRuntime !== 'function') {
      throw new Error('DASHBOARD_THEME_BOOT_RUNTIME_HANDOFF_LOADER_REQUIRED');
    }
    if (releaseRequestedReason !== null) {
      phase = HANDOFF_PHASE.RELEASED;
      themeId = bootThemeId;
      terminalError = new Error('DASHBOARD_THEME_BOOT_RUNTIME_HANDOFF_RELEASED_BEFORE_START');
      terminalError.code = 'DASHBOARD_THEME_BOOT_RUNTIME_HANDOFF_RELEASED_BEFORE_START';
      preparationPromise = Promise.reject(terminalError);
      return preparationPromise;
    }

    phase = HANDOFF_PHASE.PREPARING;
    themeId = bootThemeId;
    preparationPromise = Promise.resolve()
      .then(loadRuntime)
      .then((runtimeModule) => {
        if (typeof runtimeModule?.prepareDashboardThemeBootRuntime !== 'function') {
          throw new Error('DASHBOARD_THEME_BOOT_RUNTIME_PREPARE_OWNER_MISSING');
        }
        return runtimeModule.prepareDashboardThemeBootRuntime(bootThemeId);
      })
      .then((runtime) => {
        preparedRuntime = requirePreparedRuntime(runtime, bootThemeId);
        phase = runtime.status === HANDOFF_PHASE.NOT_DECLARED
          ? HANDOFF_PHASE.NOT_DECLARED
          : HANDOFF_PHASE.RESERVED;
        return runtime;
      })
      .catch((error) => {
        phase = HANDOFF_PHASE.FAILED;
        terminalError = error instanceof Error ? error : new Error(String(error));
        throw terminalError;
      });
    return preparationPromise;
  };

  const release = (reasonInput) => {
    const reason = requireReason(reasonInput);
    if (releasePromise) return releasePromise;
    releaseRequestedReason = reason;
    if (!preparationPromise) return Promise.resolve(false);
    releasePromise = preparationPromise.then(
      () => releasePreparedRuntime(reason),
      () => false,
    );
    return releasePromise;
  };

  return Object.freeze({
    start,
    release,
    getSnapshot: () => Object.freeze({
      phase: resolvePhase(),
      themeId,
      reservationId: preparedRuntime?.reservationId || null,
      reservationState: preparedRuntime?.reservationState || null,
      releaseRequestedReason,
      terminalFailure: terminalError?.message || null,
    }),
  });
}

const dashboardThemeBootRuntimeHandoffOwner = (
  createDashboardThemeBootRuntimeHandoffOwner()
);

export const startDashboardThemeBootRuntimeHandoff = (options) => (
  dashboardThemeBootRuntimeHandoffOwner.start(options)
);

export const releaseDashboardThemeBootRuntimeHandoff = (reason) => (
  dashboardThemeBootRuntimeHandoffOwner.release(reason)
);

export const getDashboardThemeBootRuntimeHandoffSnapshot = () => (
  dashboardThemeBootRuntimeHandoffOwner.getSnapshot()
);
