import { normalizeZenBonsaiLifeState } from '../../ZenBonsaiLifeState.js';
import {
    ZEN_BONSAI_PLUME_MODEL_ID,
    ZEN_BONSAI_PLUME_TOPOLOGY_CONTRACT,
    ZEN_BONSAI_PLUME_PROMOTED_SOURCE,
    resolveZenBonsaiPlumeSourceSeed,
} from './ZenBonsaiPlumeIdentity.js';

export const ZEN_BONSAI_PLUME_PRODUCT_TARGET = Object.freeze({ year: 3, phase: 'spring', stage: 0.45 });
const admittedTopologies = new WeakSet();
const immutableNodes = new WeakSet();
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const smooth = value => value * value * (3 - 2 * value);
const fail = suffix => { throw Error(`ZEN_PLUME_LIFE_REPROJECTION_${suffix}`); };

export function resolveZenBonsaiPlumeLifeState(lifeState) {
    if (!lifeState || typeof lifeState !== 'object' || Array.isArray(lifeState)) {
        throw new Error('ZEN_PLUME_PRODUCT_LIFE_STATE_REQUIRED');
    }
    // Canonical product normalization owns defaults and the initial 0.5 form.
    return normalizeZenBonsaiLifeState(lifeState);
}

// Pure paint projection over normalized life. Growth posing and development
// remain outside this module, so an already scaled snapshot is never scaled again.
export function resolveZenBonsaiPlumeLifeAppearance(lifeState) {
    const bloom = lifeState.bloom;
    const health = 1 - lifeState.analysisConfidence * (
        lifeState.dryness * 0.5 + lifeState.stress * 0.25 + (1 - lifeState.vitality) * 0.25
    );
    return {
        bloom, health,
        flowerAlpha: bloom,
        flowerOpening: 0.3 + 0.7 * smooth(bloom),
        woodSaturation: 0.5 + 0.5 * health,
    };
}

// A frozen parent does not prove its descendants. Admission verifies the entire
// native-cloned data graph once; weak proofs retain no source graph or cache.
// New shallow wrappers can subsequently share those exact proven descendants.
function freezeDataGraph(value) {
    const seen = new WeakSet(), pending = [];
    const visit = node => {
        if (typeof node === 'function' || typeof node === 'symbol') fail('NON_DATA');
        if (node === null || typeof node !== 'object' || immutableNodes.has(node) || seen.has(node)) return;
        const prototype = Object.getPrototypeOf(node);
        if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) fail('NON_DATA');
        seen.add(node);
        for (const key of Reflect.ownKeys(node)) {
            const descriptor = Object.getOwnPropertyDescriptor(node, key);
            if (!Object.hasOwn(descriptor, 'value')) fail('ACCESSOR');
            visit(descriptor.value);
        }
        pending.push(node);
    };
    visit(value);
    for (const node of pending) Object.freeze(node);
    // Publish proofs only once the entire new graph is immutable, including cycles.
    for (const node of pending) immutableNodes.add(node);
    return value;
}

function requireTopologyIdentity(topology, seed) {
    if (!object(topology) || topology.contract !== ZEN_BONSAI_PLUME_TOPOLOGY_CONTRACT
        || topology.engine !== ZEN_BONSAI_PLUME_MODEL_ID || topology.isPlume !== true
        || topology.seed !== seed || topology.sourceSeed !== resolveZenBonsaiPlumeSourceSeed(seed)
        || topology.sourceVersion !== ZEN_BONSAI_PLUME_PROMOTED_SOURCE) fail('IDENTITY');
    const { snapshot, lifeState } = topology;
    const live = snapshot?.live, productLife = live?.productLife;
    const target = productLife?.target;
    if (!object(snapshot) || !object(lifeState) || !object(live) || !object(live.presentation)
        || !object(productLife) || productLife.contract !== 'zen_plume_product_life_v1'
        || !Number.isFinite(lifeState.growth) || lifeState.growth < 0.5 || lifeState.growth > 1
        || productLife.growth !== lifeState.growth || live.clock?.growth !== lifeState.growth
        || !object(target) || target.year !== ZEN_BONSAI_PLUME_PRODUCT_TARGET.year
        || target.phase !== ZEN_BONSAI_PLUME_PRODUCT_TARGET.phase
        || target.stage !== ZEN_BONSAI_PLUME_PRODUCT_TARGET.stage
        || live.presentation.activation !== 1 || live.presentation.windResponse !== 1
        || !Array.isArray(topology.cameraSnapshots) || topology.cameraSnapshots.length === 0) fail('SOURCE');
}

// The ModelClient calls this only after exact transport/result admission. It is
// not a substitute for that validation, and does not accept another source model.
export function requireZenBonsaiPlumeLifeTopology(topology, seed) {
    requireTopologyIdentity(topology, seed);
    return topology;
}

// The first PREPARE keeps its existing render-plan freeze path. Reuse obtains
// this complete proof lazily, so boot does not acquire another full graph walk.
export function admitZenBonsaiPlumeLifeTopology(topology) {
    if (admittedTopologies.has(topology)) return topology;
    freezeDataGraph(topology);
    requireTopologyIdentity(topology, topology?.seed);
    admittedTopologies.add(topology);
    return topology;
}

// Full request/ACK identity and active/park fences belong to the caller. This
// helper only binds latest appearance/metadata to its admitted current pose.
export function reprojectZenBonsaiPlumeLifeTopology(topology, { seed, lifeState, phenotype } = {}) {
    if (!admittedTopologies.has(topology)) fail('ADMISSION_REQUIRED');
    requireTopologyIdentity(topology, seed);
    const life = resolveZenBonsaiPlumeLifeState(lifeState);
    if (life.growth !== topology.lifeState.growth) fail('GROWTH_CHANGED');
    const { bloom, health, ...appearance } = resolveZenBonsaiPlumeLifeAppearance(life);
    const snapshot = topology.snapshot, live = snapshot.live;
    const next = freezeDataGraph({
        ...topology,
        snapshot: {
            ...snapshot,
            live: {
                ...live,
                presentation: { ...live.presentation, ...appearance },
                productLife: { ...live.productLife, bloom, health },
            },
        },
        lifeState: life,
        phenotype: structuredClone(phenotype),
    });
    admittedTopologies.add(next);
    return next;
}
