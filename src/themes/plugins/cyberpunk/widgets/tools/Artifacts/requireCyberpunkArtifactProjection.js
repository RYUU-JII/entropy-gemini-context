import { ARTIFACT_RENDER_PIPELINE_VERSION } from '@/themes/core/tools/artifactRenderContext.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isRatio = value => Number.isFinite(value) && value >= 0 && value <= 1;

// Configuration remains an owner-supplied posture, separate from runtime work.
export function requireCyberpunkArtifactProjection(context, family) {
    if (!isRecord(context) || context.version !== ARTIFACT_RENDER_PIPELINE_VERSION
        || context.themeId !== 'cyberpunk' || context.artifactId !== family) {
        throw new Error(`CYBERPUNK_ARTIFACT_CONTEXT_IDENTITY_INVALID:${family}`);
    }
    if (!isRecord(context.material) || !isRatio(context.material.visualWeight)
        || typeof context.material.signatureColor !== 'string' || !context.material.signatureColor.trim()
        || !isRecord(context.renderState) || typeof context.renderState.reducedMotion !== 'boolean'
        || !isRecord(context.motion?.budget) || typeof context.motion.budget.shouldAnimate !== 'boolean') {
        throw new Error(`CYBERPUNK_ARTIFACT_RENDER_CHANNELS_INVALID:${family}`);
    }
    if (!isRecord(context.visualState) || !isRecord(context.visualState.children)) {
        throw new Error(`CYBERPUNK_ARTIFACT_CHILD_PROJECTION_REQUIRED:${family}`);
    }
    return key => {
        const child = context.visualState.children[key];
        if (!isRecord(child) || typeof child.enabled !== 'boolean' || !isRatio(child.ratio)) {
            throw new Error(`CYBERPUNK_ARTIFACT_CHILD_PROJECTION_INVALID:${family}:${key}`);
        }
        return child.ratio;
    };
}
