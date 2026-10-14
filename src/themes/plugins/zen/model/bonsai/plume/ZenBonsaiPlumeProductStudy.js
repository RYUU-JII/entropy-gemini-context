import {
    ZEN_BONSAI_PLUME_ANATOMY_SOURCE,
    ZEN_BONSAI_PLUME_PROMOTED_SOURCE,
    ZEN_BONSAI_PLUME_SPECIES_CONTRACT,
    resolveZenBonsaiPlumeSourceSeed, ZEN_BONSAI_PLUME_SEED_CONTRACT,
} from './ZenBonsaiPlumeIdentity.js';

export const ZEN_BONSAI_PLUME_PRODUCT_STUDY_SCHEMA = 'zen_bonsai_plume_product_study_v1';
export const ZEN_BONSAI_PLUME_PROJECTION_STUDY_SCHEMA = 'zen_bonsai_plume_projection_study_v1';
const LIVE_STUDY_SCHEMA = 'zen_cherry_plume_live_study_v1';
const PREPARATION_SCHEMA = 'zen_bonsai_plume_generated_preparation_v1';
const PHASES = ['spring', 'summer', 'winter'];
const COLLECTIONS = ['nodes', 'segments', 'annualUnits', 'buds', 'flowers', 'attachments'];
const STUDY_KEYS = ['schema', 'seed', 'sourceHash', 'cloud', 'reference', 'f4History', 'cameraSnapshots', 'product'];
const PROJECTION_STUDY_KEYS = ['schema', 'seed', 'sourceHash', 'cloud', 'reference', 'f4History', 'product'];
const OBSERVATION_KEYS = ['id', 'cycle', 'phase', ...COLLECTIONS];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const vector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const keysAre = (value, keys) => object(value) && Object.keys(value).length === keys.length
    && keys.every(key => Object.hasOwn(value, key));
const fail = suffix => { throw Error(`ZEN_PLUME_PRODUCT_STUDY_${suffix}`); };
// Identity-only proof of this finalizer's complete traversal. Weak membership
// retains no study/camera graph and is never serialized or inferred from a
// shallow Object.isFrozen check on caller-owned data.
const generatedFrozenCameraRoots = new WeakSet();

function requireIdentity(study, seed) {
    if (!object(study) || !Number.isSafeInteger(seed) || seed < 0
        || study.sourceHash !== ZEN_BONSAI_PLUME_ANATOMY_SOURCE
        || study.seed !== resolveZenBonsaiPlumeSourceSeed(seed)
        || study.product?.contract !== ZEN_BONSAI_PLUME_SPECIES_CONTRACT
        || study.product.seed !== seed || study.product.sourceSeed !== study.seed
        || study.product.seedProjection !== ZEN_BONSAI_PLUME_SEED_CONTRACT
        || study.product.promotedSource !== ZEN_BONSAI_PLUME_PROMOTED_SOURCE) fail('IDENTITY');
}

function requireAnatomyInputs(study, compact) {
    if (!object(study.cloud) || study.cloud.seed !== study.seed
        || study.cloud.schema !== 'zen_cherry_cloud_v1'
        || !Array.isArray(study.cloud.snapshots) || study.cloud.snapshots.length !== 9) fail('OBSERVATIONS');
    for (const [index, raw] of study.cloud.snapshots.entries()) {
        if (!object(raw) || (compact && !keysAre(raw, OBSERVATION_KEYS))
            || typeof raw.id !== 'string' || !raw.id || raw.cycle !== Math.floor(index / 3) + 1
            || raw.phase !== PHASES[index % 3]
            || COLLECTIONS.some(key => !Array.isArray(raw[key]))) fail('OBSERVATIONS');
    }
    const history = study.f4History;
    if (!object(history) || history.schema !== 'zen_cherry_plume_f4_history_v1'
        || history.seed !== study.seed || typeof history.rootNodeId !== 'string'
        || !history.rootNodeId || ['nodes', 'segments', 'events', 'retirements'].some(key => !Array.isArray(history[key]))) fail('F4_HISTORY');
}

function requireCameraInputs(study) {
    if (!Array.isArray(study.cameraSnapshots) || study.cameraSnapshots.length !== 10
        || study.cameraSnapshots.some(camera => !object(camera)
            || ['nodes', 'scaffoldSegments', 'woodSegments', 'flowers', 'livingTips', 'attachments']
                .some(key => !Array.isArray(camera[key])))) fail('CAMERA');
}

function requireTrayInputs(study, compact) {
    const scaffold = study.reference?.scaffold;
    if (!object(scaffold) || !Number.isFinite(scaffold.bounds?.height) || scaffold.bounds.height <= 0
        || !Array.isArray(scaffold.nodes)) fail('TRAY');
    const origins = scaffold.nodes.filter(node => node?.id === 'origin');
    if (origins.length !== 1 || !vector(origins[0].p)) fail('TRAY');
    if (compact && (!keysAre(study.reference, ['scaffold']) || !keysAre(scaffold, ['bounds', 'nodes'])
        || !keysAre(scaffold.bounds, ['height']) || scaffold.nodes.length !== 1
        || !keysAre(origins[0], ['id', 'p']) || !keysAre(study.cloud, ['schema', 'seed', 'snapshots']))) fail('SHAPE');
}

function requireProjectionInputs(study, compact) {
    requireAnatomyInputs(study, compact);
    requireCameraInputs(study);
    requireTrayInputs(study, compact);
}

/** Strict private transport admission. Native Worker clones need not be frozen. */
export function requireZenBonsaiPlumeProductStudy(study, { seed } = {}) {
    if (!keysAre(study, STUDY_KEYS) || study.schema !== ZEN_BONSAI_PLUME_PRODUCT_STUDY_SCHEMA) fail('SCHEMA');
    requireIdentity(study, seed);
    requireProjectionInputs(study, true);
    return study;
}

/**
 * The closed full-study producer already validated and deeply froze all organs.
 * Share those exact immutable records; only transport wrappers lose audit data.
 */
export function createZenBonsaiPlumeProductStudy(fullStudy) {
    if (fullStudy?.schema !== LIVE_STUDY_SCHEMA) fail('SOURCE_SCHEMA');
    requireIdentity(fullStudy, fullStudy.product?.seed);
    requireProjectionInputs(fullStudy, false);
    const retained = [fullStudy, fullStudy.f4History, fullStudy.cameraSnapshots, fullStudy.product,
        ...fullStudy.cloud.snapshots.flatMap(raw => [raw, ...COLLECTIONS.map(key => raw[key])])];
    if (retained.some(value => !Object.isFrozen(value))) fail('SOURCE_MUTABLE');
    return createProductStudyGraph(fullStudy);
}

function createProductStudyGraph(source) {
    const snapshots = Object.freeze(source.cloud.snapshots.map(raw => Object.freeze({
        id: raw.id, cycle: raw.cycle, phase: raw.phase,
        nodes: raw.nodes, segments: raw.segments, annualUnits: raw.annualUnits,
        buds: raw.buds, flowers: raw.flowers, attachments: raw.attachments,
    })));
    const origin = source.reference.scaffold.nodes.find(node => node.id === 'origin');
    const study = Object.freeze({
        schema: ZEN_BONSAI_PLUME_PRODUCT_STUDY_SCHEMA, seed: source.seed, sourceHash: source.sourceHash,
        cloud: Object.freeze({ schema: source.cloud.schema, seed: source.seed, snapshots }),
        reference: Object.freeze({ scaffold: Object.freeze({
            bounds: Object.freeze({ height: source.reference.scaffold.bounds.height }),
            nodes: Object.freeze([Object.freeze({ id: origin.id, p: origin.p })]),
        }) }),
        f4History: source.f4History, cameraSnapshots: source.cameraSnapshots, product: source.product,
    });
    return requireZenBonsaiPlumeProductStudy(study, { seed: source.product.seed });
}

function freezeRetainedGraph(value, seen = new Set()) {
    if (value === null || typeof value !== 'object' || seen.has(value)) return value;
    seen.add(value);
    // Frozen wrappers and shallow kernel freezes are not proof about children.
    for (const child of Object.values(value)) freezeRetainedGraph(child, seen);
    return Object.freeze(value);
}

/** Only GeneratedRequest supplies the complete validated preparation data. */
export function finalizeZenGeneratedBonsaiPlumeProductStudy(preparation) {
    if (preparation?.schema !== PREPARATION_SCHEMA) fail('PREPARATION_SCHEMA');
    requireIdentity(preparation, preparation.product?.seed);
    requireProjectionInputs(preparation, false);
    const study = freezeRetainedGraph(createProductStudyGraph(preparation));
    generatedFrozenCameraRoots.add(study.cameraSnapshots);
    return study;
}

/** GeneratedRequest alone carries this producer proof into initial projection. */
export function requireZenGeneratedBonsaiPlumeFrozenCamera(study) {
    if (!object(study) || !generatedFrozenCameraRoots.has(study.cameraSnapshots)) fail('CAMERA_FREEZE_PROOF');
    return study.cameraSnapshots;
}

/** Strict camera-free input for a later private PROJECT. */
export function requireZenBonsaiPlumeProjectionStudy(study, { seed } = {}) {
    if (!keysAre(study, PROJECTION_STUDY_KEYS)
        || study.schema !== ZEN_BONSAI_PLUME_PROJECTION_STUDY_SCHEMA) fail('PROJECTION_SCHEMA');
    requireIdentity(study, seed);
    requireAnatomyInputs(study, true);
    requireTrayInputs(study, true);
    return study;
}

export function createZenBonsaiPlumeProjectionStudy(study) {
    requireZenBonsaiPlumeProductStudy(study, { seed: study?.product?.seed });
    return Object.freeze({
        schema: ZEN_BONSAI_PLUME_PROJECTION_STUDY_SCHEMA, seed: study.seed, sourceHash: study.sourceHash,
        cloud: study.cloud, reference: study.reference, f4History: study.f4History, product: study.product,
    });
}

/** The partial projector receives an explicit live view without camera data. */
export function createZenBonsaiPlumeProjectionLiveStudy(study) {
    requireZenBonsaiPlumeProjectionStudy(study, { seed: study?.product?.seed });
    return Object.freeze({ ...study, schema: LIVE_STUDY_SCHEMA });
}

/** Explicit projection adapter; a compact payload never masquerades as a full study. */
export function createZenBonsaiPlumeProductLiveStudy(study) {
    requireZenBonsaiPlumeProductStudy(study, { seed: study?.product?.seed });
    return Object.freeze({ ...study, schema: LIVE_STUDY_SCHEMA });
}
