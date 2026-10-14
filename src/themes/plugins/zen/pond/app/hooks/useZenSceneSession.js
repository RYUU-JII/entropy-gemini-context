import { useCallback, useRef, useState } from 'react';
import { hashStringFNV1a } from '../../../shared/zenSeededRandom.js';
import {
    readSceneGenerationKey,
    writeSceneGenerationKey,
} from '../../storage/repositories/zenSessionRepository.js';

const hashSceneGenerationKey = (value) => hashStringFNV1a(value);

const resolveStoredSceneGenerationKey = () => {
    return readSceneGenerationKey();
};

const persistSceneGenerationKey = (key) => {
    writeSceneGenerationKey(key);
};

const useZenSceneSession = ({
    hardResetToken = 0,
    sceneGenerationKey = null,
} = {}) => {
    const explicitSceneGenerationKey = typeof sceneGenerationKey === 'string'
        ? sceneGenerationKey.trim()
        : '';
    if (sceneGenerationKey !== null && !explicitSceneGenerationKey) {
        throw new Error('ZEN_SCENE_GENERATION_KEY_OVERRIDE_INVALID');
    }
    const initialSceneGenerationKey = explicitSceneGenerationKey
        || resolveStoredSceneGenerationKey();
    const sceneGenerationKeyRef = useRef(initialSceneGenerationKey);
    const sessionSaltRef = useRef(hashSceneGenerationKey(initialSceneGenerationKey));
    const previousHardResetTokenRef = useRef(hardResetToken);
    const [sceneRerollRevision, setSceneRerollRevision] = useState(0);

    const rerollSceneState = useCallback(() => {
        const nextGenerationKey = `gen-${Math.floor(Math.random() * 0xffffffff).toString(16)}-${Date.now().toString(36)}`;
        persistSceneGenerationKey(nextGenerationKey);
        sceneGenerationKeyRef.current = nextGenerationKey;
        sessionSaltRef.current = hashSceneGenerationKey(nextGenerationKey);
        setSceneRerollRevision((prev) => prev + 1);
    }, []);

    return {
        sceneGenerationKeyRef,
        sessionSaltRef,
        previousHardResetTokenRef,
        sceneRerollRevision,
        rerollSceneState,
        hashSceneGenerationKey,
    };
};

export {
    useZenSceneSession,
};
