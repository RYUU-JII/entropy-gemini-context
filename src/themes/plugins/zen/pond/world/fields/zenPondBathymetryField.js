import {
    ZEN_POND_BATHYMETRY_DEPTH_SEMANTIC,
    ZEN_POND_BATHYMETRY_FIELD_CONTRACT_ID,
    ZEN_POND_BATHYMETRY_FIELD_STORAGE,
    ZEN_POND_BATHYMETRY_FIELD_VERSION,
    ZEN_POND_BATHYMETRY_GRID_DEFAULTS,
    ZEN_POND_BATHYMETRY_MODEL_ID,
    ZEN_POND_BATHYMETRY_NAVIGABLE_DEPTH_FLOOR,
    validateZenPondBathymetryFieldContract,
} from '../../contracts/zenPondBathymetryContract.js';

const UINT16_MAX = 0xffff;
const FIELD_STATE = new WeakMap();

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smoothstep = (value) => {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
};

const hashString = (value) => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
};

const toHex32 = (value) => (value >>> 0).toString(16).padStart(8, '0');

const normalizePositiveFinite = (value, errorCode) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new Error(errorCode);
    }
    return Object.is(value, -0) ? 0 : value;
};

const normalizeGridDimension = (value, errorCode) => {
    if (!Number.isSafeInteger(value) || value < 2 || value > 1024) {
        throw new Error(errorCode);
    }
    return value;
};

const normalizeSeed = (value) => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            throw new Error('ZEN_POND_BATHYMETRY_SEED_INVALID');
        }
        return `string:${trimmed}`;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        const canonicalValue = Object.is(value, -0) ? 0 : value;
        return `number:${canonicalValue}`;
    }
    throw new Error('ZEN_POND_BATHYMETRY_SEED_INVALID');
};

const normalizeProfile = (value = ZEN_POND_BATHYMETRY_MODEL_ID) => {
    if (typeof value !== 'string') {
        throw new Error('ZEN_POND_BATHYMETRY_PROFILE_TYPE_INVALID');
    }
    const normalized = value.trim();
    if (normalized !== ZEN_POND_BATHYMETRY_MODEL_ID) {
        throw new Error(`ZEN_POND_BATHYMETRY_PROFILE_UNSUPPORTED:${normalized}`);
    }
    return normalized;
};

const normalizeFieldInput = (input) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new Error('ZEN_POND_BATHYMETRY_INPUT_INVALID');
    }
    const {
        worldWidth,
        worldHeight,
        columns = ZEN_POND_BATHYMETRY_GRID_DEFAULTS.columns,
        rows = ZEN_POND_BATHYMETRY_GRID_DEFAULTS.rows,
        seed,
        profile = ZEN_POND_BATHYMETRY_MODEL_ID,
    } = input;
    return Object.freeze({
        worldWidth: normalizePositiveFinite(
            worldWidth,
            'ZEN_POND_BATHYMETRY_WORLD_WIDTH_INVALID',
        ),
        worldHeight: normalizePositiveFinite(
            worldHeight,
            'ZEN_POND_BATHYMETRY_WORLD_HEIGHT_INVALID',
        ),
        columns: normalizeGridDimension(
            columns,
            'ZEN_POND_BATHYMETRY_COLUMNS_INVALID',
        ),
        rows: normalizeGridDimension(
            rows,
            'ZEN_POND_BATHYMETRY_ROWS_INVALID',
        ),
        seedToken: normalizeSeed(seed),
        profile: normalizeProfile(profile),
    });
};

const buildKeyFromConfig = (config) => [
    ZEN_POND_BATHYMETRY_FIELD_CONTRACT_ID,
    `version=${ZEN_POND_BATHYMETRY_FIELD_VERSION}`,
    `model=${config.profile}`,
    `semantic=${ZEN_POND_BATHYMETRY_DEPTH_SEMANTIC}`,
    `world=${config.worldWidth}x${config.worldHeight}`,
    `grid=${config.columns}x${config.rows}`,
    `seed=${encodeURIComponent(config.seedToken)}`,
].join('|');

const resolveSeedPhase = (seedHash, shift) =>
    (((seedHash >>> shift) & 0xff) / 255) * Math.PI * 2;

const generateDepthGrid = (config) => {
    const depths = new Uint16Array(config.columns * config.rows);
    const seedHash = hashString(`${config.seedToken}|${config.profile}`);
    const phaseA = resolveSeedPhase(seedHash, 0);
    const phaseB = resolveSeedPhase(seedHash, 8);
    const phaseC = resolveSeedPhase(seedHash, 16);
    const aspect = config.worldWidth / config.worldHeight;
    const aspectBias = Math.min(1.18, Math.max(0.82, Math.sqrt(aspect / (16 / 9))));
    let minDepth = 1;
    let maxDepth = 0;

    for (let row = 0; row < config.rows; row += 1) {
        const v = row / (config.rows - 1);
        const ny = (v * 2 - 1) * aspectBias;
        for (let column = 0; column < config.columns; column += 1) {
            const u = column / (config.columns - 1);
            const nx = (u * 2 - 1) / aspectBias;
            const radial = Math.sqrt(
                ((nx + 0.05 * Math.sin(phaseA)) / 1.05) ** 2
                + ((ny + 0.04 * Math.cos(phaseB)) / 0.96) ** 2,
            );
            const basin = smoothstep(1 - radial);
            const broadUndulation =
                Math.sin(u * Math.PI * 2.1 + phaseA) * 0.045
                + Math.cos(v * Math.PI * 2.4 + phaseB) * 0.035
                + Math.sin((u + v) * Math.PI * 3.2 + phaseC) * 0.025;
            const shelf = smoothstep(
                1 - Math.abs(ny + 0.18 + 0.08 * Math.sin(nx * 3 + phaseB)),
            ) * 0.055;
            // The renderer world is the navigable water crop, not a bank
            // polygon. Its shallowest shelf therefore remains below the
            // deepest canonical koi band; shoreline topology belongs to a
            // future explicit pond-boundary owner.
            const depth = clamp01(
                0.805
                + basin * 0.18
                + broadUndulation * 0.15
                + shelf * 0.25,
            );
            const quantized = Math.round(depth * UINT16_MAX);
            depths[row * config.columns + column] = quantized;
            const normalizedDepth = quantized / UINT16_MAX;
            minDepth = Math.min(minDepth, normalizedDepth);
            maxDepth = Math.max(maxDepth, normalizedDepth);
        }
    }

    return {
        depths,
        minDepth,
        maxDepth,
    };
};

const buildFingerprint = (key, depths) => {
    let hash = hashString(key);
    for (let index = 0; index < depths.length; index += 1) {
        const value = depths[index];
        hash ^= value & 0xff;
        hash = Math.imul(hash, 0x01000193);
        hash ^= value >>> 8;
        hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a32:${toHex32(hash)}`;
};

export const buildZenPondBathymetryFieldKey = (input) =>
    buildKeyFromConfig(normalizeFieldInput(input));

export const createZenPondBathymetryField = (input) => {
    const config = normalizeFieldInput(input);
    const key = buildKeyFromConfig(config);
    const {
        depths,
        minDepth,
        maxDepth,
    } = generateDepthGrid(config, key);
    const field = Object.freeze({
        contractId: ZEN_POND_BATHYMETRY_FIELD_CONTRACT_ID,
        version: ZEN_POND_BATHYMETRY_FIELD_VERSION,
        modelId: ZEN_POND_BATHYMETRY_MODEL_ID,
        depthSemantic: ZEN_POND_BATHYMETRY_DEPTH_SEMANTIC,
        storage: ZEN_POND_BATHYMETRY_FIELD_STORAGE,
        worldWidth: config.worldWidth,
        worldHeight: config.worldHeight,
        columns: config.columns,
        rows: config.rows,
        sampleCount: depths.length,
        key,
        fingerprint: buildFingerprint(key, depths),
        minDepth,
        maxDepth,
    });

    if (
        minDepth
        < ZEN_POND_BATHYMETRY_NAVIGABLE_DEPTH_FLOOR
    ) {
        throw new Error(
            'ZEN_POND_BATHYMETRY_NAVIGABLE_DEPTH_FLOOR_VIOLATED',
        );
    }
    validateZenPondBathymetryFieldContract(field);
    FIELD_STATE.set(field, { depths });
    return field;
};

export const requireZenPondBathymetryField = (value) => {
    const field = validateZenPondBathymetryFieldContract(value);
    if (!FIELD_STATE.has(field)) {
        throw new Error('ZEN_POND_BATHYMETRY_FIELD_AUTHORITY_INVALID');
    }
    return field;
};

const requireWorldCoordinate = (value, upperBound, axis) => {
    if (
        typeof value !== 'number'
        || !Number.isFinite(value)
        || value < 0
        || value > upperBound
    ) {
        throw new Error(`ZEN_POND_BATHYMETRY_SAMPLE_${axis}_INVALID`);
    }
    return value;
};

export const sampleZenPondBottomDepth = (fieldValue, worldX, worldY) => {
    const field = requireZenPondBathymetryField(fieldValue);
    const state = FIELD_STATE.get(field);
    const x = requireWorldCoordinate(worldX, field.worldWidth, 'X');
    const y = requireWorldCoordinate(worldY, field.worldHeight, 'Y');
    const gridX = (x / field.worldWidth) * (field.columns - 1);
    const gridY = (y / field.worldHeight) * (field.rows - 1);
    const x0 = Math.floor(gridX);
    const y0 = Math.floor(gridY);
    const x1 = Math.min(field.columns - 1, x0 + 1);
    const y1 = Math.min(field.rows - 1, y0 + 1);
    const tx = gridX - x0;
    const ty = gridY - y0;
    const topLeft = state.depths[y0 * field.columns + x0] / UINT16_MAX;
    const topRight = state.depths[y0 * field.columns + x1] / UINT16_MAX;
    const bottomLeft = state.depths[y1 * field.columns + x0] / UINT16_MAX;
    const bottomRight = state.depths[y1 * field.columns + x1] / UINT16_MAX;
    const top = topLeft + (topRight - topLeft) * tx;
    const bottom = bottomLeft + (bottomRight - bottomLeft) * tx;
    return top + (bottom - top) * ty;
};
