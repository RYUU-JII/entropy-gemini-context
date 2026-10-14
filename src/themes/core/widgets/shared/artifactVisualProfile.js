import { getToolsArtifactSurfacePolicy } from '../../toolsVisualPolicy.js';

export const getArtifactVisualProfile = ({ themeId, signatureColor, isActive = true }) => {
    const artifactSurface = getToolsArtifactSurfacePolicy(themeId);
    if (!artifactSurface || typeof artifactSurface !== 'object') {
        throw new Error(`[ArtifactVisualProfile] Theme '${themeId}' does not declare an artifact surface policy.`);
    }
    if (
        typeof artifactSurface.buildBackgroundStyle !== 'function'
        || typeof artifactSurface.buildMaterialOverlayStyle !== 'function'
    ) {
        throw new Error(`[ArtifactVisualProfile] Theme '${themeId}' declares an invalid artifact surface policy.`);
    }
    return {
        motionEase: artifactSurface.motionEase,
        pulseDuration: artifactSurface.pulseDuration,
        backgroundStyle: artifactSurface.buildBackgroundStyle({ signatureColor, isActive }),
        materialOverlayStyle: artifactSurface.buildMaterialOverlayStyle({ signatureColor, isActive }),
        particleColor: artifactSurface.particleColor,
    };
};
