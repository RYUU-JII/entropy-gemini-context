export function resolveArtifactPanelSurface(controlSurface = null) {
  // The live artifact panel contract is intentionally narrow:
  // panels consume one dock surface and an optional master control.
  const dockModel = controlSurface?.dock || null;
  const masterModel = controlSurface?.master || null;

  return Object.freeze({
    dockModel,
    masterModel,
    showMasterToggle: !!masterModel && masterModel.visible !== false,
  });
}
