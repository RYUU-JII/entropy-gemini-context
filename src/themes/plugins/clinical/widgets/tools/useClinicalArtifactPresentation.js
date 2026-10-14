import { useArtifactRenderChannels } from '@/themes/core/tools/useArtifactRenderChannels.js';
import { useArtifactSvgIdScope } from '@/themes/core/artifacts/scene/useArtifactSvgIdScope.js';
import { ARTIFACT_RENDER_PIPELINE_VERSION } from '@/themes/core/tools/artifactRenderContext.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isRatio = value => Number.isFinite(value) && value >= 0 && value <= 1;

function requireClinicalArtifactContext(context, family, isEnabled) {
    if (!isRecord(context) || context.version !== ARTIFACT_RENDER_PIPELINE_VERSION
        || context.themeId !== 'clinical' || context.artifactId !== family) {
        throw new Error(`CLINICAL_ARTIFACT_CONTEXT_IDENTITY_INVALID:${family}`);
    }
    if (!isRecord(context.material) || !isRatio(context.material.visualWeight)
        || typeof context.material.signatureColor !== 'string' || !context.material.signatureColor.trim()
        || !isRecord(context.renderState) || typeof context.renderState.reducedMotion !== 'boolean'
        || !isRecord(context.motion?.budget) || typeof context.motion.budget.shouldAnimate !== 'boolean'
        || !['still', 'ambient', 'full'].includes(context.motion.budget.mode) || typeof isEnabled !== 'boolean') {
        throw new Error(`CLINICAL_ARTIFACT_RENDER_CHANNELS_INVALID:${family}`);
    }
    if (!isRecord(context.visualState) || !isRecord(context.visualState.children)) {
        throw new Error(`CLINICAL_ARTIFACT_CHILD_PROJECTION_REQUIRED:${family}`);
    }
}

function requireChildRatio(visualState, family, key) {
    const child = visualState.children[key];
    if (!isRecord(child) || typeof child.enabled !== 'boolean' || !isRatio(child.ratio)) {
        throw new Error(`CLINICAL_ARTIFACT_CHILD_PROJECTION_INVALID:${family}:${key}`);
    }
    return child.ratio;
}

// Presentation only: configuration, effective activity and preview remain with
// the Tools owner. The tab's canonical motion budget also owns retained parking.
export function useClinicalArtifactPresentation(family, {
    artifactRenderContext,
    isEnabled = true,
} = {}) {
    requireClinicalArtifactContext(artifactRenderContext, family, isEnabled);
    const channels = useArtifactRenderChannels({ artifactRenderContext });
    const ids = useArtifactSvgIdScope(`clinical-${family}`);
    const shouldAnimate = isEnabled && channels.shouldAnimateMotion && !channels.renderState.reducedMotion;

    return {
        channels,
        ids,
        shouldAnimate,
        weight: channels.visualWeight,
        childRatio: key => requireChildRatio(channels.visualState, family, key),
        // Every animated property has a scalar OFF posture supplied by its body.
        // No animation driver survives a parked/reduced/idle motion budget.
        loopProps: (animated, still, duration, delay = 0) => ({
            initial: still,
            animate: shouldAnimate ? animated : still,
            transition: shouldAnimate
                ? { duration, delay, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0, delay: 0, repeat: 0 },
        }),
    };
}
