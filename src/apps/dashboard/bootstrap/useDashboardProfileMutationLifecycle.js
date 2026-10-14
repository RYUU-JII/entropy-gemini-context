import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import ProfileResetLifecycleRepository, {
  isProfileResetWriteAdmissionClosed,
  resolveProfileResetGeneration,
} from '../../../platform/storage/runtime/ProfileResetLifecycleRepository.js';
import {
  acquireDashboardProfileGeneration,
  releaseDashboardProfileGeneration,
} from './dashboardProfileGenerationOwner.js';
import {
  bindSettingsCommandBusToProfileGeneration,
  quiesceSettingsCommandBusForProfileMutation,
} from '../stores/settingsCommandBus.js';
import {
  requestDashboardProfileGenerationReadiness,
} from './dashboardProfileGenerationReadinessClient.js';
import ZenModelRepository from '../../../platform/storage/themes/zen/ZenModelRepository.js';
import {
  resolveProfileCompatibilityRecovery,
} from '../../../platform/storage/model/ProfileCompatibilityContract.js';
import { emitZenTrace } from '@zen-trace';
import { resolveSettingsProfileRecovery } from '../../../platform/storage/settings/SettingsProfileRecoveryContract.js';

const DASHBOARD_PROFILE_MUTATION_GATE_STATUS = Object.freeze({
  PENDING: 'pending',
  VAULT_REQUIRED: 'vault_required',
  ADMITTED: 'admitted',
  BLOCKED: 'blocked',
  RECOVERY_REQUIRED: 'recovery_required',
});

const INITIAL_GATE_STATE = Object.freeze({
  status: DASHBOARD_PROFILE_MUTATION_GATE_STATUS.PENDING,
  lifecycle: null,
});

const DASHBOARD_PROFILE_GENERATION_FENCE_ERROR_CODES = new Set([
  'PROFILE_MUTATION_RUNTIME_ADMISSION_CLOSED',
  'PROFILE_MUTATION_RUNTIME_ADMISSION_GENERATION_CHANGED',
  'PROFILE_RESET_WRITE_ADMISSION_CLOSED',
  'PROFILE_RESET_GENERATION_STALE',
]);

function resolveDashboardProfileGenerationErrorCode(error) {
  const code = error?.code || error?.message;
  return typeof code === 'string' && code.trim() ? code.trim() : null;
}

function isDashboardProfileGenerationFenceError(error) {
  return DASHBOARD_PROFILE_GENERATION_FENCE_ERROR_CODES.has(
    resolveDashboardProfileGenerationErrorCode(error),
  );
}

function createDashboardProfileMutationError(code, lifecycle = null, cause = null) {
  const error = new Error(code);
  error.code = code;
  error.lifecycle = lifecycle;
  if (cause) error.cause = cause;
  return error;
}

export function useDashboardProfileMutationLifecycle({
  generationReadinessEnabled = true,
  vaultAdmissionError = null,
} = {}) {
  const [fatalError, setFatalError] = useState(null);
  const [gateState, setGateState] = useState(INITIAL_GATE_STATE);
  const readinessEnabled = useRef(generationReadinessEnabled);
  const vaultFailure = useRef(vaultAdmissionError);
  const reconcileAdmission = useRef(null);
  useLayoutEffect(() => {
    readinessEnabled.current = generationReadinessEnabled;
    vaultFailure.current = vaultAdmissionError;
    reconcileAdmission.current?.();
  }, [generationReadinessEnabled, vaultAdmissionError]);

  useEffect(() => {
    const repository = ProfileResetLifecycleRepository.getInstance();
    let active = true;
    let captured = false;
    let capturedGeneration = null;
    let capturedLifecycleWasClosed = false;
    let pendingLifecycleEvent = null;
    let requiresRuntimeHandoff = false;
    let requiresExplicitRecovery = false;
    let activeGenerationLease = null;
    let admissionAttemptRevision = 0;
    let pendingAdmissionGeneration = null;
    let unsubscribe = null;

    const invalidatePendingAdmission = () => {
      admissionAttemptRevision += 1;
      pendingAdmissionGeneration = null;
    };

    const releaseGenerationLease = () => {
      if (activeGenerationLease === null) return null;
      const generationLease = activeGenerationLease;
      activeGenerationLease = null;
      let primaryCause = null;
      let secondaryCause = null;
      try {
        ZenModelRepository.getInstance().closeForProfileMutation();
      } catch (error) {
        primaryCause = error;
      }
      try {
        releaseDashboardProfileGeneration(generationLease);
      } catch (error) {
        if (primaryCause === null) primaryCause = error;
        else secondaryCause = error;
      }
      if (primaryCause !== null) {
        const cleanupError = createDashboardProfileMutationError(
          'DASHBOARD_PROFILE_GENERATION_LEASE_RELEASE_FAILED',
          null,
          primaryCause,
        );
        if (secondaryCause !== null) cleanupError.secondaryCause = secondaryCause;
        emitZenTrace('dashboard_page:profile_generation_release_failed', {
          profileGeneration: generationLease.profileGeneration,
          errorCode: cleanupError.code,
        });
        console.error('[DashboardProfileMutation] Generation lease release failed:', cleanupError);
        return cleanupError;
      }
      return null;
    };

    const quiesceSettingsCommandBus = () => {
      try {
        quiesceSettingsCommandBusForProfileMutation();
      } catch (cause) {
        const error = createDashboardProfileMutationError(
          'DASHBOARD_SETTINGS_COMMAND_BUS_QUIESCE_FAILED',
          null,
          cause,
        );
        emitZenTrace('dashboard_page:settings_command_bus_quiesce_failed', {
          profileGeneration: capturedGeneration,
          errorCode: error.code,
          causeCode: resolveDashboardProfileGenerationErrorCode(cause),
        });
        console.error('[DashboardProfileMutation] Settings command bus quiesce failed:', error);
        setFatalError(error);
      }
    };

    const blockForClosedLifecycle = ({
      lifecycle,
      profileGeneration,
      forceRuntimeHandoff = false,
    }) => {
      requiresRuntimeHandoff ||= forceRuntimeHandoff || activeGenerationLease !== null;
      quiesceSettingsCommandBus();
      releaseGenerationLease();
      capturedGeneration = profileGeneration;
      capturedLifecycleWasClosed = true;
      setGateState(Object.freeze({
        status: DASHBOARD_PROFILE_MUTATION_GATE_STATUS.BLOCKED,
        lifecycle,
      }));
      emitZenTrace('dashboard_page:profile_mutation_admission_closed', {
        profileGeneration,
        status: lifecycle?.status || null,
        operation: lifecycle?.operation || null,
        failureCode: lifecycle?.failureCode || null,
      });
    };

    const blockForRuntimeHandoff = ({
      lifecycle,
      profileGeneration,
      reason,
    }) => {
      requiresRuntimeHandoff = true;
      quiesceSettingsCommandBus();
      releaseGenerationLease();
      capturedGeneration = profileGeneration;
      capturedLifecycleWasClosed = false;
      setGateState(Object.freeze({
        status: DASHBOARD_PROFILE_MUTATION_GATE_STATUS.BLOCKED,
        lifecycle,
      }));
      emitZenTrace('dashboard_page:profile_generation_handoff_wait', {
        profileGeneration,
        status: lifecycle?.status || null,
        operation: lifecycle?.operation || null,
        reason,
      });
    };

    const failReadiness = (error) => {
      pendingAdmissionGeneration = null;
      if (error?.settingsProfileRecovery) {
        let settingsRecovery;
        try {
          settingsRecovery = resolveSettingsProfileRecovery(error);
          if (
            settingsRecovery === null
            ||
            error.profileCompatibilityRecovery
            || error.code !== settingsRecovery.failureCode
            || error.message !== settingsRecovery.failureCode
          ) throw new Error('SETTINGS_PROFILE_RECOVERY_ERROR_MISMATCH');
        } catch (cause) {
          setFatalError(createDashboardProfileMutationError('DASHBOARD_SETTINGS_PROFILE_RECOVERY_INVALID', null, cause));
          return;
        }
        releaseGenerationLease();
        requiresExplicitRecovery = true;
        setGateState(Object.freeze({
          status: DASHBOARD_PROFILE_MUTATION_GATE_STATUS.RECOVERY_REQUIRED,
          lifecycle: null,
          settingsRecovery,
        }));
        emitZenTrace('dashboard_page:settings_profile_recovery_required', {
          profileGeneration: capturedGeneration,
          failureCode: settingsRecovery.failureCode,
          documentKey: settingsRecovery.documentKey,
          key: settingsRecovery.key,
        });
        return;
      }
      if (error?.profileCompatibilityRecovery) {
        let recovery;
        try {
          recovery = resolveProfileCompatibilityRecovery(error);
          if (recovery === null) {
            throw new Error('DASHBOARD_PROFILE_COMPATIBILITY_RECOVERY_MISSING');
          }
        } catch (cause) {
          setFatalError(createDashboardProfileMutationError(
            'DASHBOARD_PROFILE_COMPATIBILITY_RECOVERY_INVALID',
            null,
            cause,
          ));
          return;
        }
        releaseGenerationLease();
        requiresExplicitRecovery = true;
        emitZenTrace('dashboard_page:profile_compatibility_recovery_required', {
          profileGeneration: capturedGeneration,
          failureCode: recovery.failureCode,
          reason: recovery.reason,
          expectedBaseline: recovery.expectedBaseline,
          observedBaseline: recovery.observedBaseline,
        });
        setGateState(Object.freeze({
          status: DASHBOARD_PROFILE_MUTATION_GATE_STATUS.RECOVERY_REQUIRED,
          lifecycle: null,
          recovery,
        }));
        return;
      }
      emitZenTrace('dashboard_page:profile_generation_readiness_failed', {
        profileGeneration: capturedGeneration,
        errorCode: resolveDashboardProfileGenerationErrorCode(error),
      });
      setFatalError(createDashboardProfileMutationError(
        'DASHBOARD_PROFILE_GENERATION_READINESS_FAILED',
        null,
        error,
      ));
    };

    const failReadinessFenceRecheck = ({ readinessError, recheckError }) => {
      pendingAdmissionGeneration = null;
      const error = createDashboardProfileMutationError(
        'DASHBOARD_PROFILE_GENERATION_FENCE_RECHECK_FAILED',
        null,
        recheckError,
      );
      error.readinessError = readinessError;
      emitZenTrace('dashboard_page:profile_generation_fence_recheck_failed', {
        profileGeneration: capturedGeneration,
        readinessErrorCode: resolveDashboardProfileGenerationErrorCode(readinessError),
        recheckErrorCode: resolveDashboardProfileGenerationErrorCode(recheckError),
      });
      setFatalError(error);
    };

    const isCurrentAdmissionAttempt = ({ attemptRevision, profileGeneration }) => (
      active
      && attemptRevision === admissionAttemptRevision
      && pendingAdmissionGeneration === profileGeneration
    );

    const reconcileReadinessFenceTransition = async ({
      readinessError,
      attemptRevision,
      profileGeneration,
      fromVaultAdmission = false,
    }) => {
      let lifecycle;
      try {
        lifecycle = await repository.read();
      } catch (recheckError) {
        if (!isCurrentAdmissionAttempt({ attemptRevision, profileGeneration })) return;
        failReadinessFenceRecheck({ readinessError, recheckError });
        return;
      }
      if (!isCurrentAdmissionAttempt({ attemptRevision, profileGeneration })) return;

      let observedProfileGeneration;
      let admissionClosed;
      try {
        observedProfileGeneration = resolveProfileResetGeneration(lifecycle);
        admissionClosed = isProfileResetWriteAdmissionClosed(lifecycle);
      } catch (recheckError) {
        failReadinessFenceRecheck({ readinessError, recheckError });
        return;
      }

      if (admissionClosed) {
        invalidatePendingAdmission();
        blockForClosedLifecycle({
          lifecycle,
          profileGeneration: observedProfileGeneration,
          forceRuntimeHandoff: true,
        });
        emitZenTrace('dashboard_page:profile_generation_fence_reconciled', {
          requestedProfileGeneration: profileGeneration,
          observedProfileGeneration,
          outcome: 'blocked',
        });
        return;
      }

      if (observedProfileGeneration !== profileGeneration) {
        if (fromVaultAdmission) {
          failReadiness(readinessError);
          return;
        }
        invalidatePendingAdmission();
        blockForRuntimeHandoff({
          lifecycle,
          profileGeneration: observedProfileGeneration,
          reason: 'readiness_fence_generation_changed',
        });
        return;
      }

      if (
        lifecycle?.status === 'complete'
        && resolveDashboardProfileGenerationErrorCode(readinessError) === 'PROFILE_MUTATION_RUNTIME_ADMISSION_CLOSED'
      ) {
        invalidatePendingAdmission();
        blockForRuntimeHandoff({
          lifecycle,
          profileGeneration,
          reason: 'completed_generation_runtime_admission_closed',
        });
        return;
      }

      failReadiness(readinessError);
    };

    const admitGeneration = (profileGeneration) => {
      if (requiresExplicitRecovery) return;
      const closedVaultAdmission = resolveDashboardProfileGenerationErrorCode(vaultFailure.current)
        === 'PROFILE_MUTATION_RUNTIME_ADMISSION_CLOSED';
      if (!readinessEnabled.current && !closedVaultAdmission) {
        setGateState(Object.freeze({
          status: DASHBOARD_PROFILE_MUTATION_GATE_STATUS.VAULT_REQUIRED,
          lifecycle: null,
        }));
        return;
      }
      if (pendingAdmissionGeneration === profileGeneration) return;
      const attemptRevision = admissionAttemptRevision + 1;
      admissionAttemptRevision = attemptRevision;
      pendingAdmissionGeneration = profileGeneration;
      setGateState(INITIAL_GATE_STATE);
      emitZenTrace('dashboard_page:profile_generation_readiness_start', {
        profileGeneration,
        attemptRevision,
      });
      // A sealed old worker rejects the vault status read before generation
      // readiness can run. Recheck the canonical lifecycle without admitting
      // key-dependent owners; only the existing handoff control may continue.
      if (closedVaultAdmission) {
        void reconcileReadinessFenceTransition({
          readinessError: vaultFailure.current,
          attemptRevision,
          profileGeneration,
          fromVaultAdmission: true,
        });
        return;
      }
      void requestDashboardProfileGenerationReadiness(profileGeneration)
        .then((readiness) => {
          if (
            !active
            || !readinessEnabled.current
            || attemptRevision !== admissionAttemptRevision
            || pendingAdmissionGeneration !== profileGeneration
            || readiness.profileGeneration !== profileGeneration
            || capturedGeneration !== profileGeneration
            || capturedLifecycleWasClosed
            || activeGenerationLease !== null
          ) {
            emitZenTrace('dashboard_page:profile_generation_readiness_ack_ignored', {
              profileGeneration,
              attemptRevision,
              currentAttemptRevision: admissionAttemptRevision,
              capturedGeneration,
              capturedLifecycleWasClosed,
              active: active === true,
            });
            return;
          }
          const lease = acquireDashboardProfileGeneration(profileGeneration);
          let zenBound = false;
          try {
            ZenModelRepository.getInstance().bindToProfileGeneration(profileGeneration);
            zenBound = true;
            bindSettingsCommandBusToProfileGeneration(profileGeneration);
            activeGenerationLease = lease;
          } catch (error) {
            const cleanupErrors = [];
            if (zenBound) {
              try {
                ZenModelRepository.getInstance().closeForProfileMutation();
              } catch (cleanupError) {
                cleanupErrors.push(cleanupError);
              }
            }
            try {
              releaseDashboardProfileGeneration(lease);
            } catch (cleanupError) {
              cleanupErrors.push(cleanupError);
            }
            if (cleanupErrors.length > 0 && error instanceof Error) {
              error.cleanupErrors = cleanupErrors;
            }
            throw error;
          }
          pendingAdmissionGeneration = null;
          emitZenTrace('dashboard_page:profile_generation_admitted', {
            profileGeneration,
            attemptRevision,
          });
          setGateState(Object.freeze({
            status: DASHBOARD_PROFILE_MUTATION_GATE_STATUS.ADMITTED,
            lifecycle: null,
          }));
        })
        .catch(async (error) => {
          if (!isCurrentAdmissionAttempt({ attemptRevision, profileGeneration })) return;
          if (isDashboardProfileGenerationFenceError(error)) {
            emitZenTrace('dashboard_page:profile_generation_fence_recheck_start', {
              profileGeneration,
              attemptRevision,
              errorCode: resolveDashboardProfileGenerationErrorCode(error),
            });
            await reconcileReadinessFenceTransition({
              readinessError: error,
              attemptRevision,
              profileGeneration,
            });
            return;
          }
          failReadiness(error);
        });
    };

    const handleLifecycle = (lifecycle, previousLifecycle) => {
      if (!active) return;
      if (!captured) {
        pendingLifecycleEvent = { lifecycle, previousLifecycle };
        return;
      }
      invalidatePendingAdmission();
      const nextGeneration = resolveProfileResetGeneration(lifecycle);
      const previousGeneration = resolveProfileResetGeneration(previousLifecycle);
      if (
        capturedLifecycleWasClosed !== true
        && (
          isProfileResetWriteAdmissionClosed(previousLifecycle)
          || previousGeneration !== capturedGeneration
        )
      ) {
        if (
          !isProfileResetWriteAdmissionClosed(lifecycle)
          && nextGeneration === capturedGeneration
        ) {
          emitZenTrace('dashboard_page:profile_generation_late_event_ignored', {
            profileGeneration: capturedGeneration,
            previousProfileGeneration: previousGeneration,
          });
          if (activeGenerationLease === null) admitGeneration(nextGeneration);
          return;
        }
        if (isProfileResetWriteAdmissionClosed(lifecycle)) {
          blockForClosedLifecycle({
            lifecycle,
            profileGeneration: nextGeneration,
            forceRuntimeHandoff: true,
          });
        } else {
          blockForRuntimeHandoff({
            lifecycle,
            profileGeneration: nextGeneration,
            reason: 'lifecycle_transition_delivered_after_capture',
          });
        }
        return;
      }
      if (isProfileResetWriteAdmissionClosed(lifecycle)) {
        blockForClosedLifecycle({
          lifecycle,
          profileGeneration: nextGeneration,
        });
        return;
      }
      if (requiresRuntimeHandoff || nextGeneration !== capturedGeneration) {
        blockForRuntimeHandoff({
          lifecycle,
          profileGeneration: nextGeneration,
          reason: requiresRuntimeHandoff
            ? 'closed_generation_completed'
            : 'profile_generation_changed',
        });
        return;
      }
      if (activeGenerationLease === null) admitGeneration(nextGeneration);
    };

    const handleLifecycleSafely = (lifecycle, previousLifecycle) => {
      try {
        handleLifecycle(lifecycle, previousLifecycle);
      } catch (error) {
        if (!active) return;
        releaseGenerationLease();
        setFatalError(createDashboardProfileMutationError(
          'DASHBOARD_PROFILE_MUTATION_LIFECYCLE_EVENT_FAILED',
          lifecycle,
          error,
        ));
      }
    };

    reconcileAdmission.current = () => {
      if (!active || !captured || capturedLifecycleWasClosed || requiresRuntimeHandoff || requiresExplicitRecovery) return;
      if (resolveDashboardProfileGenerationErrorCode(vaultFailure.current) === 'PROFILE_MUTATION_RUNTIME_ADMISSION_CLOSED') {
        invalidatePendingAdmission();
        releaseGenerationLease();
        admitGeneration(capturedGeneration);
        return;
      }
      if (!readinessEnabled.current) {
        invalidatePendingAdmission();
        releaseGenerationLease();
        setGateState(Object.freeze({
          status: DASHBOARD_PROFILE_MUTATION_GATE_STATUS.VAULT_REQUIRED,
          lifecycle: null,
        }));
      } else if (activeGenerationLease === null) {
        admitGeneration(capturedGeneration);
      }
    };

    try {
      unsubscribe = repository.subscribe(handleLifecycleSafely);
      void repository.read()
        .then((lifecycle) => {
          if (!active) return;
          capturedGeneration = resolveProfileResetGeneration(lifecycle);
          capturedLifecycleWasClosed = isProfileResetWriteAdmissionClosed(lifecycle);
          requiresRuntimeHandoff ||= capturedLifecycleWasClosed;
          captured = true;
          if (pendingLifecycleEvent !== null) {
            const event = pendingLifecycleEvent;
            pendingLifecycleEvent = null;
            handleLifecycleSafely(event.lifecycle, event.previousLifecycle);
            return;
          }
          if (isProfileResetWriteAdmissionClosed(lifecycle)) {
            requiresRuntimeHandoff = true;
            quiesceSettingsCommandBus();
            setGateState(Object.freeze({
              status: DASHBOARD_PROFILE_MUTATION_GATE_STATUS.BLOCKED,
              lifecycle,
            }));
            return;
          }
          admitGeneration(capturedGeneration);
        })
        .catch((error) => {
          if (!active) return;
          releaseGenerationLease();
          setFatalError(createDashboardProfileMutationError(
            'DASHBOARD_PROFILE_MUTATION_LIFECYCLE_READ_FAILED',
            null,
            error,
          ));
        });
    } catch (error) {
      setFatalError(createDashboardProfileMutationError(
        'DASHBOARD_PROFILE_MUTATION_LIFECYCLE_SUBSCRIBE_FAILED',
        null,
        error,
      ));
    }

    return () => {
      active = false;
      reconcileAdmission.current = null;
      invalidatePendingAdmission();
      releaseGenerationLease();
      unsubscribe?.();
    };
  }, []);

  if (fatalError) throw fatalError;
  return gateState;
}

export default useDashboardProfileMutationLifecycle;
