import {
    WorkerRequestClient,
    WORKER_RUNTIME_SURFACE_IDS,
    createWorkerRequestClientConfig,
} from '@/platform/workers/runtime/index.js';
import {
    ZEN_BONSAI_PLUME_MODEL_OPERATION,
    requireZenBonsaiPlumeProductModelResult,
} from './ZenBonsaiPlumeModelProtocol.js';
import ZenBonsaiModelWorker from '../../../workers/zenBonsaiModel.worker.js?worker';
import { createZenBonsaiPlumeModelDiagnostics } from './ZenBonsaiPlumeModelDiagnostics.js';
import { createZenBonsaiPlumeProjectionBinding, createZenBonsaiPlumeProjectionRequest,
    assembleZenBonsaiPlumeProjectedTopology } from './ZenBonsaiPlumeProjectionTransport.js';
import { requireZenBonsaiPlumeLifeTopology, admitZenBonsaiPlumeLifeTopology, reprojectZenBonsaiPlumeLifeTopology,
    resolveZenBonsaiPlumeLifeState } from './ZenBonsaiPlumeLifeAppearance.js';

const aborted = () => Object.assign(new Error('ZEN_PLUME_MODEL_REQUEST_CANCELED'), { name: 'AbortError' });
let modelClientSequence = 0;

// One mounted surface/seed owns this nonpersistent DTO; the admitted Worker is
// task-active only. Same-growth life binding shares this admitted pose; anatomy
// generation/projection remains Worker-only, with no model storage or idle cache.
export class ZenBonsaiPlumeModelClient {
    #preparation = null;
    #prepared = null;
    #preparationSequence = 0;
    #preparationOwnerId = ++modelClientSequence;
    #projectionBinding = null;
    #diagnostics = null;
    #activeDiagnosticIdentity = null;
    #operationIdentities = new Map();
    #topologyIdentities = new WeakMap();
    #physicalWorkerInstanceId = null;
    #returnedProjectionDiagnostic = null;
    #uiDiagnosticStages = new WeakMap();
    #preparationDiagnosticIdentity = null;
    #hasCommittedTopology = false;
    #projectionWork = null;

    constructor({ seed, onDiagnosticEvent } = {}) {
        this.seed = seed;
        this.requestClient = null;
        this.disposed = false;
        this.projectionSequence = 0;
        this.projecting = false;
        this.#diagnostics = createZenBonsaiPlumeModelDiagnostics({ seed, onEvent: onDiagnosticEvent });
    }

    createDiagnosticOperation(operation, projectionKey) {
        const identity = this.#diagnostics?.createOperation(operation, projectionKey !== null);
        if (identity) {
            this.#operationIdentities.set(identity.operationId, identity);
            if (this.#operationIdentities.size > 32) {
                this.#operationIdentities.delete(this.#operationIdentities.keys().next().value);
            }
            const preparation = operation === ZEN_BONSAI_PLUME_MODEL_OPERATION.PROJECT
                && !this.#hasCommittedTopology ? this.#preparationDiagnosticIdentity : null;
            this.#diagnostics.record(identity, 'operation_start', preparation ? {
                preparationOperationId: preparation.operationId,
                preparationWorkerInstanceId: preparation.workerInstanceId,
            } : {});
        }
        return identity;
    }

    recordTopologyDiagnostic(topology, stage) {
        const identity = this.#topologyIdentities.get(topology);
        if (identity) this.#diagnostics.record(identity, stage, {
            sourceOperationId: identity.operationId, sourceWorkerInstanceId: identity.workerInstanceId,
        });
    }

    markUIAccepted({ projectionKey }) {
        this.markProjectionUIStage(projectionKey, 'ui_accept');
    }

    markUICommitted({ projectionKey }) {
        this.markProjectionUIStage(projectionKey, 'ui_commit');
    }

    markProjectionUIStage(projectionKey, stage) {
        if (!this.#diagnostics) return;
        const returned = this.#returnedProjectionDiagnostic;
        if (!returned || returned.projectionKey !== projectionKey) {
            throw new Error('ZEN_PLUME_MODEL_UI_DIAGNOSTIC_IDENTITY_INVALID');
        }
        let stages = this.#uiDiagnosticStages.get(returned.topology);
        if (!stages) {
            stages = new Set();
            this.#uiDiagnosticStages.set(returned.topology, stages);
        }
        if (stages.has(stage)) return;
        this.#diagnostics.record(returned.identity, stage, {
            sourceOperationId: returned.identity.operationId,
            sourceWorkerInstanceId: returned.identity.workerInstanceId,
            uiProjectionSequence: returned.sequence,
            ...(stage === 'ui_commit' ? { initialUiCommit: !this.#hasCommittedTopology } : {}),
        });
        stages.add(stage);
        if (stage === 'ui_commit') this.#hasCommittedTopology = true;
    }

    getRequestClient(diagnosticIdentity = null) {
        if (this.disposed) throw aborted();
        this.#activeDiagnosticIdentity = diagnosticIdentity;
        if (!this.requestClient) {
            const diagnosticOptions = this.#diagnostics ? {
                onLifecycleEvent: meta => {
                    const identity = meta.requestOptions?.diagnosticIdentity || this.#activeDiagnosticIdentity;
                    this.#diagnostics.record(identity, meta.stage, {
                        atMs: meta.atMs, messageId: meta.messageId ?? null,
                    });
                },
                onMessage: ({ message }) => {
                    if (!message.diagnosticEvents) return;
                    const identity = this.#operationIdentities.get(message.diagnosticIdentity?.operationId);
                    if (!identity) throw new Error('ZEN_PLUME_MODEL_DIAGNOSTIC_OPERATION_UNKNOWN');
                    this.#diagnostics.receive(identity, message.diagnosticEvents);
                },
            } : {};
            const createZenBonsaiModelWorker = () => {
                let workerOptions;
                if (this.#diagnostics) {
                    const workerInstanceId = this.#diagnostics.createWorkerInstanceId();
                    this.#physicalWorkerInstanceId = workerInstanceId;
                    this.#activeDiagnosticIdentity.workerInstanceId = workerInstanceId;
                    workerOptions = { name: workerInstanceId };
                }
                return new ZenBonsaiModelWorker(workerOptions);
            };
            this.requestClient = new WorkerRequestClient(createWorkerRequestClientConfig(
                WORKER_RUNTIME_SURFACE_IDS.ZEN_BONSAI_MODEL,
                { workerFactory: createZenBonsaiModelWorker,
                initMessage: { type: 'PING' }, initReadyTypes: ['READY'], ...diagnosticOptions,
                responseResolver: ({ message, requestType, requestOptions }) => {
                    if (message.type === 'ERROR') return { ok: false, error: message.error };
                    if (message.type !== 'RESULT') throw new Error('ZEN_PLUME_MODEL_RESPONSE_TYPE_INVALID');
                    const identity = requestOptions.diagnosticIdentity;
                    this.#diagnostics?.record(identity, 'response_validation_start', { messageId: message.id ?? null });
                    const result = requireZenBonsaiPlumeProductModelResult(message.result, {
                        operation: requestType, seed: requestOptions.seed, projectionKey: requestOptions.projectionKey,
                        preparationKey: requestOptions.preparationKey, sourceIdentity: requestOptions.sourceIdentity,
                    });
                    this.#diagnostics?.record(identity, 'response_validation_end', { messageId: message.id ?? null });
                    return { ok: true, result };
                } },
            ));
        }
        if (this.#diagnostics) {
            this.requestClient.initMessage = { type: 'PING', diagnosticIdentity };
            if (this.requestClient.worker) diagnosticIdentity.workerInstanceId = this.#physicalWorkerInstanceId;
        }
        return this.requestClient;
    }

    prepare({ lifeState, phenotype, projectionKey } = {}) {
        if (this.#preparation) return this.#preparation;
        const sequence = ++this.#preparationSequence;
        const identity = this.createDiagnosticOperation(ZEN_BONSAI_PLUME_MODEL_OPERATION.PREPARE, projectionKey);
        this.#preparationDiagnosticIdentity = identity;
        this.#preparation = this.getRequestClient(identity).request(ZEN_BONSAI_PLUME_MODEL_OPERATION.PREPARE,
            { seed: this.seed, lifeState, phenotype, projectionKey, ...(identity ? { diagnosticIdentity: identity } : {}) },
            { seed: this.seed, projectionKey, ...(identity ? { diagnosticIdentity: identity } : {}) }).then(result => {
            if (this.disposed || sequence !== this.#preparationSequence) throw aborted();
            if (result.topology !== null) requireZenBonsaiPlumeLifeTopology(result.topology, this.seed);
            this.#projectionBinding = createZenBonsaiPlumeProjectionBinding(result.study, {
                seed: this.seed, preparationKey: `zen-plume-preparation:${this.#preparationOwnerId}:${sequence}`,
            });
            this.#prepared = result;
            if (identity && result.topology) this.#topologyIdentities.set(result.topology, identity);
            this.#diagnostics?.record(identity, 'preparation_retained');
        }).catch(error => {
            this.#diagnostics?.record(identity, error.name === 'AbortError' ? 'operation_canceled' : 'operation_failed');
            throw error;
        });
        return this.#preparation;
    }

    async project({ lifeState, phenotype, projectionKey }) {
        const sequence = ++this.projectionSequence;
        if (!this.#preparation) throw new Error('ZEN_PLUME_MODEL_PREPARATION_REQUIRED');
        await this.#preparation;
        if (this.disposed || sequence !== this.projectionSequence) throw aborted();
        // Keep one active computation. New active demand replaces waiting demand
        // instead of terminating/restarting the Worker and cloning the study for
        // every intermediate input. Parking still interrupts physical work.
        if (this.#projectionWork) await this.#projectionWork;
        if (this.disposed || sequence !== this.projectionSequence) throw aborted();
        const prepared = this.#prepared;
        if (typeof projectionKey !== 'string'
            || projectionKey !== JSON.stringify({ seed: this.seed, lifeState, phenotype })) {
            throw new Error('ZEN_PLUME_MODEL_PROJECTION_IDENTITY_INVALID');
        }
        if (prepared.projectionKey === projectionKey) {
            this.recordTopologyDiagnostic(prepared.topology, 'projection_reused');
            if (this.#diagnostics) this.#returnedProjectionDiagnostic = {
                projectionKey, topology: prepared.topology, sequence,
                identity: this.#topologyIdentities.get(prepared.topology),
            };
            return prepared.topology;
        }
        // Clone the small life input at the same boundary as native transport.
        // Non-cloneable inputs still fail rather than silently gaining a local path.
        const life = resolveZenBonsaiPlumeLifeState(structuredClone(lifeState));
        if (prepared.topology !== null && prepared.topology.lifeState.growth === life.growth) {
            const startedAt = this.#diagnostics ? performance.now() : 0;
            admitZenBonsaiPlumeLifeTopology(prepared.topology);
            const topology = reprojectZenBonsaiPlumeLifeTopology(prepared.topology,
                { seed: this.seed, lifeState: life, phenotype });
            this.#prepared = { ...prepared, projectionKey, topology };
            if (this.#diagnostics) {
                const identity = this.#topologyIdentities.get(prepared.topology);
                this.#topologyIdentities.set(topology, identity);
                this.#returnedProjectionDiagnostic = { projectionKey, topology, sequence, identity };
                this.#diagnostics.record(identity, 'projection_life_rebound', {
                    durationMs: performance.now() - startedAt,
                    sourceOperationId: identity.operationId, sourceWorkerInstanceId: identity.workerInstanceId,
                    uiProjectionSequence: sequence,
                });
            }
            return topology;
        }
        const identity = this.createDiagnosticOperation(ZEN_BONSAI_PLUME_MODEL_OPERATION.PROJECT, projectionKey);
        const binding = this.#projectionBinding;
        const request = createZenBonsaiPlumeProjectionRequest(prepared.study,
            { seed: this.seed, lifeState, phenotype, projectionKey }, binding);
        let work;
        try {
            work = this.getRequestClient(identity).request(ZEN_BONSAI_PLUME_MODEL_OPERATION.PROJECT,
                { ...request.payload, ...(identity ? { diagnosticIdentity: identity } : {}) },
                { ...request.identity, ...(identity ? { diagnosticIdentity: identity } : {}) });
            this.#projectionWork = work;
            this.projecting = true;
            const result = await work;
            if (this.disposed || sequence !== this.projectionSequence || binding !== this.#projectionBinding
                || prepared.study !== this.#prepared.study) throw aborted();
            const topology = assembleZenBonsaiPlumeProjectedTopology(result, binding, { projectionKey });
            this.#prepared = { ...prepared, projectionKey, topology };
            if (identity) this.#topologyIdentities.set(topology, identity);
            if (identity) this.#returnedProjectionDiagnostic = { projectionKey, topology, sequence, identity };
            this.#diagnostics?.record(identity, 'projection_retained');
            return topology;
        } catch (error) {
            this.#diagnostics?.record(identity, error.name === 'AbortError' ? 'operation_canceled' : 'operation_failed');
            throw error;
        } finally {
            if (this.#projectionWork === work) {
                this.#projectionWork = null;
                this.projecting = false;
            }
        }
    }

    cancelProjection() {
        this.projectionSequence += 1;
    }

    park() {
        this.cancelProjection();
        this.requestClient?.disable(aborted());
        this.requestClient = null;
        this.#projectionWork = null;
        this.projecting = false;
        if (this.#prepared === null) {
            this.#preparationSequence += 1;
            this.#preparation = null;
            this.#projectionBinding = null;
            this.#preparationDiagnosticIdentity = null;
        }
    }

    dispose() {
        this.disposed = true;
        this.park();
        this.#prepared = null;
        this.#preparation = null;
        this.#projectionBinding = null;
        // This diagnostic receipt owns the accepted pose strongly; weak maps do not.
        this.#returnedProjectionDiagnostic = null;
    }
}
