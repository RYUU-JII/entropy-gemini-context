const EMPTY_POINT = Object.freeze({ x: 0, y: 0 });

function toScreenPoint(value, fallback = EMPTY_POINT) {
  if (!value || typeof value !== 'object') {
    return { ...fallback };
  }
  return {
    x: Number.isFinite(value.x) ? value.x : fallback.x,
    y: Number.isFinite(value.y) ? value.y : fallback.y,
  };
}

export function buildArtifactGallerySelection(selectionBase, sceneRuntime, { rendererProps, canvasProps }) {
  if (!selectionBase) return null;

  const hasCanvasMetrics = !!sceneRuntime?.hasViewport;
  const artifactAnchorScreen = toScreenPoint(sceneRuntime?.anchors?.artifactAnchor?.screen);
  const artifactScreen = toScreenPoint(sceneRuntime?.artifact?.screen, artifactAnchorScreen);
  const artifactOffsetScreen = {
    x: artifactScreen.x - artifactAnchorScreen.x,
    y: artifactScreen.y - artifactAnchorScreen.y,
  };

  return {
    key: selectionBase.key,
    identityKey: selectionBase.identityKey,
    usesCustomArtifactCanvas: selectionBase.usesCustomArtifactCanvas,
    ActiveArtifactCanvas: selectionBase.ActiveArtifactCanvas,
    ActiveArtifactPanel: selectionBase.ActiveArtifactPanel,
    artifactAnchorScreen,
    artifactOffsetScreen,
    hasCanvasMetrics,
    runtime: sceneRuntime,
    artifactTheme: selectionBase.artifactTheme,
    groundPolicy: canvasProps.groundPolicy,
    isArtifactActive: selectionBase.isArtifactActive,
    rendererProps,
    canvasProps,
    panelProps: selectionBase.panelProps,
  };
}
