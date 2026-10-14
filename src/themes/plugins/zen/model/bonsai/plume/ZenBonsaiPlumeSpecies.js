import { generateArm, validateGeneratedGraph } from './generation/source/research/factor-growth-4/candidate-entry.js';
import { DEFAULT_REQUEST } from './generation/source/research/factor-growth-4/contract.js';
import { extractScaffold, extractGeneratedF4Scaffold } from './canopy/f4-scaffold.js';
import { simulateZenCherryRhythmCanopy, inspectZenCherryRhythmCanopy } from './rhythm/model.js';
import { createZenCherryCloudModel, createZenGeneratedCherryCloudModel,
    createZenGeneratedCherryCloudPreparation, inspectZenCherryCloudModel } from './cloud/model.js';
import { createZenCherryPlumeF4History, poseZenCherryPlumeF4History } from './live/f4-history.js';
import { createZenCherryPlumeSnapshot, createZenGeneratedCherryPlumeCameraSnapshot } from './plume/model.js';
import { createZenCherryPlumeLiveSnapshot, createZenGeneratedCherryPlumeLiveSnapshot } from './live/model.js';
import { resolveZenCherryPlumeWoodBirths } from './live/wood-development.js';
import { projectZenBonsaiPlumeBranchEstablishment } from './ZenBonsaiPlumeBranchEstablishment.js';
import { ZEN_BONSAI_PLUME_MODEL_ID, ZEN_BONSAI_PLUME_SPECIES_CONTRACT,
    ZEN_BONSAI_PLUME_TOPOLOGY_CONTRACT, ZEN_BONSAI_PLUME_PROJECTED_SNAPSHOT_CONTRACT, ZEN_BONSAI_PLUME_PROMOTED_SOURCE,
    ZEN_BONSAI_PLUME_ANATOMY_SOURCE } from './ZenBonsaiPlumeIdentity.js';
export { ZEN_BONSAI_PLUME_MODEL_ID, ZEN_BONSAI_PLUME_SPECIES_CONTRACT,
    ZEN_BONSAI_PLUME_TOPOLOGY_CONTRACT, ZEN_BONSAI_PLUME_PROMOTED_SOURCE } from './ZenBonsaiPlumeIdentity.js';
import {
    ZEN_BONSAI_PLUME_PRODUCT_TARGET, ZEN_BONSAI_PLUME_SEED_CONTRACT,
    resolveZenBonsaiPlumeSourceSeed, resolveZenBonsaiPlumeLifeState,
    applyZenBonsaiPlumeLifePresentation,
} from './ZenBonsaiPlumeLifeAdapter.js';

const anatomySource = ZEN_BONSAI_PLUME_ANATOMY_SOURCE;
function freeze(value, seen = new Set()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return value;
    seen.add(value); for (const child of Object.values(value)) freeze(child, seen);
    return Object.freeze(value);
}
const cameraEnvelope = snapshot => {
    const radii = new Map(snapshot.nodes.map(n => [n.id, 0]));
    for (const segment of snapshot.segments) {
        const endpoints = segment.owner === 'cherry-family' ? [segment.radius, segment.radius] : [segment.startRadius, segment.endRadius];
        for (const [index, id] of [segment.parentNodeId, segment.childNodeId].entries()) {
            if (!radii.has(id) || !(endpoints[index] > 0)) throw Error('ZEN_PLUME_CAMERA_ENVELOPE_WOOD');
            radii.set(id, Math.max(radii.get(id), endpoints[index]));
        }
    }
    return {
    nodes: snapshot.nodes.map(n => ({ id: n.id, p: [...n.p], owner: n.owner, radius: radii.get(n.id) })),
    scaffoldSegments: snapshot.segments.filter(segment => segment.owner === 'f4-scaffold')
        .map(segment => ({ parentNodeId: segment.parentNodeId, childNodeId: segment.childNodeId })),
    woodSegments: snapshot.segments.map(segment => ({ parentNodeId: segment.parentNodeId, childNodeId: segment.childNodeId })),
    // Spring posing owns the fixed { start, end } pedicel shape and creates
    // independent vectors. Copy both points without a per-flower clone call.
    flowers: snapshot.flowers.map(f => ({ position: [...f.position], radius: f.radius, cup: f.cup,
        pedicel: { start: [...f.pedicel.start], end: [...f.pedicel.end] } })),
    livingTips: snapshot.livingTips.map(t => ({ p: [...t.p], radius: t.radius })), attachments: [],
    };
};
function matureCameraEnvelope(raw, seed, createSpringSnapshot) {
    if (raw.phase === 'spring') {
        // Pose only the organ collections used by the camera. The full cloud
        // observation was already validated above; copying its event/history,
        // ledger, axis and cloud receipts cannot affect the mature envelope.
        const observation = {
            id: raw.id, cycle: raw.cycle, phase: raw.phase,
            nodes: raw.nodes, segments: raw.segments, annualUnits: raw.annualUnits,
            buds: raw.buds, flowers: raw.flowers,
        };
        return cameraEnvelope(createSpringSnapshot(observation, { seed, strength: 1, stage: 1 }));
    }
    if (!['summer', 'winter'].includes(raw.phase) || raw.flowers.length !== 0) {
        throw new Error('ZEN_PLUME_CAMERA_INACTIVE_OBSERVATION');
    }
    // Inactive seasons do not pose wood or flowers and expose no living tips.
    // The envelope itself still copies every retained point; it never aliases
    // the complete immutable source observation kept by the study.
    return cameraEnvelope({ nodes: raw.nodes, segments: raw.segments, flowers: [], livingTips: [] });
}
function requireValid(errors, owner) {
    if (errors.length) throw new Error(`ZEN_PLUME_PRODUCT_${owner}:${errors.join('; ')}`);
}

// Product generation executes in the strict model compute worker. Its requesting
// surface retains the returned study DTO for one seed; it never enters the Home
// renderer worker, persistence, or an ambient module-level cache.
export function createZenBonsaiPlumeStudy(seed, diagnostics = null) {
    const study = assemblePlumeStudy(seed, diagnostics, createZenCherryCloudModel, extractScaffold, createZenCherryPlumeSnapshot);
    return diagnostics ? diagnostics.measure('study_deep_freeze', () => freeze(study)) : freeze(study);
}

// Only GeneratedRequest calls this with its own canonical scalar recorder. No
// injected task observer or replacement reference enters the generated path.
export function createZenGeneratedBonsaiPlumeStudy(seed, diagnostics) {
    const study = assemblePlumeStudy(seed, diagnostics, createZenGeneratedCherryCloudModel, extractGeneratedF4Scaffold, createZenCherryPlumeSnapshot);
    return diagnostics ? diagnostics.measure('study_deep_freeze', () => freeze(study)) : freeze(study);
}

// Closed preparation data for GeneratedRequest's fixed product finalizer. Every
// anatomical validation and camera pass has completed; only the final retained
// product graph receives the last deep freeze. This is never a transport study.
export function createZenGeneratedBonsaiPlumePreparation(seed, diagnostics) {
    const study = assemblePlumeStudy(seed, diagnostics, createZenGeneratedCherryCloudPreparation,
        extractGeneratedF4Scaffold, createZenGeneratedCherryPlumeCameraSnapshot);
    return { ...study, schema: 'zen_bonsai_plume_generated_preparation_v1' };
}

function assemblePlumeStudy(seed, diagnostics, createCloud, extractF4Scaffold, createSpringSnapshot) {
    const measure = (stage, task) => diagnostics ? diagnostics.measure(stage, task) : task();
    const sourceSeed = resolveZenBonsaiPlumeSourceSeed(seed);
    const request = { ...structuredClone(DEFAULT_REQUEST), seed: sourceSeed };
    const graph = measure('study_f4_generation', () => generateArm(request, true).topology.graph);
    measure('study_f4_validation', () => requireValid(validateGeneratedGraph(graph), 'F4_GRAPH'));
    const scaffold = measure('study_scaffold_extract', () => extractF4Scaffold(graph, request));
    const reference = measure('study_annual_rhythm', () => simulateZenCherryRhythmCanopy({ scaffold, years: 3, treatment: 'natural', variant: 'renewal' }));
    measure('study_annual_validation', () => requireValid(inspectZenCherryRhythmCanopy(reference), 'REFERENCE'));
    const cloud = measure('study_cloud', () => createCloud(reference, { seed: sourceSeed }));
    measure('study_cloud_validation', () => requireValid(inspectZenCherryCloudModel(cloud), 'CLOUD'));
    const f4History = measure('study_f4_history', () => createZenCherryPlumeF4History(reference, graph));
    const study = {
        schema: 'zen_cherry_plume_live_study_v1', seed: sourceSeed, sourceHash: anatomySource,
        cloud: { schema: cloud.schema, seed: sourceSeed, snapshots: cloud.snapshots, policy: cloud.policy },
        reference: { scaffold }, f4History, cameraSnapshots: [],
        product: { contract: ZEN_BONSAI_PLUME_SPECIES_CONTRACT, seed, sourceSeed, seedProjection: ZEN_BONSAI_PLUME_SEED_CONTRACT, promotedSource: ZEN_BONSAI_PLUME_PROMOTED_SOURCE },
    };
    // Camera fitting needs only the exact mature observations. Building all
    // nine mutable-copy/flower-development plans here is wasted preparation:
    // only the selected life projection consumes such a plan, lazily below.
    measure('study_camera_envelopes', () => {
        study.cameraSnapshots = study.cloud.snapshots.map(raw => matureCameraEnvelope(raw, study.seed, createSpringSnapshot));
        study.cameraSnapshots.push(cameraEnvelope(poseZenCherryPlumeF4History(f4History, study.cameraSnapshots[0], 1, { envelope: true }).snapshot));
    });
    return study;
}

export function projectZenBonsaiPlumeTopology(study, { seed, lifeState, phenotype } = {}, diagnostics = null) {
    return projectPlumeTopology(study, { seed, lifeState, phenotype }, diagnostics, createZenCherryPlumeLiveSnapshot, freeze);
}

// The Worker request owner supplies its explicit live-study view. Species owns
// the shared anatomy projection, independently of the product transport schema;
// public arbitrary-input projections retain their compiled-pose path.
export function projectZenGeneratedBonsaiPlumeTopology(study, { seed, lifeState, phenotype }, diagnostics) {
    return projectPlumeTopology(study, { seed, lifeState, phenotype }, diagnostics, createZenGeneratedCherryPlumeLiveSnapshot, freeze);
}

// Only GeneratedRequest supplies the exact camera identity admitted by the
// product finalizer's weak deep-freeze proof. Public/full generated projections
// retain their complete traversal, including frozen parents' mutable children.
export function projectZenGeneratedBonsaiPlumePreparedTopology(study, payload, diagnostics, frozenCamera) {
    if (frozenCamera !== study.cameraSnapshots || !Object.isFrozen(frozenCamera)) {
        throw new Error('ZEN_PLUME_GENERATED_CAMERA_FREEZE_PROOF');
    }
    return projectPlumeTopology(study, payload, diagnostics, createZenGeneratedCherryPlumeLiveSnapshot,
        topology => freeze(topology, new Set([frozenCamera])));
}

// Subsequent private PROJECT computes the same snapshot without receiving or
// returning the fixed camera history retained by the mounted client.
export function projectZenGeneratedBonsaiPlumeSnapshot(study, { seed, lifeState, phenotype }, diagnostics) {
    const { snapshot, life } = projectPlumeSnapshot(study, { seed, lifeState }, diagnostics, createZenGeneratedCherryPlumeLiveSnapshot);
    const finish = () => freeze({
        contract: ZEN_BONSAI_PLUME_PROJECTED_SNAPSHOT_CONTRACT, engine: ZEN_BONSAI_PLUME_MODEL_ID, isPlume: true,
        seed, sourceSeed: study.seed, sourceVersion: ZEN_BONSAI_PLUME_PROMOTED_SOURCE,
        snapshot, lifeState: life, phenotype: structuredClone(phenotype),
    });
    return diagnostics ? diagnostics.measure('projection_deep_freeze', finish) : finish();
}

function projectPlumeSnapshot(study, { seed, lifeState }, diagnostics, createLiveSnapshot) {
    const measure = (stage, task) => diagnostics ? diagnostics.measure(stage, task) : task();
    if (study?.product?.contract !== ZEN_BONSAI_PLUME_SPECIES_CONTRACT || study.product.seed !== seed) {
        throw new Error('ZEN_PLUME_PRODUCT_STUDY_IDENTITY');
    }
    const life = resolveZenBonsaiPlumeLifeState(lifeState);
    const observed = measure('projection_live_snapshot', () => createLiveSnapshot(study, {
        growth: life.growth, activation: 1, ...ZEN_BONSAI_PLUME_PRODUCT_TARGET,
    }));
    const branches = measure('projection_branch_establishment', () => projectZenBonsaiPlumeBranchEstablishment(observed, resolveZenCherryPlumeWoodBirths(study, observed)));
    const snapshot = measure('projection_life_presentation', () => applyZenBonsaiPlumeLifePresentation(branches.snapshot, life, branches.receipt));
    return { snapshot, life };
}

function projectPlumeTopology(study, { seed, lifeState, phenotype }, diagnostics, createLiveSnapshot, freezeTopology) {
    const measure = (stage, task) => diagnostics ? diagnostics.measure(stage, task) : task();
    const { snapshot, life } = projectPlumeSnapshot(study, { seed, lifeState }, diagnostics, createLiveSnapshot);
    return measure('projection_deep_freeze', () => freezeTopology({
        contract: ZEN_BONSAI_PLUME_TOPOLOGY_CONTRACT, engine: ZEN_BONSAI_PLUME_MODEL_ID, isPlume: true,
        seed, sourceSeed: study.seed, sourceVersion: ZEN_BONSAI_PLUME_PROMOTED_SOURCE,
        snapshot, cameraSnapshots: study.cameraSnapshots, lifeState: life, phenotype: structuredClone(phenotype),
    }));
}

export function generateZenBonsaiPlumeTopology({ seed, lifeState, phenotype } = {}) {
    return projectZenBonsaiPlumeTopology(createZenBonsaiPlumeStudy(seed), { seed, lifeState, phenotype });
}
