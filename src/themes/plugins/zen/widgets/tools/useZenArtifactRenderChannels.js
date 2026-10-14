import { useArtifactRenderChannels } from '@/themes/core/tools/useArtifactRenderChannels.js';

export function useZenArtifactRenderChannels({
  artifactRenderContext = null,
  artifactRenderState = null,
  color = '',
  isActive = true,
} = {}) {
  return useArtifactRenderChannels({
    artifactRenderContext,
    artifactRenderState,
    color,
    isActive,
    systemMode: 'zen',
  });
}
