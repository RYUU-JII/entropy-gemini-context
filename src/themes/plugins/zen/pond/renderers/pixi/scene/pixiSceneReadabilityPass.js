import { clamp as clampValue } from '../../../model/koi/koiMotion.js';
export const updateSceneReadabilityPass = ({
    fishContainer,
    lilyPadsContainer,
    waterLilyBloomsContainer,
    zenIrisClustersContainer,
    rocksContainer,
    waterBenthicContainer,
    ripplesContainer,
    frameChannels,
    sceneReadabilityAlpha,
}) => {
    if (!frameChannels || typeof frameChannels !== 'object') return;
    const sceneBrightnessRaw = Number(frameChannels.sceneBrightness);
    const sceneBrightness = Number.isFinite(sceneBrightnessRaw) ? sceneBrightnessRaw : 0.5;
    const sceneBottomVisibility = clampValue(Number(frameChannels.bottomVisibility), 0, 1);
    fishContainer.alpha = sceneReadabilityAlpha.fish;
    lilyPadsContainer.alpha = sceneReadabilityAlpha.lilyPads;
    waterLilyBloomsContainer.alpha = sceneReadabilityAlpha.waterLilyBlooms;
    zenIrisClustersContainer.alpha = sceneReadabilityAlpha.zenIrisClusters;
    rocksContainer.alpha = 1;
    waterBenthicContainer.alpha = clampValue(
        sceneReadabilityAlpha.waterBenthic
        * (0.26 + sceneBrightness * 0.44 + sceneBottomVisibility * 0.3),
        0,
        sceneReadabilityAlpha.waterBenthic,
    );
    ripplesContainer.alpha = sceneReadabilityAlpha.ripples;
};
