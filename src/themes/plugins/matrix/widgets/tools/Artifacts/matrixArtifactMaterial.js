export const MATRIX_ARTIFACT_OFF_MATERIAL = Object.freeze({
    edge: '#8dab94', innerEdge: '#63856c', face: '#0c1b11', caption: '#c7dbc9',
    metal: Object.freeze(['#d0dfd4', '#83a48d', '#3c5744', '#a1b8a7']),
});

// Readable unlit metal is independent of light emission and motion permission.
// Active instruments retain their existing pigments and animation targets.
export function getMatrixArtifactMaterial(isVisuallyActive) {
    if (typeof isVisuallyActive !== 'boolean') throw new Error('MATRIX_ARTIFACT_MATERIAL_STATE_REQUIRED');
    return {
        mode: isVisuallyActive ? 'lit' : 'unlit',
        edge: active => isVisuallyActive ? active : MATRIX_ARTIFACT_OFF_MATERIAL.edge,
        innerEdge: active => isVisuallyActive ? active : MATRIX_ARTIFACT_OFF_MATERIAL.innerEdge,
        face: active => isVisuallyActive ? active : MATRIX_ARTIFACT_OFF_MATERIAL.face,
        caption: active => isVisuallyActive ? active : MATRIX_ARTIFACT_OFF_MATERIAL.caption,
        metal: active => isVisuallyActive ? active : MATRIX_ARTIFACT_OFF_MATERIAL.metal,
    };
}
