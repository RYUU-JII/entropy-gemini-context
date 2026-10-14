import { useCallback, useEffect, useState } from 'react';
import {
    DEFAULT_ZEN_HOME_GARDEN_BED_MATERIAL_STYLE,
    requireZenHomeGardenBedMaterialStyle,
} from '../../model/bonsai/rendering/zenHomeGardenBedGeometry.js';
import {
    zenDevelopmentWorkspaceState,
} from '@zen-development-workspace-state-entry';

export const ZEN_CLASSIC_RENDER_MODE = Object.freeze({
    FULL: 'full',
    TRUNK_SANDBOX: 'trunk_sandbox',
});

const readDevelopmentViewState = (method, productionValue) => (
    zenDevelopmentWorkspaceState
        ? zenDevelopmentWorkspaceState[method]()
        : productionValue
);

export function toggleZenClassicRenderModeValue(currentValue) {
    return currentValue === ZEN_CLASSIC_RENDER_MODE.TRUNK_SANDBOX
        ? ZEN_CLASSIC_RENDER_MODE.FULL
        : ZEN_CLASSIC_RENDER_MODE.TRUNK_SANDBOX;
}

export function useZenClassicViewPreferences() {
    const [showInsight, setShowInsight] = useState(false);
    const [showAdvancedControls, setShowAdvancedControls] = useState(false);
    const [showBackboneDebug, setShowBackboneDebug] = useState(() => (
        readDevelopmentViewState('readClassicBackboneDebug', false)
    ));
    const [showBranchTierDebug, setShowBranchTierDebug] = useState(() => (
        readDevelopmentViewState('readClassicBranchTierDebug', false)
    ));
    const [renderMode, setRenderMode] = useState(() => (
        readDevelopmentViewState('readClassicRenderMode', ZEN_CLASSIC_RENDER_MODE.FULL)
    ));
    const [gardenBedMaterialStyle, setGardenBedMaterialStyle] = useState(
        DEFAULT_ZEN_HOME_GARDEN_BED_MATERIAL_STYLE,
    );

    useEffect(() => {
        zenDevelopmentWorkspaceState?.writeClassicBackboneDebug(showBackboneDebug);
    }, [showBackboneDebug]);

    useEffect(() => {
        zenDevelopmentWorkspaceState?.writeClassicBranchTierDebug(showBranchTierDebug);
    }, [showBranchTierDebug]);

    useEffect(() => {
        zenDevelopmentWorkspaceState?.writeClassicRenderMode(renderMode);
    }, [renderMode]);

    const handleToggleInsight = useCallback(() => {
        setShowInsight((prev) => !prev);
    }, []);

    const handleToggleAdvancedControls = useCallback(() => {
        setShowAdvancedControls((prev) => !prev);
    }, []);

    const handleToggleBackboneDebug = useCallback(() => {
        setShowBackboneDebug((prev) => !prev);
    }, []);

    const handleToggleBranchTierDebug = useCallback(() => {
        setShowBranchTierDebug((prev) => !prev);
    }, []);

    const handleToggleRenderMode = useCallback(() => {
        setRenderMode((prev) => toggleZenClassicRenderModeValue(prev));
    }, []);

    const handleGardenBedMaterialStyleChange = useCallback((styleId) => {
        setGardenBedMaterialStyle(requireZenHomeGardenBedMaterialStyle(styleId));
    }, []);

    return {
        showInsight,
        setShowInsight,
        showAdvancedControls,
        showBackboneDebug,
        showBranchTierDebug,
        renderMode,
        trunkSandboxMode: renderMode === ZEN_CLASSIC_RENDER_MODE.TRUNK_SANDBOX,
        gardenBedMaterialStyle,
        handleGardenBedMaterialStyleChange,
        handleToggleInsight,
        handleToggleAdvancedControls,
        handleToggleBackboneDebug,
        handleToggleBranchTierDebug,
        handleToggleRenderMode,
    };
}

export default useZenClassicViewPreferences;
