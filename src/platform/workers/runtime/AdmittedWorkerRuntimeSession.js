import {
    WORKER_RUNTIME_LEASE_STATE,
    workerRuntimeAdmissionController,
} from './WorkerRuntimeAdmissionController.js';

const resolveReason = (value, fallback) => (
    typeof value === 'string' && value.trim() ? value.trim() : fallback
);

export function createAdmittedWorkerRuntimeSession({
    surfaceId,
    createWorker,
    admissionController = workerRuntimeAdmissionController,
    admissionMetadata = null,
    onRevoked = null,
} = {}) {
    if (typeof createWorker !== 'function') {
        throw new Error('ADMITTED_WORKER_RUNTIME_CONSTRUCTOR_REQUIRED');
    }
    if (!admissionController || typeof admissionController.acquire !== 'function') {
        throw new Error('ADMITTED_WORKER_RUNTIME_CONTROLLER_REQUIRED');
    }

    let worker = null;
    let lease = null;
    let terminated = false;
    let terminationReason = null;
    let terminationError = null;

    const terminate = ({
        reason = 'worker_session_terminated',
        releaseLease = true,
        throwOnError = true,
    } = {}) => {
        if (terminated) return false;
        terminated = true;
        terminationReason = resolveReason(reason, 'worker_session_terminated');
        let caughtError = null;
        try {
            worker?.terminate?.();
        } catch (error) {
            caughtError = error;
            terminationError = error;
        } finally {
            worker = null;
            if (releaseLease && lease) {
                lease.release({ reason: terminationReason });
            }
        }
        if (caughtError && throwOnError) {
            throw caughtError;
        }
        return true;
    };

    const handleAdmissionRevoked = (details = null) => {
        terminate({
            reason: resolveReason(details?.reason, 'worker_admission_revoked'),
            releaseLease: false,
            throwOnError: false,
        });
        if (typeof onRevoked === 'function') {
            onRevoked(Object.freeze({
                ...(details && typeof details === 'object' ? details : {}),
                terminationError,
            }));
        }
    };

    lease = admissionController.acquire(surfaceId, {
        metadata: admissionMetadata,
        onRevoke: handleAdmissionRevoked,
    });

    try {
        worker = createWorker();
        if (!worker || typeof worker.terminate !== 'function') {
            throw new Error('ADMITTED_WORKER_RUNTIME_INSTANCE_INVALID');
        }
    } catch (error) {
        terminated = true;
        terminationReason = 'worker_construction_failed';
        terminationError = error;
        worker = null;
        lease.release({ reason: terminationReason });
        throw error;
    }

    return Object.freeze({
        surfaceId: lease.surfaceId,
        lease,
        get worker() {
            return worker;
        },
        get terminated() {
            return terminated;
        },
        get terminationReason() {
            return terminationReason;
        },
        get terminationError() {
            return terminationError;
        },
        get leaseState() {
            return lease.state;
        },
        terminate(options = {}) {
            return terminate(options);
        },
        isActive() {
            return !terminated && lease.state === WORKER_RUNTIME_LEASE_STATE.ACTIVE;
        },
    });
}
