import { resolveWorkerRuntimeBudget } from './config.js';
import {
    WORKER_RUNTIME_DEGRADATION_MODE,
    WORKER_RUNTIME_SURFACE_STATUS,
    requireWorkerRuntimeSurface,
} from './WorkerRuntimeRegistry.js';

export const WORKER_RUNTIME_ADMISSION_ERROR_CODE = Object.freeze({
    DENIED: 'WORKER_RUNTIME_ADMISSION_DENIED',
    SURFACE_INACTIVE: 'WORKER_RUNTIME_ADMISSION_SURFACE_INACTIVE',
    POLICY_REQUIRED: 'WORKER_RUNTIME_ADMISSION_POLICY_REQUIRED',
});

export const WORKER_RUNTIME_LEASE_STATE = Object.freeze({
    ACTIVE: 'active',
    RELEASED: 'released',
    REVOKED: 'revoked',
});

const toPositiveInteger = (value, fallback = 1) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return fallback;
    }
    return Math.max(1, Math.floor(numeric));
};

const toNonNegativeInteger = (value, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
        return fallback;
    }
    return Math.max(0, Math.floor(numeric));
};

const isNonEmptyString = (value) => (
    typeof value === 'string' && value.trim().length > 0
);

const freezeDetails = (details = null) => Object.freeze(
    details && typeof details === 'object' && !Array.isArray(details)
        ? { ...details }
        : {},
);

const createAdmissionError = (code, message, details = null) => {
    const error = new Error(message);
    error.code = code;
    error.details = freezeDetails(details);
    return error;
};

const normalizeCapacity = (capacity = null, {
    fallbackNormalCapacity = 1,
    fallbackBurstWindowMs = 0,
} = {}) => {
    const source = Number.isFinite(Number(capacity))
        ? { maxWorkers: capacity, burstMaxWorkers: capacity }
        : (capacity && typeof capacity === 'object' ? capacity : {});
    const normalCapacity = toPositiveInteger(
        source.maxWorkers,
        fallbackNormalCapacity,
    );
    const requestedBurstCapacity = Math.max(
        normalCapacity,
        toPositiveInteger(source.burstMaxWorkers, normalCapacity),
    );
    const burstWindowMs = requestedBurstCapacity > normalCapacity
        ? toNonNegativeInteger(source.burstWindowMs, fallbackBurstWindowMs)
        : 0;
    const burstCapacity = burstWindowMs > 0
        ? requestedBurstCapacity
        : normalCapacity;

    return Object.freeze({
        normalCapacity,
        burstCapacity,
        burstWindowMs,
    });
};

const normalizeCapacityMap = (source = null, fallbackBurstWindowMs = 0) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        return Object.freeze({});
    }
    const normalized = {};
    Object.entries(source).forEach(([id, capacity]) => {
        if (!isNonEmptyString(id)) return;
        normalized[id] = normalizeCapacity(capacity, {
            fallbackBurstWindowMs,
        });
    });
    return Object.freeze(normalized);
};

const normalizeBudget = (budget = null, context = 'ui') => {
    const globalCapacity = normalizeCapacity(budget, {
        fallbackNormalCapacity: 1,
    });

    return Object.freeze({
        context,
        normalCapacity: globalCapacity.normalCapacity,
        burstCapacity: globalCapacity.burstCapacity,
        burstWindowMs: globalCapacity.burstWindowMs,
        groupCapacities: normalizeCapacityMap(
            budget?.admissionGroups,
            globalCapacity.burstWindowMs,
        ),
        laneCapacities: normalizeCapacityMap(
            budget?.lanes,
            globalCapacity.burstWindowMs,
        ),
    });
};

const resolveSurfaceAdmissionPolicy = (surface) => {
    if (surface.status !== WORKER_RUNTIME_SURFACE_STATUS.ACTIVE) {
        throw createAdmissionError(
            WORKER_RUNTIME_ADMISSION_ERROR_CODE.SURFACE_INACTIVE,
            `WORKER_RUNTIME_ADMISSION_SURFACE_INACTIVE:${surface.id}`,
            {
                surfaceId: surface.id,
                surfaceStatus: surface.status,
            },
        );
    }

    const group = isNonEmptyString(surface.admission?.group)
        ? surface.admission.group.trim()
        : null;
    const rank = Number(surface.admission?.rank);
    if (!group || !Number.isFinite(rank)) {
        throw createAdmissionError(
            WORKER_RUNTIME_ADMISSION_ERROR_CODE.POLICY_REQUIRED,
            `WORKER_RUNTIME_ADMISSION_POLICY_REQUIRED:${surface.id}`,
            { surfaceId: surface.id },
        );
    }

    return Object.freeze({
        group,
        rank,
        preemptible: (
            surface.degradationMode === WORKER_RUNTIME_DEGRADATION_MODE.PRESENTATION_DEGRADE
            && surface.admission?.preemptible === true
        ),
    });
};

const compareRetentionOrder = (left, right) => (
    right.rank - left.rank
    || left.acquiredOrder - right.acquiredOrder
    || left.id.localeCompare(right.id)
);

const compareRevocationOrder = (left, right) => (
    left.rank - right.rank
    || right.acquiredOrder - left.acquiredOrder
    || right.id.localeCompare(left.id)
);

const createActiveCountSnapshot = (records, capacities, readKey) => {
    const counts = {};
    Object.keys(capacities).sort().forEach((id) => {
        counts[id] = 0;
    });
    records.forEach((record) => {
        const id = readKey(record);
        counts[id] = (counts[id] || 0) + 1;
    });
    return Object.freeze(counts);
};

const readActiveCounts = (records, budget) => ({
    activeByGroup: createActiveCountSnapshot(
        records,
        budget.groupCapacities,
        (record) => record.group,
    ),
    activeByLane: createActiveCountSnapshot(
        records,
        budget.laneCapacities,
        (record) => record.lane,
    ),
});

const readCapacityViolations = (records, budget, capacityKey) => {
    const { activeByGroup, activeByLane } = readActiveCounts(records, budget);
    const violations = [];

    if (records.length > budget[capacityKey]) {
        violations.push(Object.freeze({
            scope: 'global',
            id: budget.context,
            activeCount: records.length,
            capacity: budget[capacityKey],
        }));
    }

    Object.entries(budget.groupCapacities).forEach(([group, capacity]) => {
        if (activeByGroup[group] <= capacity[capacityKey]) return;
        violations.push(Object.freeze({
            scope: 'group',
            id: group,
            activeCount: activeByGroup[group],
            capacity: capacity[capacityKey],
        }));
    });

    Object.entries(budget.laneCapacities).forEach(([lane, capacity]) => {
        if (activeByLane[lane] <= capacity[capacityKey]) return;
        violations.push(Object.freeze({
            scope: 'lane',
            id: lane,
            activeCount: activeByLane[lane],
            capacity: capacity[capacityKey],
        }));
    });

    return violations;
};

const readViolationExcess = (violations) => violations.reduce(
    (total, violation) => total + Math.max(0, violation.activeCount - violation.capacity),
    0,
);

const readViolationReason = (violation, phase) => (
    `${violation?.scope || 'global'}_${phase}_capacity_exhausted`
);

const createScopeSnapshots = ({
    capacities,
    activeCounts,
    activeRecords,
    state,
    readKey,
}) => {
    const snapshots = {};
    Object.entries(capacities).forEach(([id, capacity]) => {
        const activeCount = activeCounts[id] || 0;
        snapshots[id] = Object.freeze({
            activeCount,
            nonPreemptibleCount: activeRecords.filter((record) => (
                readKey(record) === id && record.preemptible !== true
            )).length,
            normalCapacity: capacity.normalCapacity,
            burstCapacity: capacity.burstCapacity,
            burstWindowMs: capacity.burstWindowMs,
            burstActive: (
                state.burstTimerId !== null
                && activeCount > capacity.normalCapacity
            ),
            burstStartedAt: activeCount > capacity.normalCapacity
                ? state.burstStartedAt
                : null,
            burstDeadlineAt: activeCount > capacity.normalCapacity
                ? state.burstDeadlineAt
                : null,
        });
    });
    return Object.freeze(snapshots);
};

export class WorkerRuntimeAdmissionController {
    constructor({
        budgetResolver = resolveWorkerRuntimeBudget,
        cpuCount = undefined,
        now = () => Date.now(),
        setTimeoutFn = (callback, delayMs) => setTimeout(callback, delayMs),
        clearTimeoutFn = (timerId) => clearTimeout(timerId),
    } = {}) {
        if (typeof budgetResolver !== 'function') {
            throw new Error('WORKER_RUNTIME_ADMISSION_BUDGET_RESOLVER_REQUIRED');
        }
        if (typeof now !== 'function') {
            throw new Error('WORKER_RUNTIME_ADMISSION_CLOCK_REQUIRED');
        }
        if (typeof setTimeoutFn !== 'function' || typeof clearTimeoutFn !== 'function') {
            throw new Error('WORKER_RUNTIME_ADMISSION_TIMER_REQUIRED');
        }

        this.budgetResolver = budgetResolver;
        this.cpuCount = cpuCount;
        this.now = now;
        this.setTimeoutFn = setTimeoutFn;
        this.clearTimeoutFn = clearTimeoutFn;
        this.contextState = new Map();
        this.leaseSequence = 0;
        this.acquisitionSequence = 0;
        this.revocationCallbackFailures = [];
    }

    acquire(surfaceId, {
        onRevoke = null,
        metadata = null,
    } = {}) {
        const surface = requireWorkerRuntimeSurface(surfaceId);
        const policy = resolveSurfaceAdmissionPolicy(surface);
        const state = this.getOrCreateContextState(surface.context);
        let budget = this.resolveBudget(surface.context);
        this.requireCapacityPolicy(surface, policy, budget);

        if (state.burstDeadlineAt !== null && this.now() >= state.burstDeadlineAt) {
            this.expireBurst(surface.context, { reason: 'burst_window_elapsed_before_acquire' });
            budget = this.resolveBudget(surface.context);
            this.requireCapacityPolicy(surface, policy, budget);
        }

        const active = Array.from(state.active.values());
        const candidate = {
            id: `${surface.context}:${surface.id}:${++this.leaseSequence}`,
            surface,
            surfaceId: surface.id,
            context: surface.context,
            group: policy.group,
            lane: surface.lane,
            rank: policy.rank,
            preemptible: policy.preemptible,
            acquiredAt: this.now(),
            acquiredOrder: ++this.acquisitionSequence,
            state: WORKER_RUNTIME_LEASE_STATE.ACTIVE,
            releasedAt: null,
            releaseReason: null,
            revokeNotified: false,
            onRevoke: typeof onRevoke === 'function' ? onRevoke : null,
            metadata: freezeDetails(metadata),
            lease: null,
        };

        const fullProjection = [...active, candidate];
        const burstViolations = readCapacityViolations(
            fullProjection,
            budget,
            'burstCapacity',
        );
        let handoffVictim = null;
        let projected = fullProjection;

        if (burstViolations.length > 0) {
            handoffVictim = active
                .filter((record) => record.preemptible && record.rank < candidate.rank)
                .sort(compareRevocationOrder)
                .find((record) => readCapacityViolations(
                    fullProjection.filter((projectedRecord) => projectedRecord !== record),
                    budget,
                    'burstCapacity',
                ).length === 0) ?? null;

            if (!handoffVictim) {
                throw this.createDeniedError(
                    candidate,
                    state,
                    budget,
                    readViolationReason(burstViolations[0], 'burst'),
                    burstViolations[0],
                );
            }
            projected = fullProjection.filter((record) => record !== handoffVictim);
        }

        const projectedNonPreemptible = projected.filter(
            (record) => record.preemptible !== true,
        );
        const normalViolations = readCapacityViolations(
            projectedNonPreemptible,
            budget,
            'normalCapacity',
        );
        if (normalViolations.length > 0) {
            throw this.createDeniedError(
                candidate,
                state,
                budget,
                readViolationReason(normalViolations[0], 'non_preemptible_normal'),
                normalViolations[0],
            );
        }

        const lease = this.createLease(candidate);
        candidate.lease = lease;
        let revokedVictim = null;
        if (handoffVictim) {
            revokedVictim = this.removeRecord(
                state,
                handoffVictim,
                WORKER_RUNTIME_LEASE_STATE.REVOKED,
                `handoff_to:${candidate.surfaceId}`,
            );
        }
        state.active.set(candidate.id, candidate);
        this.syncBurstTimer(state, budget);

        if (revokedVictim) {
            this.notifyRevoked(revokedVictim, {
                reason: revokedVictim.releaseReason,
                replacementSurfaceId: candidate.surfaceId,
            });
        }

        return lease;
    }

    releaseLease(leaseOrId, {
        reason = 'lease_released',
    } = {}) {
        const leaseId = typeof leaseOrId === 'string'
            ? leaseOrId
            : leaseOrId?.id;
        if (typeof leaseId !== 'string' || !leaseId) {
            return false;
        }

        for (const state of this.contextState.values()) {
            const record = state.active.get(leaseId);
            if (!record) continue;
            this.removeRecord(
                state,
                record,
                WORKER_RUNTIME_LEASE_STATE.RELEASED,
                reason,
            );
            this.syncBurstTimer(state, this.resolveBudget(state.context));
            return true;
        }
        return false;
    }

    expireBurst(context, {
        reason = 'burst_window_expired',
    } = {}) {
        const state = this.getOrCreateContextState(context);
        this.clearBurstTimer(state);
        const budget = this.resolveBudget(context);
        const revoked = [];

        while (true) {
            const active = Array.from(state.active.values());
            const violations = readCapacityViolations(
                active,
                budget,
                'normalCapacity',
            );
            if (violations.length === 0) break;

            const currentExcess = readViolationExcess(violations);
            const record = active
                .filter((candidate) => candidate.preemptible)
                .sort(compareRevocationOrder)
                .find((candidate) => {
                    const projected = active.filter((item) => item !== candidate);
                    return readViolationExcess(readCapacityViolations(
                        projected,
                        budget,
                        'normalCapacity',
                    )) < currentExcess;
                });
            if (!record) break;

            const removed = this.removeRecord(
                state,
                record,
                WORKER_RUNTIME_LEASE_STATE.REVOKED,
                reason,
            );
            if (removed) revoked.push(removed);
        }

        this.syncBurstTimer(state, budget);
        revoked.forEach((record) => {
            this.notifyRevoked(record, { reason });
        });

        const active = Array.from(state.active.values());
        const { activeByGroup, activeByLane } = readActiveCounts(active, budget);
        return Object.freeze({
            context,
            revokedLeaseIds: Object.freeze(revoked.map((record) => record.id)),
            activeCount: state.active.size,
            activeByGroup,
            activeByLane,
        });
    }

    getSnapshot(context = null) {
        if (typeof context === 'string' && context) {
            const state = this.getOrCreateContextState(context);
            return this.createContextSnapshot(state, this.resolveBudget(context));
        }

        const contexts = {};
        let totalActiveCount = 0;
        Array.from(this.contextState.keys()).sort().forEach((contextId) => {
            const state = this.getOrCreateContextState(contextId);
            const snapshot = this.createContextSnapshot(state, this.resolveBudget(contextId));
            contexts[contextId] = snapshot;
            totalActiveCount += snapshot.activeCount;
        });
        return Object.freeze({
            totalActiveCount,
            contexts: Object.freeze(contexts),
            revocationCallbackFailureCount: this.revocationCallbackFailures.length,
            lastRevocationCallbackFailure: this.revocationCallbackFailures.at(-1) ?? null,
        });
    }

    reset({ reason = 'admission_controller_reset' } = {}) {
        const revoked = [];
        this.contextState.forEach((state) => {
            this.clearBurstTimer(state);
            Array.from(state.active.values()).forEach((record) => {
                const removed = this.removeRecord(
                    state,
                    record,
                    WORKER_RUNTIME_LEASE_STATE.REVOKED,
                    reason,
                );
                if (removed) revoked.push(removed);
            });
        });
        this.contextState.clear();
        revoked.forEach((record) => {
            this.notifyRevoked(record, { reason });
        });
        return revoked.length;
    }

    resolveBudget(context) {
        return normalizeBudget(this.budgetResolver({
            context,
            cpuCount: this.cpuCount,
        }), context);
    }

    requireCapacityPolicy(surface, policy, budget) {
        const missingScope = !budget.groupCapacities[policy.group]
            ? `group:${policy.group}`
            : (!budget.laneCapacities[surface.lane]
                ? `lane:${surface.lane}`
                : null);
        if (!missingScope) return;

        throw createAdmissionError(
            WORKER_RUNTIME_ADMISSION_ERROR_CODE.POLICY_REQUIRED,
            `WORKER_RUNTIME_ADMISSION_POLICY_REQUIRED:${surface.id}:${missingScope}`,
            {
                surfaceId: surface.id,
                context: surface.context,
                missingScope,
            },
        );
    }

    getOrCreateContextState(context) {
        const existing = this.contextState.get(context);
        if (existing) return existing;
        const state = {
            context,
            active: new Map(),
            burstTimerId: null,
            burstStartedAt: null,
            burstDeadlineAt: null,
        };
        this.contextState.set(context, state);
        return state;
    }

    createLease(record) {
        const controller = this;
        return Object.freeze({
            id: record.id,
            surfaceId: record.surfaceId,
            context: record.context,
            group: record.group,
            lane: record.lane,
            rank: record.rank,
            preemptible: record.preemptible,
            get state() {
                return record.state;
            },
            get active() {
                return record.state === WORKER_RUNTIME_LEASE_STATE.ACTIVE;
            },
            release(options = {}) {
                return controller.releaseLease(record.id, options);
            },
        });
    }

    createDeniedError(candidate, state, budget, reason, violation = null) {
        const active = Array.from(state.active.values());
        const { activeByGroup, activeByLane } = readActiveCounts(active, budget);
        return createAdmissionError(
            WORKER_RUNTIME_ADMISSION_ERROR_CODE.DENIED,
            `WORKER_RUNTIME_ADMISSION_DENIED:${candidate.surfaceId}:${reason}`,
            {
                surfaceId: candidate.surfaceId,
                context: candidate.context,
                group: candidate.group,
                lane: candidate.lane,
                reason,
                rank: candidate.rank,
                activeCount: state.active.size,
                activeByGroup,
                activeByLane,
                normalCapacity: budget.normalCapacity,
                burstCapacity: budget.burstCapacity,
                groupCapacity: budget.groupCapacities[candidate.group],
                laneCapacity: budget.laneCapacities[candidate.lane],
                violation,
            },
        );
    }

    removeRecord(state, record, nextLeaseState, reason) {
        if (!record || record.state !== WORKER_RUNTIME_LEASE_STATE.ACTIVE) {
            return null;
        }
        if (!state.active.delete(record.id)) {
            return null;
        }
        record.state = nextLeaseState;
        record.releasedAt = this.now();
        record.releaseReason = typeof reason === 'string' && reason
            ? reason
            : nextLeaseState;
        return record;
    }

    notifyRevoked(record, details = null) {
        if (!record || record.revokeNotified) return false;
        record.revokeNotified = true;
        if (typeof record.onRevoke !== 'function') return true;
        try {
            record.onRevoke(Object.freeze({
                leaseId: record.id,
                surfaceId: record.surfaceId,
                context: record.context,
                group: record.group,
                lane: record.lane,
                rank: record.rank,
                reason: record.releaseReason,
                ...(details && typeof details === 'object' ? details : {}),
            }));
            return true;
        } catch (error) {
            const failure = Object.freeze({
                leaseId: record.id,
                surfaceId: record.surfaceId,
                context: record.context,
                group: record.group,
                lane: record.lane,
                reason: record.releaseReason,
                message: String(error?.message || error || 'WORKER_RUNTIME_ADMISSION_REVOKE_CALLBACK_FAILED'),
                at: this.now(),
            });
            this.revocationCallbackFailures.push(failure);
            if (this.revocationCallbackFailures.length > 50) {
                this.revocationCallbackFailures.shift();
            }
            return false;
        }
    }

    resolveActiveBurstWindowMs(active, budget) {
        const violations = readCapacityViolations(active, budget, 'normalCapacity');
        const windows = violations.map((violation) => {
            if (violation.scope === 'global') return budget.burstWindowMs;
            if (violation.scope === 'group') {
                return budget.groupCapacities[violation.id]?.burstWindowMs || 0;
            }
            return budget.laneCapacities[violation.id]?.burstWindowMs || 0;
        }).filter((windowMs) => windowMs > 0);
        return windows.length > 0 ? Math.min(...windows) : 0;
    }

    syncBurstTimer(state, budget) {
        const burstWindowMs = this.resolveActiveBurstWindowMs(
            Array.from(state.active.values()),
            budget,
        );
        if (burstWindowMs <= 0) {
            this.clearBurstTimer(state);
            return;
        }

        const nextDeadlineAt = this.now() + burstWindowMs;
        if (
            state.burstTimerId !== null
            && state.burstDeadlineAt !== null
            && state.burstDeadlineAt <= nextDeadlineAt
        ) {
            return;
        }
        this.clearBurstTimer(state);

        state.burstStartedAt = this.now();
        state.burstDeadlineAt = nextDeadlineAt;
        state.burstTimerId = this.setTimeoutFn(() => {
            state.burstTimerId = null;
            state.burstStartedAt = null;
            state.burstDeadlineAt = null;
            this.expireBurst(state.context, { reason: 'burst_window_expired' });
        }, Math.max(0, nextDeadlineAt - this.now()));
    }

    clearBurstTimer(state) {
        if (state.burstTimerId !== null) {
            this.clearTimeoutFn(state.burstTimerId);
        }
        state.burstTimerId = null;
        state.burstStartedAt = null;
        state.burstDeadlineAt = null;
    }

    createContextSnapshot(state, budget) {
        const activeRecords = Array.from(state.active.values());
        const activeLeases = activeRecords
            .sort(compareRetentionOrder)
            .map((record) => Object.freeze({
                id: record.id,
                surfaceId: record.surfaceId,
                context: record.context,
                group: record.group,
                lane: record.lane,
                rank: record.rank,
                preemptible: record.preemptible,
                acquiredAt: record.acquiredAt,
                acquiredOrder: record.acquiredOrder,
                metadata: record.metadata,
            }));
        const { activeByGroup, activeByLane } = readActiveCounts(activeRecords, budget);
        const groups = createScopeSnapshots({
            capacities: budget.groupCapacities,
            activeCounts: activeByGroup,
            activeRecords,
            state,
            readKey: (record) => record.group,
        });
        const lanes = createScopeSnapshots({
            capacities: budget.laneCapacities,
            activeCounts: activeByLane,
            activeRecords,
            state,
            readKey: (record) => record.lane,
        });

        return Object.freeze({
            context: state.context,
            activeCount: activeLeases.length,
            activeLeases: Object.freeze(activeLeases),
            activeByGroup,
            activeByLane,
            normalCapacity: budget.normalCapacity,
            burstCapacity: budget.burstCapacity,
            burstWindowMs: budget.burstWindowMs,
            groupCapacities: budget.groupCapacities,
            laneCapacities: budget.laneCapacities,
            groups,
            lanes,
            burstActive: state.burstTimerId !== null,
            burstStartedAt: state.burstStartedAt,
            burstDeadlineAt: state.burstDeadlineAt,
            revocationCallbackFailureCount: this.revocationCallbackFailures.filter(
                (failure) => failure.context === state.context,
            ).length,
            lastRevocationCallbackFailure: this.revocationCallbackFailures
                .filter((failure) => failure.context === state.context)
                .at(-1) ?? null,
        });
    }
}

export const workerRuntimeAdmissionController = new WorkerRuntimeAdmissionController();

export const acquireWorkerRuntimeLease = (surfaceId, options = {}) => (
    workerRuntimeAdmissionController.acquire(surfaceId, options)
);

export const getWorkerRuntimeAdmissionSnapshot = (context = null) => (
    workerRuntimeAdmissionController.getSnapshot(context)
);

export const resetWorkerRuntimeAdmissionForTests = () => (
    workerRuntimeAdmissionController.reset({ reason: 'test_reset' })
);
