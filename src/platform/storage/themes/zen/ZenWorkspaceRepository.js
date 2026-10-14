import {
    ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE,
    ZEN_CLASSIC_RENDER_MODE,
    ZEN_WORKSPACE_MODE,
    hasZenWorkspaceStorage,
    readZenWorkspaceBooleanFlag,
    readZenWorkspaceJson,
    readZenWorkspaceNumber,
    readZenWorkspaceStorageItem,
    readZenWorkspaceString,
    readZenVNextActiveSection,
    readZenVNextAutoCompareMaxRounds,
    readZenVNextAutoCompareStopReliability,
    readZenVNextFactors,
    readZenVNextReliabilityHint,
    readZenVNextSeed,
    removeZenWorkspaceStorageItem,
    resolveZenClassicExperimentalPotStyle,
    resolveZenClassicRenderMode,
    resolveZenWorkspaceMode,
    writeZenVNextActiveSection,
    writeZenVNextAutoCompareMaxRounds,
    writeZenVNextAutoCompareStopReliability,
    writeZenVNextFactors,
    writeZenVNextReliabilityHint,
    writeZenVNextSeed,
    writeZenWorkspaceJson,
    writeZenWorkspaceStorageItem,
    ZEN_WORKSPACE_STORAGE_KEYS,
} from './ZenWorkspaceStorage.js';

export class ZenWorkspaceRepository {
    static getInstance() {
        if (!ZenWorkspaceRepository.instance) {
            ZenWorkspaceRepository.instance = new ZenWorkspaceRepository();
        }
        return ZenWorkspaceRepository.instance;
    }

    hasStorage() {
        return hasZenWorkspaceStorage();
    }

    readItem(key, fallback = null) {
        return readZenWorkspaceStorageItem(key, fallback);
    }

    read(key, fallback = null) {
        return this.readItem(key, fallback);
    }

    readString(key, fallback = '') {
        return readZenWorkspaceString(key, fallback);
    }

    readNumber(key, fallback = 0) {
        return readZenWorkspaceNumber(key, fallback);
    }

    readBooleanFlag(key, options = {}) {
        return readZenWorkspaceBooleanFlag(key, options);
    }

    readJson(key, fallback = null) {
        return readZenWorkspaceJson(key, fallback);
    }

    writeItem(key, value) {
        return writeZenWorkspaceStorageItem(key, value);
    }

    write(key, value) {
        return this.writeItem(key, value);
    }

    writeJson(key, value) {
        return writeZenWorkspaceJson(key, value);
    }

    removeItem(key) {
        return removeZenWorkspaceStorageItem(key);
    }

    remove(key) {
        return this.removeItem(key);
    }

    readWorkspaceMode(fallback = ZEN_WORKSPACE_MODE.CLASSIC) {
        return resolveZenWorkspaceMode(
            this.readString(
                ZEN_WORKSPACE_STORAGE_KEYS.WORKSPACE_MODE,
                resolveZenWorkspaceMode(fallback),
            ),
        );
    }

    writeWorkspaceMode(mode) {
        return this.writeItem(
            ZEN_WORKSPACE_STORAGE_KEYS.WORKSPACE_MODE,
            resolveZenWorkspaceMode(mode),
        );
    }

    readClassicBackboneDebug(fallback = false) {
        return this.readBooleanFlag(
            ZEN_WORKSPACE_STORAGE_KEYS.BACKBONE_DEBUG,
            { fallback },
        );
    }

    writeClassicBackboneDebug(enabled) {
        return this.writeItem(
            ZEN_WORKSPACE_STORAGE_KEYS.BACKBONE_DEBUG,
            enabled ? '1' : '0',
        );
    }

    readClassicBranchTierDebug(fallback = false) {
        return this.readBooleanFlag(
            ZEN_WORKSPACE_STORAGE_KEYS.BRANCH_TIER_DEBUG,
            { fallback },
        );
    }

    writeClassicBranchTierDebug(enabled) {
        return this.writeItem(
            ZEN_WORKSPACE_STORAGE_KEYS.BRANCH_TIER_DEBUG,
            enabled ? '1' : '0',
        );
    }

    readClassicRenderMode(fallback = ZEN_CLASSIC_RENDER_MODE.FULL) {
        return resolveZenClassicRenderMode(
            this.readString(
                ZEN_WORKSPACE_STORAGE_KEYS.RENDER_MODE,
                resolveZenClassicRenderMode(fallback),
            ),
            fallback,
        );
    }

    writeClassicRenderMode(mode) {
        return this.writeItem(
            ZEN_WORKSPACE_STORAGE_KEYS.RENDER_MODE,
            resolveZenClassicRenderMode(mode),
        );
    }

    readClassicExperimentalPotStyle(
        fallback = ZEN_CLASSIC_EXPERIMENTAL_POT_STYLE.SHALLOW_WARM_STONE,
    ) {
        return resolveZenClassicExperimentalPotStyle(
            this.readString(
                ZEN_WORKSPACE_STORAGE_KEYS.EXPERIMENTAL_POT_STYLE,
                resolveZenClassicExperimentalPotStyle(fallback),
            ),
            fallback,
        );
    }

    writeClassicExperimentalPotStyle(styleId) {
        return this.writeItem(
            ZEN_WORKSPACE_STORAGE_KEYS.EXPERIMENTAL_POT_STYLE,
            resolveZenClassicExperimentalPotStyle(styleId),
        );
    }

    readVNextSeed() {
        return readZenVNextSeed();
    }

    writeVNextSeed(seed) {
        return writeZenVNextSeed(seed);
    }

    readVNextFactors() {
        return readZenVNextFactors();
    }

    writeVNextFactors(factors) {
        return writeZenVNextFactors(factors);
    }

    readVNextReliabilityHint() {
        return readZenVNextReliabilityHint();
    }

    writeVNextReliabilityHint(value) {
        return writeZenVNextReliabilityHint(value);
    }

    readVNextAutoCompareMaxRounds() {
        return readZenVNextAutoCompareMaxRounds();
    }

    writeVNextAutoCompareMaxRounds(value) {
        return writeZenVNextAutoCompareMaxRounds(value);
    }

    readVNextAutoCompareStopReliability() {
        return readZenVNextAutoCompareStopReliability();
    }

    writeVNextAutoCompareStopReliability(value) {
        return writeZenVNextAutoCompareStopReliability(value);
    }

    readVNextActiveSection() {
        return readZenVNextActiveSection();
    }

    writeVNextActiveSection(value) {
        return writeZenVNextActiveSection(value);
    }

    readSakuraV2RuntimeFlagsWorkspace(fallback = null) {
        return this.readJson(
            ZEN_WORKSPACE_STORAGE_KEYS.SAKURA_V2_RUNTIME_FLAGS,
            fallback,
        );
    }

    writeSakuraV2RuntimeFlagsWorkspace(payload) {
        return this.writeJson(
            ZEN_WORKSPACE_STORAGE_KEYS.SAKURA_V2_RUNTIME_FLAGS,
            payload,
        );
    }

    readSobolColdStartWorkspaceCache(fallback = null) {
        return this.readJson(
            ZEN_WORKSPACE_STORAGE_KEYS.SOBOL_COLD_START_CACHE,
            fallback,
        );
    }

    writeSobolColdStartWorkspaceCache(payload) {
        return this.writeJson(
            ZEN_WORKSPACE_STORAGE_KEYS.SOBOL_COLD_START_CACHE,
            payload,
        );
    }

    clearSobolColdStartWorkspaceCache() {
        return this.removeItem(ZEN_WORKSPACE_STORAGE_KEYS.SOBOL_COLD_START_CACHE);
    }

    readSceneGenerationWorkspaceKey(fallback = '') {
        return this.readString(
            ZEN_WORKSPACE_STORAGE_KEYS.SCENE_GENERATION_KEY,
            fallback,
        );
    }

    writeSceneGenerationWorkspaceKey(value) {
        return this.writeItem(
            ZEN_WORKSPACE_STORAGE_KEYS.SCENE_GENERATION_KEY,
            value,
        );
    }
}

export { ZEN_WORKSPACE_STORAGE_KEYS };
export default ZenWorkspaceRepository;
