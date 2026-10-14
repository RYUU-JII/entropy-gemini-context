import {
    STRUCTURE_MODE,
    validateStructureDepthForMode,
} from './ZenCoreConfig';
import {
    validateSakuraLatent,
} from './v2/SakuraLatentSchema';
import { compileSakuraPhenotypeFromLatent } from './v2/SakuraCompiler';
import ZenArtifactRepository, {
    ZEN_ARTIFACT_TYPE,
    ZEN_ARTIFACT_THEME_ID,
} from '@/platform/storage/themes/zen/ZenArtifactRepository.js';

const REPOSITORY_VERSION = 1;
const MAX_REPOSITORY_ENTRIES = 64;
const STRUCTURE_MODE_VALUES = new Set(Object.values(STRUCTURE_MODE));

const now = () => Date.now();

const warnRepository = (message, error = null) => {
    if (typeof console === 'undefined' || typeof console.warn !== 'function') {
        return;
    }
    if (error) {
        console.warn(`[BonsaiRepository] ${message}`, error);
        return;
    }
    console.warn(`[BonsaiRepository] ${message}`);
};

export const createBonsaiRepositoryError = (
    code,
    message,
    details = null,
    cause = null,
) => {
    const error = new Error(message);
    error.code = code;
    if (details && typeof details === 'object') {
        error.details = details;
    }
    if (cause) {
        error.cause = cause;
    }
    return error;
};

const createRepositoryValidationError = (
    code,
    message,
    details = null,
    cause = null,
) => createBonsaiRepositoryError(code, message, details, cause);

const normalizeTreeType = (treeType, { allowDefault = false } = {}) => {
    if (allowDefault && treeType === undefined) return 'sakura';
    if (treeType !== 'sakura') {
        throw createRepositoryValidationError(
            'BONSAI_REPOSITORY_TREE_TYPE_INVALID',
            "Bonsai repository entry.treeType must equal 'sakura'.",
            { value: treeType },
        );
    }
    return 'sakura';
};

const createEntryId = () => (
    `bonsai_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
);

const isPlainObject = (value) => (
    Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const requireRepositoryObject = (
    value,
    {
        code = 'BONSAI_REPOSITORY_INVALID',
        label = 'Bonsai repository payload',
        details = null,
    } = {},
) => {
    if (!isPlainObject(value)) {
        throw createRepositoryValidationError(
            code,
            `${label} must be a plain object.`,
            {
                ...(details && typeof details === 'object' ? details : {}),
                value,
            },
        );
    }
    return value;
};

const requireNonEmptyString = (
    value,
    {
        code = 'BONSAI_REPOSITORY_INVALID',
        label = 'Bonsai repository string field',
        details = null,
    } = {},
) => {
    if (typeof value !== 'string' || !value.trim()) {
        throw createRepositoryValidationError(
            code,
            `${label} must be a non-empty string.`,
            {
                ...(details && typeof details === 'object' ? details : {}),
                value,
            },
        );
    }
    return value.trim();
};

const requireMutationProfileGeneration = (options, {
    allowSetAsMain = false,
} = {}) => {
    if (!isPlainObject(options)) {
        throw createRepositoryValidationError(
            'BONSAI_REPOSITORY_MUTATION_OPTIONS_REQUIRED',
            'Bonsai repository mutation options are required.',
        );
    }
    const allowedKeys = allowSetAsMain
        ? new Set(['expectedProfileGeneration', 'setAsMain'])
        : new Set(['expectedProfileGeneration']);
    if (Object.keys(options).some((key) => !allowedKeys.has(key))) {
        throw createRepositoryValidationError(
            'BONSAI_REPOSITORY_MUTATION_OPTIONS_INVALID',
            'Bonsai repository mutation options contain unsupported fields.',
        );
    }
    if (
        !Object.prototype.hasOwnProperty.call(options, 'expectedProfileGeneration')
        || typeof options.expectedProfileGeneration !== 'string'
        || !options.expectedProfileGeneration
        || options.expectedProfileGeneration.trim() !== options.expectedProfileGeneration
    ) {
        throw createRepositoryValidationError(
            'BONSAI_REPOSITORY_EXPECTED_PROFILE_GENERATION_REQUIRED',
            'Bonsai repository mutations require an exact profile generation.',
        );
    }
    if (
        Object.prototype.hasOwnProperty.call(options, 'setAsMain')
        && typeof options.setAsMain !== 'boolean'
    ) {
        throw createRepositoryValidationError(
            'BONSAI_REPOSITORY_SET_AS_MAIN_INVALID',
            'Bonsai repository setAsMain must be boolean when provided.',
        );
    }
    return options.expectedProfileGeneration;
};

const requireInteger = (
    value,
    {
        code = 'BONSAI_REPOSITORY_INVALID',
        label = 'Bonsai repository integer field',
        min = null,
        details = null,
    } = {},
) => {
    const numeric = Number(value);
    if (!Number.isInteger(numeric)) {
        throw createRepositoryValidationError(
            code,
            `${label} must be an integer.`,
            {
                ...(details && typeof details === 'object' ? details : {}),
                value,
            },
        );
    }
    if (Number.isFinite(min) && numeric < min) {
        throw createRepositoryValidationError(
            code,
            `${label} must be greater than or equal to ${min}.`,
            {
                ...(details && typeof details === 'object' ? details : {}),
                value,
                min,
            },
        );
    }
    return numeric;
};

const normalizeOptionalLabel = (value, details = null) => {
    if (value === undefined || value === null) {
        return '';
    }
    if (typeof value !== 'string') {
        throw createRepositoryValidationError(
            'BONSAI_REPOSITORY_ENTRY_INVALID',
            'Bonsai repository entry.label must be a string when provided.',
            {
                ...(details && typeof details === 'object' ? details : {}),
                value,
            },
        );
    }
    return value.trim().slice(0, 80);
};

const normalizeOptionalScore = (value, details = null) => {
    if (value === undefined || value === null) {
        return null;
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
        throw createRepositoryValidationError(
            'BONSAI_REPOSITORY_ENTRY_INVALID',
            'Bonsai repository entry.score must be between 0 and 1 when provided.',
            {
                ...(details && typeof details === 'object' ? details : {}),
                value,
            },
        );
    }
    return numeric;
};

const normalizeOptionalPhenotypeSummary = (value, details = null) => {
    if (value === undefined || value === null) {
        return null;
    }
    const summary = requireRepositoryObject(value, {
        code: 'BONSAI_REPOSITORY_ENTRY_INVALID',
        label: 'Bonsai repository entry.phenotypeSummary',
        details,
    });
    const next = {};
    Object.entries(summary).forEach(([key, raw]) => {
        if (typeof key !== 'string' || !key.trim()) {
            throw createRepositoryValidationError(
                'BONSAI_REPOSITORY_ENTRY_INVALID',
                'Bonsai repository entry.phenotypeSummary keys must be non-empty strings.',
                {
                    ...(details && typeof details === 'object' ? details : {}),
                    key,
                },
            );
        }
        const numeric = Number(raw);
        if (!Number.isFinite(numeric)) {
            throw createRepositoryValidationError(
                'BONSAI_REPOSITORY_ENTRY_INVALID',
                `Bonsai repository entry.phenotypeSummary['${key}'] must be numeric.`,
                {
                    ...(details && typeof details === 'object' ? details : {}),
                    key,
                    value: raw,
                },
            );
        }
        next[key] = Number(numeric.toFixed(3));
    });
    return Object.keys(next).length ? next : null;
};

const requireTimestamp = (value, label, details = null) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
        throw createRepositoryValidationError(
            'BONSAI_REPOSITORY_ENTRY_INVALID',
            `${label} must be a non-negative number.`,
            {
                ...(details && typeof details === 'object' ? details : {}),
                value,
            },
        );
    }
    return Math.floor(numeric);
};

const resolveStructureMode = (value, details = null) => {
    if (typeof value !== 'string' || !STRUCTURE_MODE_VALUES.has(value)) {
        throw createRepositoryValidationError(
            'BONSAI_REPOSITORY_ENTRY_INVALID',
            `Bonsai repository entry.structureMode must be one of: ${Array.from(STRUCTURE_MODE_VALUES).join(', ')}.`,
            {
                ...(details && typeof details === 'object' ? details : {}),
                value,
            },
        );
    }
    return value;
};

const resolveEntryId = (value, { allowGenerate = false } = {}) => {
    if (typeof value === 'string' && value.trim()) {
        return value.trim();
    }
    if (allowGenerate) {
        return createEntryId();
    }
    throw createRepositoryValidationError(
        'BONSAI_REPOSITORY_ENTRY_INVALID',
        'Bonsai repository entry.id must be a non-empty string.',
        { value },
    );
};

const normalizeRepositoryEntry = (
    raw = {},
    {
        allowGenerateId = false,
        defaultSavedAt = null,
        defaultUpdatedAt = null,
        requireSchemaVersion = false,
        allowTreeTypeDefault = false,
    } = {},
) => {
    const entry = requireRepositoryObject(raw, {
        code: 'BONSAI_REPOSITORY_ENTRY_INVALID',
        label: 'Bonsai repository entry',
    });
    if (requireSchemaVersion && entry.schemaVersion !== REPOSITORY_VERSION) {
        throw createRepositoryValidationError(
            'BONSAI_REPOSITORY_ENTRY_VERSION_INVALID',
            `Bonsai repository entry.schemaVersion must equal ${REPOSITORY_VERSION}.`,
            { value: entry.schemaVersion },
        );
    }
    const treeType = normalizeTreeType(entry.treeType, {
        allowDefault: allowTreeTypeDefault,
    });
    const latent = validateSakuraLatent(entry.latent, {
        code: 'BONSAI_REPOSITORY_ENTRY_INVALID',
        label: 'Bonsai repository entry.latent',
    });
    const derivedPhenotype = compileSakuraPhenotypeFromLatent(latent);
    const seed = requireInteger(entry.seed, {
        code: 'BONSAI_REPOSITORY_ENTRY_INVALID',
        label: 'Bonsai repository entry.seed',
        min: 0,
    });
    const structureMode = resolveStructureMode(entry.structureMode, {
        field: 'structureMode',
    });
    const structureDepth = validateStructureDepthForMode(
        structureMode,
        entry.structureDepth,
        {
            storageKey: 'bonsai_repository_entry.structureDepth',
        },
    );
    const savedAt = entry.savedAt !== undefined || entry.createdAt !== undefined
        ? requireTimestamp(
            entry.savedAt ?? entry.createdAt,
            'Bonsai repository entry.savedAt',
        )
        : requireTimestamp(
            defaultSavedAt,
            'Bonsai repository entry.savedAt',
        );
    const updatedAt = entry.updatedAt !== undefined
        ? requireTimestamp(
            entry.updatedAt,
            'Bonsai repository entry.updatedAt',
        )
        : requireTimestamp(
            defaultUpdatedAt ?? savedAt,
            'Bonsai repository entry.updatedAt',
        );

    return {
        id: resolveEntryId(entry.id, { allowGenerate: allowGenerateId }),
        treeType,
        seed,
        latent,
        phenotype: derivedPhenotype,
        structureMode,
        structureDepth,
        score: normalizeOptionalScore(entry.score),
        phenotypeSummary: normalizeOptionalPhenotypeSummary(entry.phenotypeSummary),
        label: normalizeOptionalLabel(entry.label),
        source: entry.source === undefined
            ? 'manual'
            : requireNonEmptyString(entry.source, {
                code: 'BONSAI_REPOSITORY_ENTRY_INVALID',
                label: 'Bonsai repository entry.source',
            }),
        savedAt,
        updatedAt,
    };
};

const normalizeRepository = (raw = {}, { requireEntrySchemaVersion = false } = {}) => {
    const repository = requireRepositoryObject(raw, {
        code: 'BONSAI_REPOSITORY_INVALID',
        label: 'Bonsai repository',
    });
    const entriesRaw = repository.entries === undefined
        ? []
        : Array.isArray(repository.entries)
            ? repository.entries
            : (() => {
                throw createRepositoryValidationError(
                    'BONSAI_REPOSITORY_INVALID',
                    'Bonsai repository.entries must be an array.',
                    {
                        value: repository.entries,
                    },
                );
            })();
    const entries = entriesRaw
        .map((entry) => normalizeRepositoryEntry(entry, {
            requireSchemaVersion: requireEntrySchemaVersion,
        }))
        .sort((left, right) => (right.savedAt || 0) - (left.savedAt || 0))
        .slice(0, MAX_REPOSITORY_ENTRIES);
    const mainEntryId = repository.mainEntryId === undefined || repository.mainEntryId === null
        ? null
        : requireNonEmptyString(repository.mainEntryId, {
            code: 'BONSAI_REPOSITORY_INVALID',
            label: 'Bonsai repository.mainEntryId',
        });
    if (mainEntryId && !entries.some((entry) => entry.id === mainEntryId)) {
        throw createRepositoryValidationError(
            'BONSAI_REPOSITORY_INVALID',
            `Bonsai repository.mainEntryId '${mainEntryId}' does not match any stored entry.`,
            {
                mainEntryId,
            },
        );
    }

    return {
        version: REPOSITORY_VERSION,
        updatedAt: repository.updatedAt === undefined
            ? (entries[0]?.updatedAt || 0)
            : requireTimestamp(
                repository.updatedAt,
                'Bonsai repository.updatedAt',
            ),
        mainEntryId,
        entries,
    };
};

const toArtifactRecord = (entry = {}) => {
    return {
        id: entry.id,
        artifactType: ZEN_ARTIFACT_TYPE.BONSAI,
        themeId: ZEN_ARTIFACT_THEME_ID,
        label: entry.label,
        treeType: entry.treeType,
        seed: entry.seed,
        latent: entry.latent,
        structureMode: entry.structureMode,
        structureDepth: entry.structureDepth,
        score: entry.score,
        phenotypeSummary: entry.phenotypeSummary,
        source: entry.source,
        createdAt: entry.savedAt,
        updatedAt: entry.updatedAt,
        schemaVersion: REPOSITORY_VERSION,
    };
};

const createBonsaiRepositoryApi = ({
    artifactStore,
} = {}) => {
    const readStoreRepository = async () => {
        const collection = await artifactStore.readArtifactCollection({
            artifactType: ZEN_ARTIFACT_TYPE.BONSAI,
        });
        return normalizeRepository({
            entries: collection.entries,
            mainEntryId: collection.mainEntryId,
            updatedAt: collection.updatedAt,
        }, {
            requireEntrySchemaVersion: true,
        });
    };

    const readBonsaiRepository = async () => {
        return await readStoreRepository();
    };

    const writeBonsaiRepository = async (repository = {}, options = null) => {
        const expectedProfileGeneration = requireMutationProfileGeneration(options);
        const normalized = normalizeRepository({
            ...repository,
            updatedAt: now(),
        });

        try {
            await artifactStore.replaceArtifactCollectionForProfileGeneration({
                themeId: ZEN_ARTIFACT_THEME_ID,
                artifactType: ZEN_ARTIFACT_TYPE.BONSAI,
                records: normalized.entries.map((entry) => toArtifactRecord(entry)),
                mainEntryId: normalized.mainEntryId,
                updatedAt: normalized.updatedAt,
                expectedProfileGeneration,
            });
            return normalized;
        } catch (error) {
            warnRepository('Failed to write durable bonsai repository.', error);
            throw error;
        }
    };

    const getBonsaiRepositoryEntry = async (entryId, repository = null) => {
        if (typeof entryId !== 'string' || !entryId.trim()) {
            return null;
        }
        const resolvedRepository = repository || await readBonsaiRepository();
        return resolvedRepository.entries.find((entry) => entry.id === entryId) || null;
    };

    const getMainBonsaiRepositoryEntry = async (repository = null) => {
        const resolvedRepository = repository || await readBonsaiRepository();
        if (!resolvedRepository.mainEntryId) {
            return null;
        }
        return getBonsaiRepositoryEntry(resolvedRepository.mainEntryId, resolvedRepository);
    };

    return {
        readBonsaiRepository,
        writeBonsaiRepository,
        async saveBonsaiRepositoryEntry(payload = {}, options = {}) {
            const expectedProfileGeneration = requireMutationProfileGeneration(options, {
                allowSetAsMain: true,
            });
            const setAsMain = options.setAsMain === true;
            const repository = await readBonsaiRepository();
            const entry = normalizeRepositoryEntry(payload, {
                allowGenerateId: true,
                defaultSavedAt: payload?.savedAt ?? now(),
                defaultUpdatedAt: now(),
                allowTreeTypeDefault: true,
            });
            const entries = [
                entry,
                ...repository.entries.filter((existing) => existing.id !== entry.id),
            ].slice(0, MAX_REPOSITORY_ENTRIES);
            const nextMainEntryId = setAsMain
                ? entry.id
                : (entries.some((existing) => existing.id === repository.mainEntryId) ? repository.mainEntryId : null);
            const nextRepository = await writeBonsaiRepository({
                ...repository,
                entries,
                mainEntryId: nextMainEntryId,
            }, {
                expectedProfileGeneration,
            });
            return {
                entry,
                repository: nextRepository,
            };
        },
        async removeBonsaiRepositoryEntry(entryId, options = null) {
            const expectedProfileGeneration = requireMutationProfileGeneration(options);
            if (typeof entryId !== 'string' || !entryId.trim()) {
                return { removed: false, repository: await readBonsaiRepository() };
            }
            const repository = await readBonsaiRepository();
            const nextEntries = repository.entries.filter((entry) => entry.id !== entryId);
            if (nextEntries.length === repository.entries.length) {
                return { removed: false, repository };
            }
            const nextMainEntryId = repository.mainEntryId === entryId ? null : repository.mainEntryId;
            const nextRepository = await writeBonsaiRepository({
                ...repository,
                entries: nextEntries,
                mainEntryId: nextMainEntryId,
            }, {
                expectedProfileGeneration,
            });
            return {
                removed: true,
                repository: nextRepository,
            };
        },
        getBonsaiRepositoryEntry,
        getMainBonsaiRepositoryEntry,
        async setMainBonsaiRepositoryEntry(entryId, options = null) {
            const expectedProfileGeneration = requireMutationProfileGeneration(options);
            const repository = await readBonsaiRepository();
            const entry = await getBonsaiRepositoryEntry(entryId, repository);
            if (!entry) {
                return {
                    entry: null,
                    repository,
                };
            }
            const nextRepository = await writeBonsaiRepository({
                ...repository,
                mainEntryId: entry.id,
            }, {
                expectedProfileGeneration,
            });
            return {
                entry,
                repository: nextRepository,
            };
        },
    };
};

export const createBonsaiRepository = ({
    artifactStore = ZenArtifactRepository.getInstance(),
} = {}) => createBonsaiRepositoryApi({
    artifactStore,
});

export const readBonsaiRepository = async () => createBonsaiRepository().readBonsaiRepository();

export const writeBonsaiRepository = async (repository = {}, options = null) => (
    createBonsaiRepository().writeBonsaiRepository(repository, options)
);

export const saveBonsaiRepositoryEntry = async (payload = {}, options = {}) => (
    createBonsaiRepository().saveBonsaiRepositoryEntry(payload, options)
);

export const removeBonsaiRepositoryEntry = async (entryId, options = null) => (
    createBonsaiRepository().removeBonsaiRepositoryEntry(entryId, options)
);

export const getBonsaiRepositoryEntry = async (entryId, repository = null) => (
    createBonsaiRepository().getBonsaiRepositoryEntry(entryId, repository)
);

export const getMainBonsaiRepositoryEntry = async (repository = null) => (
    createBonsaiRepository().getMainBonsaiRepositoryEntry(repository)
);

export const setMainBonsaiRepositoryEntry = async (entryId, options = null) => (
    createBonsaiRepository().setMainBonsaiRepositoryEntry(entryId, options)
);
