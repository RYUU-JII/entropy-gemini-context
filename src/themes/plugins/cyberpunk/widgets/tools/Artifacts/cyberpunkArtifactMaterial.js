export const CYBERPUNK_ARTIFACT_OFF_MATERIAL = Object.freeze({
    edge: '#9bb4d0', innerEdge: '#718aa8', face: '#0c1728', caption: '#ceddf0',
    metal: Object.freeze(['#c0d4e5', '#7897b5', '#35465f', '#9996bf']),
});

// The megacity instruments keep readable blue-violet alloy when unpowered.
// This surface paint never admits a coil, signal or retained animation loop.
export function getCyberpunkArtifactMaterial(isVisuallyActive) {
    if (typeof isVisuallyActive !== 'boolean') throw new Error('CYBERPUNK_ARTIFACT_MATERIAL_STATE_REQUIRED');
    return {
        mode: isVisuallyActive ? 'lit' : 'unlit',
        edge: active => isVisuallyActive ? active : CYBERPUNK_ARTIFACT_OFF_MATERIAL.edge,
        innerEdge: active => isVisuallyActive ? active : CYBERPUNK_ARTIFACT_OFF_MATERIAL.innerEdge,
        face: active => isVisuallyActive ? active : CYBERPUNK_ARTIFACT_OFF_MATERIAL.face,
        caption: active => isVisuallyActive ? active : CYBERPUNK_ARTIFACT_OFF_MATERIAL.caption,
        metal: active => isVisuallyActive ? active : CYBERPUNK_ARTIFACT_OFF_MATERIAL.metal,
    };
}
