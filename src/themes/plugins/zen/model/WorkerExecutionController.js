import {
    WorkerExecutionController as SharedWorkerExecutionController,
} from '../../../../platform/workers/runtime/WorkerExecutionController.js';
import {
    WORKER_RUNTIME_CONTEXT,
    WORKER_RUNTIME_LANE,
    WORKER_RUNTIME_PRIORITY,
    resolveWorkerRuntimeContext,
    resolveWorkerRuntimeLane,
    resolveWorkerRuntimePriority,
} from '../../../../platform/workers/runtime/types.js';
import {
    DEFAULT_WORKER_FALLBACK_POLICY,
    resolveWorkerFallbackPolicy,
} from './SakuraV2Runtime';
import {
    recordWorkerRuntimeEvent,
} from './WorkerRuntimeTelemetry';

const normalizeMeta = (value) => (
    value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : null
);
const resolveNonEmptyString = (value, fallback = null) => (
    typeof value === 'string' && value.trim()
        ? value.trim()
        : fallback
);
const resolveRuntimeTaskType = (value, fallback = 'unknown') => (
    resolveNonEmptyString(value, fallback)
);

export class WorkerExecutionController extends SharedWorkerExecutionController {
    constructor(options = {}) {
        const runtimeContext = resolveWorkerRuntimeContext(
            options?.runtimeContext ?? options?.context ?? WORKER_RUNTIME_CONTEXT.UI,
        );
        const runtimeLane = resolveWorkerRuntimeLane(
            options?.runtimeLane ?? options?.lane ?? WORKER_RUNTIME_LANE.COMPUTE,
        );
        const runtimePriority = resolveWorkerRuntimePriority(
            options?.runtimePriority ?? options?.priority ?? WORKER_RUNTIME_PRIORITY.INTERACTIVE,
        );
        const runtimeTaskType = resolveRuntimeTaskType(
            options?.runtimeTaskType ?? options?.taskType ?? options?.workerId,
            'unknown',
        );
        super({
            ...options,
            fallbackPolicy: resolveWorkerFallbackPolicy(
                options?.fallbackPolicy ?? DEFAULT_WORKER_FALLBACK_POLICY,
            ),
            eventRecorder: (event = {}) => {
                const details = normalizeMeta(event?.details);
                const eventWorker = resolveNonEmptyString(event?.worker, options?.workerId || 'worker');
                const eventTaskType = resolveRuntimeTaskType(
                    details?.taskType ?? details?.runtimeTaskType,
                    runtimeTaskType,
                );
                const eventLane = resolveWorkerRuntimeLane(
                    details?.lane ?? details?.runtimeLane ?? runtimeLane,
                );
                const eventPriority = resolveWorkerRuntimePriority(
                    details?.priority ?? details?.runtimePriority ?? runtimePriority,
                );
                const eventContext = resolveWorkerRuntimeContext(
                    details?.context ?? details?.runtimeContext ?? runtimeContext,
                );
                recordWorkerRuntimeEvent({
                    type: event?.type,
                    worker: eventWorker,
                    taskType: eventTaskType,
                    lane: eventLane,
                    priority: eventPriority,
                    context: eventContext,
                    message: event?.message ?? null,
                    details,
                });
            },
        });
    }

    setFallbackPolicy(policy = DEFAULT_WORKER_FALLBACK_POLICY) {
        this.fallbackPolicy = resolveWorkerFallbackPolicy(policy);
    }
}
