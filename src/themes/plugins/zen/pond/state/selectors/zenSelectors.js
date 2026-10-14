export const selectZenSettingsSlice = (state) => ({
    tuning: state.tuning,
    siteKoiColorStrategy: state.siteKoiColorStrategy,
    visualProfile: state.visualProfile,
    setTuning: state.setTuning,
    resetTuning: state.resetTuning,
    setSiteKoiColorStrategy: state.setSiteKoiColorStrategy,
    setVisualProfile: state.setVisualProfile,
    patchVisualProfile: state.patchVisualProfile,
    resetVisualProfile: state.resetVisualProfile,
});

export const selectZenSessionSlice = (state) => ({
    sceneGenerationKey: state.sceneGenerationKey,
    hardResetToken: state.hardResetToken,
    hardResetStatus: state.hardResetStatus,
    hardResetError: state.hardResetError,
    sceneRerollRevision: state.sceneRerollRevision,
    rerollSceneGeneration: state.rerollSceneGeneration,
    requestHardReset: state.requestHardReset,
});

export const selectZenInteractionSlice = (state) => ({
    lockedTarget: state.lockedTarget,
    hoveredDomain: state.hoveredDomain,
    selectedFishUid: state.selectedFishUid,
    selectedFishIntentUid: state.selectedFishIntentUid,
    pointer: state.pointer,
    setLockedTarget: state.setLockedTarget,
    setHoveredDomain: state.setHoveredDomain,
    setSelectedFishUid: state.setSelectedFishUid,
    setSelectedFishIntentUid: state.setSelectedFishIntentUid,
    setPointer: state.setPointer,
});
