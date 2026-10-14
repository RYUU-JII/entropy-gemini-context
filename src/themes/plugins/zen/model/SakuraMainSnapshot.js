import {
    STRUCTURE_MODE,
    validateStructureDepthForMode,
} from './ZenCoreConfig';
import {
    compileSakuraPhenotypeFromLatent,
} from './v2/SakuraCompiler';
import {
    validateSakuraLatent,
} from './v2/SakuraLatentSchema';

export const MAIN_SNAPSHOT_SCHEMA = 'zen_bonsai_snapshot_v1';
const STRUCTURE_MODE_VALUES = new Set(Object.values(STRUCTURE_MODE));
const SNAPSHOT_ALIGNMENT = Object.freeze({
    status: 'latent_only',
    distance: 0,
    threshold: 0,
});

const validateSnapshotStructureMode = (value) => {
    if (typeof value !== 'string' || !STRUCTURE_MODE_VALUES.has(value)) {
        throw new Error(
            `Snapshot structure mode must be one of: ${Array.from(STRUCTURE_MODE_VALUES).join(', ')}.`,
        );
    }
    return value;
};

const parseSnapshotSeed = (value) => {
    const numeric = Number(value);
    return Number.isInteger(numeric) ? numeric : null;
};

export const buildSakuraSnapshotTreePayload = ({
    seed,
    latent = null,
    themeId = 'zen',
} = {}) => {
    const parsedSeed = parseSnapshotSeed(seed);
    if (!Number.isFinite(parsedSeed)) {
        throw new Error('Snapshot seed is invalid.');
    }
    if (!latent || typeof latent !== 'object') {
        throw new Error('Snapshot latent payload is required.');
    }
    const canonicalLatent = validateSakuraLatent(latent, {
        code: 'SAKURA_SNAPSHOT_LATENT_INVALID',
        label: 'Snapshot latent payload',
    });
    return {
        tree: {
            themeId,
            treeType: 'sakura',
            seed: parsedSeed,
            latent: canonicalLatent,
        },
        alignment: SNAPSHOT_ALIGNMENT,
    };
};

export const parseSakuraMainSnapshotPayload = (payload = {}) => {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Snapshot payload must be an object.');
    }
    if (String(payload.schema || '') !== MAIN_SNAPSHOT_SCHEMA) {
        throw new Error(`Unsupported snapshot schema: ${String(payload.schema || 'unknown')}`);
    }

    const rawTree = payload.tree;
    if (!rawTree || typeof rawTree !== 'object') {
        throw new Error('Snapshot tree payload is missing.');
    }
    if (rawTree.treeType && rawTree.treeType !== 'sakura') {
        throw new Error(`Unsupported treeType: ${String(rawTree.treeType)}`);
    }
    const seed = parseSnapshotSeed(rawTree.seed);
    if (!Number.isFinite(seed)) {
        throw new Error('Snapshot seed is invalid.');
    }
    if (!rawTree.latent || typeof rawTree.latent !== 'object') {
        throw new Error('Snapshot latent payload is missing.');
    }

    const structure = payload.structure && typeof payload.structure === 'object'
        ? payload.structure
        : {};
    const structureMode = validateSnapshotStructureMode(structure.mode);
    const structureDepth = validateStructureDepthForMode(
        structureMode,
        structure.depth,
        {
            storageKey: 'zen_bonsai_snapshot.structure.depth',
        },
    );
    const canonicalLatent = validateSakuraLatent(rawTree.latent, {
        code: 'SAKURA_SNAPSHOT_LATENT_INVALID',
        label: 'Snapshot latent payload',
    });
    const phenotype = compileSakuraPhenotypeFromLatent(canonicalLatent);

    return {
        treeType: 'sakura',
        seed,
        phenotype,
        latent: canonicalLatent,
        structureMode,
        structureDepth,
        alignment: SNAPSHOT_ALIGNMENT,
    };
};
