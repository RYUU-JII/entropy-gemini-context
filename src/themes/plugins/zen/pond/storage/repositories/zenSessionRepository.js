import {
    readZenWorkspaceString,
    writeZenWorkspaceStorageItem,
} from '@/themes/plugins/zen/state/ZenProductionUiState.js';

const ZEN_SCENE_GENERATION_UI_STATE_KEY = 'zen_scene_generation_key_v1';

const createSceneGenerationKey = () => {
    return `gen-${Math.floor(Math.random() * 0xffffffff).toString(16)}-${Date.now().toString(36)}`;
};

const readSceneGenerationKey = () => {
    const stored = readZenWorkspaceString(ZEN_SCENE_GENERATION_UI_STATE_KEY, '');
    if (typeof stored === 'string' && stored.trim()) {
        return stored;
    }
    const created = createSceneGenerationKey();
    writeZenWorkspaceStorageItem(ZEN_SCENE_GENERATION_UI_STATE_KEY, created);
    return created;
};

const writeSceneGenerationKey = (key) => {
    const next = typeof key === 'string' && key.trim()
        ? key.trim()
        : createSceneGenerationKey();
    writeZenWorkspaceStorageItem(ZEN_SCENE_GENERATION_UI_STATE_KEY, next);
    return next;
};

export {
    createSceneGenerationKey,
    readSceneGenerationKey,
    writeSceneGenerationKey,
};
