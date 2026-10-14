import {
    ZEN_BONSAI_PLUME_ANATOMY_SOURCE,
    ZEN_BONSAI_PLUME_MODEL_ID,
    ZEN_BONSAI_PLUME_PROJECTED_SNAPSHOT_CONTRACT,
    ZEN_BONSAI_PLUME_PROMOTED_SOURCE,
    ZEN_BONSAI_PLUME_SEED_CONTRACT,
    ZEN_BONSAI_PLUME_TOPOLOGY_CONTRACT,
    resolveZenBonsaiPlumeSourceSeed,
} from './ZenBonsaiPlumeIdentity.js';
import {
    ZEN_BONSAI_PLUME_PROJECTION_STUDY_SCHEMA,
    createZenBonsaiPlumeProjectionStudy,
    requireZenBonsaiPlumeProductStudy,
    requireZenBonsaiPlumeProjectionStudy,
} from './ZenBonsaiPlumeProductStudy.js';
import { admitZenBonsaiPlumeLifeTopology } from './ZenBonsaiPlumeLifeAppearance.js';

const PROJECT = 'PROJECT_PLUME_TOPOLOGY';
const SOURCE_KEYS = ['studySchema', 'sourceSeed', 'sourceHash', 'seedProjection', 'promotedSource'];
const PROJECTION_KEYS = ['contract', 'engine', 'isPlume', 'seed', 'sourceSeed', 'sourceVersion', 'snapshot', 'lifeState', 'phenotype'];
const RESULT_KEYS = ['operation', 'seed', 'projectionKey', 'preparationKey', 'sourceIdentity', 'projection'];
const REQUEST_KEYS = ['seed', 'lifeState', 'phenotype', 'projectionKey', 'preparationKey', 'study'];
// A local binding belongs to one prepared ModelClient and never enters transport.
// Weak authentication retains no study, camera or Worker.
const preparationBindings = new WeakSet();
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const keysAre = (value, keys) => object(value) && Reflect.ownKeys(value).length === keys.length
    && keys.every(key => Object.hasOwn(value, key));
const fail = suffix => { throw Error(`ZEN_PLUME_PROJECTION_${suffix}`); };
const preparationKeyValid = value => typeof value === 'string' && value.length > 0 && value.trim() === value;

function sourceIdentity(study) {
    return Object.freeze({ studySchema: ZEN_BONSAI_PLUME_PROJECTION_STUDY_SCHEMA,
        sourceSeed: study.seed, sourceHash: study.sourceHash,
        seedProjection: study.product.seedProjection, promotedSource: study.product.promotedSource });
}
function requireSourceIdentity(value, seed) {
    if (!keysAre(value, SOURCE_KEYS) || value.studySchema !== ZEN_BONSAI_PLUME_PROJECTION_STUDY_SCHEMA
        || value.sourceSeed !== resolveZenBonsaiPlumeSourceSeed(seed)
        || value.sourceHash !== ZEN_BONSAI_PLUME_ANATOMY_SOURCE
        || value.seedProjection !== ZEN_BONSAI_PLUME_SEED_CONTRACT
        || value.promotedSource !== ZEN_BONSAI_PLUME_PROMOTED_SOURCE) fail('SOURCE_IDENTITY');
}
function requireBinding(binding) {
    if (!object(binding) || !preparationBindings.has(binding)) fail('PREPARATION_BINDING');
    return binding;
}

export function createZenBonsaiPlumeProjectionBinding(study, { seed, preparationKey }) {
    requireZenBonsaiPlumeProductStudy(study, { seed });
    if (!preparationKeyValid(preparationKey)) fail('PREPARATION_IDENTITY');
    const binding = Object.freeze({ seed, preparationKey, study, sourceIdentity: sourceIdentity(study),
        cameraSnapshots: study.cameraSnapshots });
    preparationBindings.add(binding);
    return binding;
}

export function createZenBonsaiPlumeProjectionRequest(study, input, binding) {
    requireBinding(binding);
    const core = createZenBonsaiPlumeProjectionStudy(study);
    const source = sourceIdentity(core);
    if (input.seed !== binding.seed || study !== binding.study || study.cameraSnapshots !== binding.cameraSnapshots
        || SOURCE_KEYS.some(key => source[key] !== binding.sourceIdentity[key])) fail('PREPARATION_IDENTITY');
    const { seed, lifeState, phenotype, projectionKey } = input;
    const payload = { seed, lifeState, phenotype, projectionKey, preparationKey: binding.preparationKey, study: core };
    requireZenBonsaiPlumeProjectionRequest(payload);
    return { payload, identity: { operation: PROJECT, seed, projectionKey,
        preparationKey: binding.preparationKey, sourceIdentity: binding.sourceIdentity } };
}

export function requireZenBonsaiPlumeProjectionRequest(payload) {
    if (!object(payload)) fail('REQUEST_IDENTITY');
    const keys = Object.hasOwn(payload, 'diagnosticIdentity') ? [...REQUEST_KEYS, 'diagnosticIdentity'] : REQUEST_KEYS;
    if (!keysAre(payload, keys) || !preparationKeyValid(payload.preparationKey)
        || typeof payload.projectionKey !== 'string'
        || payload.projectionKey !== JSON.stringify({ seed: payload.seed, lifeState: payload.lifeState, phenotype: payload.phenotype })) fail('REQUEST_IDENTITY');
    requireZenBonsaiPlumeProjectionStudy(payload.study, { seed: payload.seed });
    return payload;
}

export function createZenBonsaiPlumeProjectionResult(projection, payload) {
    requireZenBonsaiPlumeProjectionRequest(payload);
    const result = Object.freeze({ operation: PROJECT, seed: payload.seed, projectionKey: payload.projectionKey,
        preparationKey: payload.preparationKey, sourceIdentity: sourceIdentity(payload.study), projection });
    return requireZenBonsaiPlumeProjectionResult(result, result);
}

export function requireZenBonsaiPlumeProjectionResult(result, identity) {
    if (!keysAre(result, RESULT_KEYS) || !object(identity) || identity.operation !== PROJECT || result.operation !== PROJECT
        || result.seed !== identity.seed || result.projectionKey !== identity.projectionKey
        || !preparationKeyValid(result.preparationKey) || result.preparationKey !== identity.preparationKey) fail('RESPONSE_IDENTITY');
    requireSourceIdentity(result.sourceIdentity, result.seed);
    requireSourceIdentity(identity.sourceIdentity, identity.seed);
    if (SOURCE_KEYS.some(key => result.sourceIdentity[key] !== identity.sourceIdentity[key])) fail('SOURCE_IDENTITY');
    const value = result.projection;
    if (!keysAre(value, PROJECTION_KEYS) || value.contract !== ZEN_BONSAI_PLUME_PROJECTED_SNAPSHOT_CONTRACT
        || value.engine !== ZEN_BONSAI_PLUME_MODEL_ID || value.isPlume !== true || value.seed !== result.seed
        || value.sourceSeed !== result.sourceIdentity.sourceSeed || value.sourceVersion !== result.sourceIdentity.promotedSource
        || !object(value.snapshot) || !object(value.lifeState)) fail('SNAPSHOT_IDENTITY');
    return result;
}

export function assembleZenBonsaiPlumeProjectedTopology(result, binding, { projectionKey }) {
    requireBinding(binding);
    requireZenBonsaiPlumeProjectionResult(result, { operation: PROJECT, seed: binding.seed, projectionKey,
        preparationKey: binding.preparationKey, sourceIdentity: binding.sourceIdentity });
    const value = result.projection;
    // Camera always comes from this preparation. No optional-camera admission or
    // native/full-result fallback is allowed at the private PROJECT boundary.
    return admitZenBonsaiPlumeLifeTopology({ contract: ZEN_BONSAI_PLUME_TOPOLOGY_CONTRACT,
        engine: value.engine, isPlume: value.isPlume, seed: value.seed, sourceSeed: value.sourceSeed,
        sourceVersion: value.sourceVersion, snapshot: value.snapshot, cameraSnapshots: binding.cameraSnapshots,
        lifeState: value.lifeState, phenotype: value.phenotype });
}
