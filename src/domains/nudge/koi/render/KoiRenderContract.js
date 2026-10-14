export function createKoiRenderFrameState({
  frameCount = 0,
  isSelected = false,
  isHovered = false,
  eyeFB = 0,
  eyeSP = 0,
  envState = null,
} = {}) {
  return {
    frameCount: Number(frameCount) || 0,
    isSelected: !!isSelected,
    isHovered: !!isHovered,
    eyeFB: Number(eyeFB) || 0,
    eyeSP: Number(eyeSP) || 0,
    envState: envState && typeof envState === 'object' ? envState : null,
  };
}

export function resolveKoiRenderPolicy(envState = null) {
  return envState?.renderPolicy && typeof envState.renderPolicy === 'object'
    ? envState.renderPolicy
    : null;
}
