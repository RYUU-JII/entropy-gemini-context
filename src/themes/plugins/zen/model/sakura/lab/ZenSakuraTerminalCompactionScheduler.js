export const SAKURA_TERMINAL_COMPACTION_SCHEDULER_CONTRACT =
    'zen_sakura_terminal_compaction_scheduler_v1';

function createDeferred() {
    let resolve;
    const promise = new Promise((settle) => {
        resolve = settle;
    });
    return { promise, resolve };
}

function requireEpochRequest(request) {
    if (
        !request
        || typeof request.signature !== 'string'
        || !request.signature
        || typeof request.generation !== 'string'
        || !request.generation
        || !Array.isArray(request.jobs)
        || request.jobs.length === 0
    ) {
        throw new Error('ZEN_SAKURA_COMPACTION_EPOCH_REQUEST_INVALID');
    }
    const jobIds = new Set();
    request.jobs.forEach((job) => {
        if (
            !job
            || typeof job.id !== 'string'
            || !job.id
            || typeof job.signature !== 'string'
            || !job.signature
        ) {
            throw new Error('ZEN_SAKURA_COMPACTION_JOB_INVALID');
        }
        if (jobIds.has(job.id)) {
            throw new Error(`ZEN_SAKURA_COMPACTION_JOB_ID_DUPLICATE:${job.id}`);
        }
        jobIds.add(job.id);
    });
    return request;
}

export function createSakuraTerminalCompactionScheduler({
    bakeJob,
    yieldControl = () => Promise.resolve(),
    discardOutput = () => {},
} = {}) {
    if (typeof bakeJob !== 'function') {
        throw new Error('ZEN_SAKURA_COMPACTION_BAKER_REQUIRED');
    }
    if (typeof yieldControl !== 'function' || typeof discardOutput !== 'function') {
        throw new Error('ZEN_SAKURA_COMPACTION_SCHEDULER_HOOK_INVALID');
    }

    let disposed = false;
    let requestRevision = 0;
    let latestRevision = 0;
    let inFlight = null;
    let pendingLatest = null;
    let committed = null;
    let drainPromise = null;
    const diagnostics = {
        requested: 0,
        deduped: 0,
        superseded: 0,
        jobsBaked: 0,
        staleDiscarded: 0,
        retired: 0,
        committed: 0,
        failed: 0,
        inFlightSignature: null,
        pendingSignature: null,
        committedSignature: null,
    };

    const discardOutputs = (outputs) => {
        outputs.forEach((output) => {
            discardOutput(output);
            diagnostics.staleDiscarded += 1;
        });
    };

    const retireOutputs = (outputs) => {
        outputs.forEach((output) => {
            discardOutput(output);
            diagnostics.retired += 1;
        });
    };

    const drain = async () => {
        while (!disposed && pendingLatest) {
            const epoch = pendingLatest;
            pendingLatest = null;
            diagnostics.pendingSignature = null;
            inFlight = epoch;
            diagnostics.inFlightSignature = epoch.request.signature;
            const outputs = [];
            try {
                for (const job of epoch.request.jobs) {
                    await yieldControl();
                    if (disposed || epoch.revision !== latestRevision) break;
                    outputs.push(await bakeJob(job, epoch.request));
                    diagnostics.jobsBaked += 1;
                }
                if (disposed || epoch.revision !== latestRevision) {
                    discardOutputs(outputs);
                    epoch.deferred.resolve(Object.freeze({
                        status: 'superseded',
                        signature: epoch.request.signature,
                    }));
                    diagnostics.superseded += 1;
                } else {
                    const nextCommitted = Object.freeze({
                        status: 'committed',
                        signature: epoch.request.signature,
                        generation: epoch.request.generation,
                        outputs: Object.freeze(outputs),
                    });
                    if (committed) {
                        retireOutputs(committed.outputs);
                    }
                    committed = nextCommitted;
                    diagnostics.committed += 1;
                    diagnostics.committedSignature = epoch.request.signature;
                    epoch.deferred.resolve(nextCommitted);
                }
            } catch (error) {
                discardOutputs(outputs);
                diagnostics.failed += 1;
                epoch.deferred.resolve(Object.freeze({
                    status: 'failed',
                    signature: epoch.request.signature,
                    error,
                }));
            } finally {
                inFlight = null;
                diagnostics.inFlightSignature = null;
            }
        }
        drainPromise = null;
    };

    const ensureDrain = () => {
        if (!drainPromise) {
            drainPromise = drain();
        }
    };

    const requestEpoch = (input) => {
        if (disposed) {
            throw new Error('ZEN_SAKURA_COMPACTION_SCHEDULER_DISPOSED');
        }
        const request = requireEpochRequest(input);
        diagnostics.requested += 1;
        if (committed?.signature === request.signature) {
            diagnostics.deduped += 1;
            return Promise.resolve(Object.freeze({
                ...committed,
                status: 'deduped',
            }));
        }
        if (inFlight?.request.signature === request.signature) {
            diagnostics.deduped += 1;
            return inFlight.deferred.promise;
        }
        if (pendingLatest?.request.signature === request.signature) {
            diagnostics.deduped += 1;
            return pendingLatest.deferred.promise;
        }

        requestRevision += 1;
        latestRevision = requestRevision;
        if (pendingLatest) {
            pendingLatest.deferred.resolve(Object.freeze({
                status: 'superseded',
                signature: pendingLatest.request.signature,
            }));
            diagnostics.superseded += 1;
        }
        const epoch = {
            revision: requestRevision,
            request,
            deferred: createDeferred(),
        };
        pendingLatest = epoch;
        diagnostics.pendingSignature = request.signature;
        ensureDrain();
        return epoch.deferred.promise;
    };

    const readDiagnostics = () => Object.freeze({
        contract: SAKURA_TERMINAL_COMPACTION_SCHEDULER_CONTRACT,
        ...diagnostics,
    });

    const dispose = () => {
        if (disposed) return;
        disposed = true;
        latestRevision += 1;
        if (pendingLatest) {
            pendingLatest.deferred.resolve(Object.freeze({
                status: 'disposed',
                signature: pendingLatest.request.signature,
            }));
            pendingLatest = null;
        }
        diagnostics.pendingSignature = null;
        if (committed) {
            retireOutputs(committed.outputs);
            committed = null;
            diagnostics.committedSignature = null;
        }
    };

    return Object.freeze({
        contract: SAKURA_TERMINAL_COMPACTION_SCHEDULER_CONTRACT,
        requestEpoch,
        readDiagnostics,
        dispose,
    });
}
