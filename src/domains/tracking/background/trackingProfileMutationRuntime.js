import { createTrackingProfileMutationError } from './trackingProfileMutationAdmission.js';

// Composition of the existing owner drains; no new lifecycle authority.
export function createTrackingProfileMutationRuntime({ profileMutationAdmissionOwner,
    consumptionLedger, activeTabRuntimeState, domainSessionRuntimeState, consumptionMemoryService }) {
    let profileMutationQuiescePromise = null;
    let terminalProfileMutationResetTail = Promise.resolve();
    function quiesceForProfileMutation({ operation } = {}) {
        const disposition = profileMutationAdmissionOwner.beginQuiesce(operation);
        if (disposition === 'in_progress') return profileMutationQuiescePromise;
        if (disposition === 'complete') {
            return Promise.resolve(Object.freeze({ quiesced: true, reused: true }));
        }

        const quiesceRun = Promise.all([
            consumptionLedger.drainForProfileMutation(),
            activeTabRuntimeState.drainForProfileMutation(),
            domainSessionRuntimeState.drainForProfileMutation(),
        ]).then(() => {
            profileMutationAdmissionOwner.completeQuiesce();
            return Object.freeze({ quiesced: true, reused: false });
        }).catch((cause) => {
            profileMutationAdmissionOwner.failQuiesce();
            const error = createTrackingProfileMutationError(
                'TAB_TIME_TRACKER_PROFILE_MUTATION_QUIESCE_FAILED',
                profileMutationAdmissionOwner.getPhase(),
            );
            error.cause = cause;
            throw error;
        });
        profileMutationQuiescePromise = quiesceRun;
        void quiesceRun.then(
            () => {
                if (profileMutationQuiescePromise === quiesceRun) {
                    profileMutationQuiescePromise = null;
                }
            },
            () => {
                if (profileMutationQuiescePromise === quiesceRun) {
                    profileMutationQuiescePromise = null;
                }
            },
        );
        return quiesceRun;
    }

    async function executeTerminalProfileMutationReset() {
        profileMutationAdmissionOwner.assertQuiesced();
        await Promise.all([
            consumptionLedger.resetForTerminalProfileMutation(),
            activeTabRuntimeState.resetForTerminalProfileMutation(),
            domainSessionRuntimeState.resetForTerminalProfileMutation(),
        ]);
        consumptionMemoryService.discard();
        return Object.freeze({ reset: true });
    }

    function runTerminalProfileMutationReset() {
        try {
            profileMutationAdmissionOwner.assertQuiesced();
        } catch (error) {
            return Promise.reject(error);
        }
        const operation = terminalProfileMutationResetTail.then(
            executeTerminalProfileMutationReset,
            executeTerminalProfileMutationReset,
        );
        terminalProfileMutationResetTail = operation.catch(() => undefined);
        return operation;
    }

    return { quiesceForProfileMutation, runTerminalProfileMutationReset };
}
