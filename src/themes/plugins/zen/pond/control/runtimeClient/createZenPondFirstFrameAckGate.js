import {
    requireZenPondWorkerStartupProgress,
} from '../../renderers/worker/core/zenPondWorkerStartupContract.js';

const isObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

export const createZenPondFirstFrameAckGate = ({
    defaultTimeoutMs = 10000,
    onTimeout = null,
} = {}) => {
    let received = false;
    let payload = null;
    let resolveWait = null;
    let rejectWait = null;
    let timerId = 0;
    let progress = null;

    const clearTimer = () => {
        if (!timerId) return;
        clearTimeout(timerId);
        timerId = 0;
    };

    const clearWaiter = () => {
        resolveWait = null;
        rejectWait = null;
    };

    const markReceived = (message = null) => {
        const isFirst = received !== true;
        received = true;
        payload = isObject(message) ? message : null;
        clearTimer();
        if (resolveWait) {
            const resolve = resolveWait;
            clearWaiter();
            resolve(payload);
        }
        return {
            isFirst,
            payload,
        };
    };

    const rejectPending = (error) => {
        clearTimer();
        if (rejectWait) {
            const reject = rejectWait;
            clearWaiter();
            reject(error instanceof Error ? error : new Error(String(error || 'ZEN_POND_FIRST_FRAME_ACK_FAILED')));
            return true;
        }
        return false;
    };

    const markProgress = (value) => {
        const normalized = requireZenPondWorkerStartupProgress(value);
        if (received) return progress;
        progress = normalized;
        return progress;
    };

    const reset = ({
        rejectMessage = 'ZEN_POND_FIRST_FRAME_ACK_CANCELED',
    } = {}) => {
        received = false;
        payload = null;
        progress = null;
        const hadPendingReject = typeof rejectWait === 'function';
        clearTimer();
        if (hadPendingReject) {
            const reject = rejectWait;
            clearWaiter();
            reject(new Error(rejectMessage));
            return;
        }
        clearWaiter();
    };

    const wait = ({
        timeoutMs = defaultTimeoutMs,
    } = {}) => {
        if (received) {
            return Promise.resolve(payload);
        }
        if (resolveWait || rejectWait) {
            return Promise.reject(new Error('ZEN_POND_FIRST_FRAME_ACK_WAIT_CONFLICT'));
        }
        return new Promise((resolve, reject) => {
            resolveWait = resolve;
            rejectWait = reject;
            const resolvedTimeoutMs = Math.max(600, Math.floor(timeoutMs));
            timerId = setTimeout(() => {
                timerId = 0;
                clearWaiter();
                const error = new Error(`ZEN_POND_FIRST_FRAME_ACK_TIMEOUT:${resolvedTimeoutMs}ms`);
                error.code = 'ZEN_POND_FIRST_FRAME_ACK_TIMEOUT';
                error.details = Object.freeze({
                    timeoutMs: resolvedTimeoutMs,
                    startupProgress: progress,
                });
                if (typeof onTimeout === 'function') {
                    onTimeout(error);
                }
                reject(error);
            }, resolvedTimeoutMs);
        });
    };

    return {
        getPayload: () => payload,
        getProgress: () => progress,
        hasReceived: () => received === true,
        hasPendingWaiter: () => Boolean(resolveWait || rejectWait),
        markReceived,
        markProgress,
        rejectPending,
        reset,
        wait,
    };
};
