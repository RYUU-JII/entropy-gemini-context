import { Text, Texture } from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import { resolveZenFirstSiteKoiReveal, resolveZenFirstSiteKoiMaterialPresence } from '../../runtime/zenFirstSiteKoiReveal.js';
import {
    clamp as clampValue,
    wrapAngle,
} from '../../model/koi/koiMotion.js';
import {
    projectKoiShadowSurfacePoint,
    projectKoiVisualPoint,
    resolveKoiExpressionVisualScale,
    resolveKoiRenderContract,
    resolveKoiSpineRenderAngle,
} from '../../../../../../domains/nudge/koi/render/KoiRenderGeometry.js';
import { createPixiKoiDisplayObjects } from './koiFishDisplayObjects.js';
import { requireZenKoiMaterialWebGLVersion } from './zenKoiMaterialShaderDialect.js';
import { applyKoiFinTransform, resolveZenKoiTailSpriteRotation } from './pixiKoiFinPose.js';
import {
    applyZenKoiShadowSentinelPresentation,
    isZenKoiShadowSentinel,
    resolveZenShadowSentinelOpacity,
    ZEN_SHADOW_SENTINEL_RENDER_PROFILE,
} from './zenKoiShadowSentinelPresentation.js';

import {
    resolveKoiLightingVisuals,
    resolvePixiKoiSlotVisualProfile,
} from './koiFishVisuals.js';
import {
    applyPixiKoiMaterialVisuals,
    applyPixiKoiShadowAlpha,
    buildPixiKoiMaterialSignature,
    resolvePixiKoiNaturalShadowOpacity,
} from './koiFishMaterialExecutor.js';
import { buildVisualTuningSignature } from './koiTextureCache/keying.js';
import { tintZenKoiWaterMaterial } from './zenKoiWaterMaterial.js';
import {
    acquirePixiKoiBodyReceiverEffect,
    disposePixiKoiBodyReceiverEffects,
    syncPixiKoiBodyReceiverEffectTexture,
    syncPixiKoiBodyReceiverEffectTransform,
} from './pixiKoiBodyReceiverEffectLease.js';

export { resolvePixiKoiSlotVisualProfile } from './koiFishVisuals.js';
export {
    applyPixiKoiMaterialVisuals,
    buildPixiKoiMaterialSignature,
    resolvePixiKoiNaturalShadowOpacity,
} from './koiFishMaterialExecutor.js';
export { acquirePixiKoiBodyReceiverEffect };

// Keep the shared body/appendage geometry contract, while replacing its generic
// fixed shadow offset at the pond consumer boundary. Body and tail use this same
// receiver projection; the shared Nudge renderer keeps its own presentation.
export const resolvePixiKoiPondShadowSurface = (surface, projection) => {
    if (!surface?.anchor?.point || !Number.isFinite(projection?.offsetX)
        || !Number.isFinite(projection?.offsetY)) {
        throw new Error('ZEN_PIXI_KOI_POND_SHADOW_PROJECTION_REQUIRED');
    }
    return {
        ...surface,
        offset: { x: projection.offsetX, y: projection.offsetY },
    };
};

export function resolvePixiKoiUpdatePlan({
    shadowCadence = 1,
} = {}) {
    return {
        // Keep appendages locked to the body rope every rendered frame.
        updateAppendages: true,
        // Keep shadow geometry locked to the body rope every rendered frame.
        updateShadowGeometry: Number(shadowCadence) > 0,
    };
}

const toFiniteNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};
const KOI_VISUAL_TRANSFORM_EPSILON = 1e-4;

export const resolvePixiKoiExpressionVisualScale = resolveKoiExpressionVisualScale;
export const projectPixiKoiVisualPoint = projectKoiVisualPoint;

export const applyPixiKoiRopeVisualScale = (rope = null, anchor = null, scale = 1) => {
    if (!rope) return;
    const visualScale = clampValue(toFiniteNumber(scale, 1), 0.96, 1.18);
    const nextScale = Math.abs(visualScale - 1) <= KOI_VISUAL_TRANSFORM_EPSILON
        ? 1
        : visualScale;
    const positionX = toFiniteNumber(rope.position?.x, 0);
    const positionY = toFiniteNumber(rope.position?.y, 0);
    const pivotX = toFiniteNumber(rope.pivot?.x, 0);
    const pivotY = toFiniteNumber(rope.pivot?.y, 0);
    const currentScaleX = toFiniteNumber(rope.scale?.x, 1);
    const currentScaleY = toFiniteNumber(rope.scale?.y, 1);

    if (nextScale === 1) {
        if (
            (Math.abs(currentScaleX - 1) > KOI_VISUAL_TRANSFORM_EPSILON
                || Math.abs(currentScaleY - 1) > KOI_VISUAL_TRANSFORM_EPSILON)
            && rope.scale
            && typeof rope.scale.set === 'function'
        ) {
            rope.scale.set(1, 1);
        }
        if (
            (Math.abs(positionX - pivotX) > KOI_VISUAL_TRANSFORM_EPSILON
                || Math.abs(positionY - pivotY) > KOI_VISUAL_TRANSFORM_EPSILON)
            && rope.pivot
            && rope.position
            && typeof rope.pivot.set === 'function'
            && typeof rope.position.set === 'function'
        ) {
            rope.pivot.set(0, 0);
            rope.position.set(0, 0);
        }
        rope._zenKoiVisualTransformCache = {
            anchorX: toFiniteNumber(rope.pivot?.x, 0),
            anchorY: toFiniteNumber(rope.pivot?.y, 0),
            scale: 1,
        };
        return;
    }

    const anchorX = toFiniteNumber(anchor?.x, 0);
    const anchorY = toFiniteNumber(anchor?.y, 0);
    const cache = rope._zenKoiVisualTransformCache || null;
    const anchorChanged = (
        !cache
        || Math.abs(toFiniteNumber(cache.anchorX, 0) - anchorX) > KOI_VISUAL_TRANSFORM_EPSILON
        || Math.abs(toFiniteNumber(cache.anchorY, 0) - anchorY) > KOI_VISUAL_TRANSFORM_EPSILON
    );
    const scaleChanged = (
        !cache
        || Math.abs(toFiniteNumber(cache.scale, 1) - nextScale) > KOI_VISUAL_TRANSFORM_EPSILON
        || Math.abs(currentScaleX - nextScale) > KOI_VISUAL_TRANSFORM_EPSILON
        || Math.abs(currentScaleY - nextScale) > KOI_VISUAL_TRANSFORM_EPSILON
    );

    if (anchorChanged && rope.pivot && typeof rope.pivot.set === 'function') {
        rope.pivot.set(anchorX, anchorY);
    }
    if (anchorChanged && rope.position && typeof rope.position.set === 'function') {
        rope.position.set(anchorX, anchorY);
    }
    if (scaleChanged && rope.scale && typeof rope.scale.set === 'function') {
        rope.scale.set(nextScale, nextScale);
    }
    rope._zenKoiVisualTransformCache = {
        anchorX,
        anchorY,
        scale: nextScale,
    };
};

export const writePixiKoiBodyVisualTransform = (
    target,
    pixiFish,
) => {
    if (
        !target
        || typeof target !== 'object'
        || Array.isArray(target)
        || !Object.isExtensible(target)
        || Object.isFrozen(target)
    ) {
        throw new TypeError(
            'ZEN_PIXI_KOI_BODY_VISUAL_TRANSFORM_TARGET_INVALID',
        );
    }
    const snapshot =
        pixiFish?.bodyVisualTransformSnapshot;
    if (
        !snapshot
        || !Number.isFinite(snapshot.anchorX)
        || !Number.isFinite(snapshot.anchorY)
        || !Number.isFinite(snapshot.scale)
    ) {
        throw new Error(
            'ZEN_PIXI_KOI_BODY_VISUAL_TRANSFORM_MISSING',
        );
    }
    target.anchorX = snapshot.anchorX;
    target.anchorY = snapshot.anchorY;
    target.scale = snapshot.scale;
    return target;
};

const formatFixed = (value, digits = 2) => (
    toFiniteNumber(value, 0).toFixed(digits)
);

const formatPercent = (value) => (
    `${Math.round(clampValue(toFiniteNumber(value, 0), 0, 1) * 100)}%`
);

export function formatKoiDebugHudText(debugInfo = null) {
    if (!debugInfo || typeof debugInfo !== 'object') return '';
    const intentKind = debugInfo.intentKind || 'none';
    const microGoalPhase = debugInfo.microGoalPhase || 'none';
    const microGoalKind = debugInfo.microGoalKind || intentKind;
    const microGoalLabel = microGoalPhase === 'none'
        ? 'goal none'
        : `${microGoalKind}:${microGoalPhase} ${formatPercent(debugInfo.microGoalProgress)}`;
    return [
        `${intentKind} | ${microGoalLabel}`,
        `v ${formatFixed(debugInfo.speed)} th ${formatFixed(debugInfo.throttle)} hw ${formatFixed(debugInfo.intentHeadingWeight)}`,
    ].join('\n');
}


// The wrapper class that manages Pixi DisplayObjects for a single KoiFish simulation instance.
export class PixiKoiFish {
    constructor(fishInfo, textureCache, webGLVersion) {
        requireZenKoiMaterialWebGLVersion(webGLVersion);
        this.uid = fishInfo.uid;
        this.textureCache = textureCache;

        // Fetch or create the base textures from the cache
        const acquiredTextures = typeof textureCache?.acquire === 'function'
            ? textureCache.acquire(fishInfo)
            : null;
        this.textureKey = acquiredTextures?.key ?? this.resolveTextureKey(fishInfo);
        this.textures = acquiredTextures?.textures ?? textureCache.get(fishInfo);
        this.shadowTextureKey = null;
        this.shadowProfileSnapshot = null;
        this.hasShadowTexture = false;

        this.glowTexture = typeof textureCache?.acquireGlowTexture === 'function'
            ? textureCache.acquireGlowTexture()
            : null;

        Object.assign(this, createPixiKoiDisplayObjects({
            fishInfo,
            textures: this.textures,
            glowTexture: this.glowTexture,
            webGLVersion,
        }));
        this.shadowFinSources = [this.finMainL, this.finMainR, this.finSubL, this.finSubR];

        // State trackers
        this.focusBlend = 0;
        this.focusSelectedBlend = 0;
        this.focusLastTimeMs = null;
        this.lastHoverScale = 1.0;
        this.lastDepth = 0.0;
        this.smoothedSpine = [];
        this.bodyVisualTransformSnapshot = {
            anchorX: Number.NaN,
            anchorY: Number.NaN,
            scale: Number.NaN,
        };
        this.smoothedTailRotation = Number.NaN;
        this.finTransformScratch = {
            cfg: null,
            fishInfo: null,
            scaleRatio: 1,
            driveSide: 0,
            turnBlend: 0,
            driveAmpBoost: 0,
            opposingAmpMin: 1,
            driveSweep: 0,
            opposingFold: 0,
            opposingRecoveryFeather: 0,
            strokeRecoveryStart: 0.42,
            strokeRecoveryEnd: 0.82,
            appendagePose: null,
        };
        this.tailPoseHistory = [
            { x: 0, y: 0, angle: 0 },
            { x: 0, y: 0, angle: 0 },
            { x: 0, y: 0, angle: 0 },
        ];
        this.shadowSurfacePointScratch = { x: 0, y: 0, angle: 0 };
        this.shadowAnchorScratch = { x: 0, y: 0, angle: 0 };
        this.shadowTailPointScratch = { x: 0, y: 0, angle: 0 };
        this.materialSignature = '';
        this.shadowOpacityStateScratch = {};
        this.renderDiagnosticsScratch = {
            visible: false,
            materialSignatureChanged: false,
            materialWriteCount: 0,
            effectiveOpacity: 0,
            shadowRequested: false,
            shadowEnabled: false,
            shadowTextureAllocated: false,
            shadowGeometryUpdateCount: 0,
            shadowPointWriteCount: 0,
            shadowAlphaWriteCount: 0,
            shadowOpacity: 0,
            shadowOpacityState: null,
        };
        this.debugText = null;
    }

    ensureSmoothedSpine(history) {
        if (!Array.isArray(history) || history.length === 0) {
            this.smoothedSpine = [];
            return;
        }
        if (!Array.isArray(this.smoothedSpine) || this.smoothedSpine.length !== history.length) {
            this.smoothedSpine = history.map((point) => ({
                x: Number(point?.x) || 0,
                y: Number(point?.y) || 0,
                angle: resolveKoiSpineRenderAngle(point, 0),
            }));
            return;
        }
        for (let i = 0; i < history.length; i += 1) {
            const point = history[i];
            if (!this.smoothedSpine[i]) {
                this.smoothedSpine[i] = {
                    x: Number(point?.x) || 0,
                    y: Number(point?.y) || 0,
                    angle: resolveKoiSpineRenderAngle(point, 0),
                };
                continue;
            }
            this.smoothedSpine[i].angle = resolveKoiSpineRenderAngle(
                point,
                resolveKoiSpineRenderAngle(this.smoothedSpine[i], 0),
            );
        }
    }

    resolveTextureKey(fishInfo) {
        if (!this.textureCache || typeof this.textureCache.getKey !== 'function') return null;
        return this.textureCache.getKey(fishInfo);
    }

    captureTextureFieldSnapshot(fishInfo) {
        const source = fishInfo || {};
        return {
            baseSize: Number(source.baseSize) || 0,
            historyLength: Number(source.historyLength) || 0,
            colorBody: source.colorBody || '',
            colorPattern: source.colorPattern || '',
            colorSecondary: source.colorSecondary || '',
            colorAccent: source.colorAccent || '',
            colorFin: source.colorFin || '',
            colorTail: source.colorTail || '',
            paletteName: source.palette?.name || '',
            variant: source.variant || '',
            finStyle: source.finStyle || '',
            patternStyle: source.patternStyle || '',
            patternSignature: source.patternSignature || '',
            scaleType: source.scaleType || '',
            doitsuMode: source.doitsuMode || '',
            isGinrin: source.isGinrin ? 1 : 0,
            dynamicFaviconColors: source.dynamicFaviconColors ? 1 : 0,
            visualTuningSignature: buildVisualTuningSignature(source.tuning),
        };
    }

    hasTextureFieldChanged(fishInfo) {
        const nextSnapshot = this.captureTextureFieldSnapshot(fishInfo);
        const prevSnapshot = this.textureFieldSnapshot;
        if (!prevSnapshot) {
            this.textureFieldSnapshot = nextSnapshot;
            return true;
        }
        const changed = (
            nextSnapshot.baseSize !== prevSnapshot.baseSize
            || nextSnapshot.historyLength !== prevSnapshot.historyLength
            || nextSnapshot.colorBody !== prevSnapshot.colorBody
            || nextSnapshot.colorPattern !== prevSnapshot.colorPattern
            || nextSnapshot.colorSecondary !== prevSnapshot.colorSecondary
            || nextSnapshot.colorAccent !== prevSnapshot.colorAccent
            || nextSnapshot.colorFin !== prevSnapshot.colorFin
            || nextSnapshot.colorTail !== prevSnapshot.colorTail
            || nextSnapshot.paletteName !== prevSnapshot.paletteName
            || nextSnapshot.variant !== prevSnapshot.variant
            || nextSnapshot.finStyle !== prevSnapshot.finStyle
            || nextSnapshot.patternStyle !== prevSnapshot.patternStyle
            || nextSnapshot.patternSignature !== prevSnapshot.patternSignature
            || nextSnapshot.scaleType !== prevSnapshot.scaleType
            || nextSnapshot.doitsuMode !== prevSnapshot.doitsuMode
            || nextSnapshot.isGinrin !== prevSnapshot.isGinrin
            || nextSnapshot.dynamicFaviconColors !== prevSnapshot.dynamicFaviconColors
            || nextSnapshot.visualTuningSignature !== prevSnapshot.visualTuningSignature
        );
        if (changed) {
            this.textureFieldSnapshot = nextSnapshot;
        }
        return changed;
    }

    resolveShadowProfile(fishInfo) {
        if (isZenKoiShadowSentinel(fishInfo)) return ZEN_SHADOW_SENTINEL_RENDER_PROFILE;
        const source = fishInfo?.shadowRenderProfile || {};
        return {
            enabled: source.enabled !== false,
            blur: Math.max(0, Math.floor(Number(source.blur) || 0)),
            cadence: Math.max(0, Math.floor(Number(source.cadence) || 0)),
            opacity: (() => {
                const value = Number(source.opacity);
                return clampValue(Number.isFinite(value) ? value : 0.2, 0, 0.35);
            })(),
            scale: (() => {
                const value = Number(source.scale);
                return clampValue(Number.isFinite(value) ? value : 0.9, 0.7, 1.1);
            })(),
            includeFins: true,
        };
    }

    hasShadowProfileChanged(fishInfo) {
        const resolved = this.resolveShadowProfile(fishInfo);
        const nextSnapshot = {
            enabled: resolved.enabled ? 1 : 0,
            blur: resolved.blur,
            cadence: resolved.cadence,
            opacity: Math.round(resolved.opacity * 1000),
            scale: Math.round(resolved.scale * 1000),
            includeFins: resolved.includeFins ? 1 : 0,
        };
        const prevSnapshot = this.shadowProfileSnapshot;
        if (!prevSnapshot) {
            this.shadowProfileSnapshot = nextSnapshot;
            return true;
        }
        const changed = (
            nextSnapshot.enabled !== prevSnapshot.enabled
            || nextSnapshot.blur !== prevSnapshot.blur
            || nextSnapshot.cadence !== prevSnapshot.cadence
            || nextSnapshot.opacity !== prevSnapshot.opacity
            || nextSnapshot.scale !== prevSnapshot.scale
            || nextSnapshot.includeFins !== prevSnapshot.includeFins
        );
        if (changed) {
            this.shadowProfileSnapshot = nextSnapshot;
        }
        return changed;
    }

    refreshTextures(fishInfo, force = false) {
        if (!this.textureCache || typeof this.textureCache.get !== 'function') return;
        const previousKey = this.textureKey;
        const nextKey = this.resolveTextureKey(fishInfo);
        if (!force && nextKey === previousKey) return;

        let acquiredTextures = null;
        if (nextKey !== previousKey && typeof this.textureCache.acquire === 'function') {
            acquiredTextures = this.textureCache.acquire(fishInfo);
        }
        const nextTextures = acquiredTextures?.textures ?? this.textureCache.get(fishInfo);
        if (!nextTextures) return;

        this.textureKey = acquiredTextures?.key ?? nextKey;
        this.textures = nextTextures;

        if (nextTextures.body) {
            if (!this.hasShadowTexture) {
                this.shadowRope.texture = nextTextures.body;
            }
            this.bodyRope.texture = nextTextures.body;
            syncPixiKoiBodyReceiverEffectTexture(this);
        }

        if (nextTextures.finMain) {
            this.finMainL.texture = nextTextures.finMain;
            this.finMainR.texture = nextTextures.finMain;
        }

        if (nextTextures.finSub) {
            this.finSubL.texture = nextTextures.finSub;
            this.finSubR.texture = nextTextures.finSub;
        }

        if (nextTextures.tail) {
            this.tail.texture = nextTextures.tail;
        }
        this.tail.anchor.set(
            Number.isFinite(Number(nextTextures.tailAnchor?.x))
                ? Number(nextTextures.tailAnchor.x)
                : 0.5,
            Number.isFinite(Number(nextTextures.tailAnchor?.y))
                ? Number(nextTextures.tailAnchor.y)
                : 0.5,
        );

        this.bodyRope.setFormTexture(nextTextures.bodyForm);
        if (
            nextKey !== previousKey
            && typeof this.textureCache?.release === 'function'
            && previousKey
            && previousKey !== this.textureKey
        ) {
            this.textureCache.release(previousKey);
        }
    }

    refreshShadowTexture(fishInfo, resolvedProfile = this.resolveShadowProfile(fishInfo)) {
        const hasShadowTextureAccessor = typeof this.textureCache?.acquireShadow === 'function'
            || typeof this.textureCache?.getShadow === 'function';
        if (!this.textureCache || !hasShadowTextureAccessor) {
            return;
        }
        const previousKey = this.shadowTextureKey;
        const shouldEnable = resolvedProfile.enabled && resolvedProfile.cadence > 0;

        if (!shouldEnable) {
            this.shadowFins.visible = false;
            this.shadowRope.visible = false;
            this.shadowRope.alpha = 0;
            this.shadowTail.visible = false;
            this.shadowTail.alpha = 0;
            if (
                this.textures?.body
                && this.shadowRope.texture !== this.textures.body
            ) {
                this.shadowRope.texture = this.textures.body;
            }
            this.shadowTextureKey = null;
            this.hasShadowTexture = false;
            if (previousKey && typeof this.textureCache.releaseShadow === 'function') {
                this.textureCache.releaseShadow(
                    previousKey,
                    { evictUnused: true },
                );
            }
            return;
        }

        const expectedNextKey = typeof this.textureCache?.getShadowKey === 'function'
            ? this.textureCache.getShadowKey(fishInfo, resolvedProfile)
            : null;
        if (
            expectedNextKey
            && expectedNextKey === previousKey
            && this.hasShadowTexture
            && this.shadowRope.texture
        ) {
            return;
        }

        const acquiredShadow = typeof this.textureCache.acquireShadow === 'function'
            ? this.textureCache.acquireShadow(fishInfo, resolvedProfile)
            : {
                textures: {
                    shadow: this.textureCache.getShadow(fishInfo, resolvedProfile),
                },
                key: expectedNextKey,
            };
        const nextTexture = acquiredShadow?.textures?.shadow || null;
        if (!nextTexture) {
            if (acquiredShadow?.key && typeof this.textureCache.releaseShadow === 'function') {
                this.textureCache.releaseShadow(acquiredShadow.key);
            }
            this.hasShadowTexture = false;
            this.shadowTail.visible = false;
            this.shadowTail.alpha = 0;
            if (!previousKey) {
                this.shadowRope.visible = false;
                this.shadowRope.alpha = 0;
            }
            return;
        }
        const nextKey = acquiredShadow?.key || expectedNextKey;
        this.shadowRope.texture = nextTexture;
        this.shadowRope.visible = true;
        this.shadowFins.setAtlas(acquiredShadow.textures.shadowFins, acquiredShadow.textures.shadowFinFrames);
        const nextTailTexture = acquiredShadow?.textures?.shadowTail || null;
        if (nextTailTexture) {
            this.shadowTail.texture = nextTailTexture;
            this.shadowTail.anchor.set(
                Number.isFinite(Number(acquiredShadow?.textures?.shadowTailAnchor?.x))
                    ? Number(acquiredShadow.textures.shadowTailAnchor.x)
                    : 0.5,
                Number.isFinite(Number(acquiredShadow?.textures?.shadowTailAnchor?.y))
                    ? Number(acquiredShadow.textures.shadowTailAnchor.y)
                    : 0.5,
            );
            this.shadowTail.visible = true;
        } else {
            this.shadowTail.visible = false;
        }
        this.shadowTextureKey = nextKey;
        this.hasShadowTexture = true;
        if (nextKey !== previousKey && previousKey && typeof this.textureCache.releaseShadow === 'function') {
            this.textureCache.releaseShadow(previousKey);
        }
    }

    // Soft halo that eases in for hover and deepens when the fish is selected.
    updateFocusGlow(isSelected, isHovered, renderTimeMs, size, history, invitation = false, firstSiteReveal = 0, sharedLightState) {
        const glow = this.glowSprite;
        if (!glow) return;
        const nightDepth = sharedLightState?.nightDepth;
        if (!Number.isFinite(renderTimeMs) || renderTimeMs < 0
            || !Number.isFinite(nightDepth) || nightDepth < 0 || nightDepth > 1) {
            throw new Error('ZEN_KOI_FOCUS_CLOCK_AND_LIGHT_REQUIRED');
        }
        const deltaMs = this.focusLastTimeMs === null ? 0 : renderTimeMs - this.focusLastTimeMs;
        if (deltaMs < 0) throw new Error('ZEN_KOI_FOCUS_CLOCK_REVERSED');
        this.focusLastTimeMs = renderTimeMs;
        const target = Math.max(firstSiteReveal * 0.96,
            isSelected ? 1 : (isHovered ? (invitation ? 0.7 : 0.58) : (invitation ? 0.12 : 0)));
        // Use the existing renderer clock: 30/60/120 Hz share the same fade.
        const blendGain = 1 - Math.exp(-deltaMs / (target > this.focusBlend ? 140 : 190));
        this.focusBlend += (target - this.focusBlend) * blendGain;
        this.focusSelectedBlend += ((isSelected ? 1 : 0) - this.focusSelectedBlend)
            * (1 - Math.exp(-deltaMs / 180));
        if (target === 0 && this.focusBlend <= 0.004) {
            this.focusBlend = 0;
            this.focusSelectedBlend = 0;
            glow.alpha = 0;
            if (glow.visible) glow.visible = false;
            return;
        }
        const head = this.smoothedSpine?.[0] || history?.[0];
        const lastIdx = Math.max(0, (history?.length || 1) - 1);
        const tail = this.smoothedSpine?.[lastIdx] || history?.[lastIdx] || head;
        const headX = Number(head?.x) || 0;
        const headY = Number(head?.y) || 0;
        const tailX = Number(tail?.x) || headX;
        const tailY = Number(tail?.y) || headY;
        const spineLen = Math.hypot(headX - tailX, headY - tailY);
        const selectedLift = this.focusSelectedBlend;
        // The shadow sentinel keeps a restrained outline until approached.
        const radiusX = invitation
            ? size * 1.7 + spineLen * 0.25
            : spineLen * 0.5 + size * (1.20 + selectedLift * 0.16);
        const radiusY = invitation
            ? radiusX : size * (1.40 + selectedLift * 0.14) + spineLen * 0.10;
        const pulse = (0.985 + 0.015 * Math.sin(renderTimeMs * (invitation ? 0.00108 : 0.0016)))
            * (1 + 0.10 * Math.sin(firstSiteReveal * Math.PI));
        // smoothstep so the fade feels eased rather than linear
        const eased = this.focusBlend * this.focusBlend * (3 - 2 * this.focusBlend);
        glow.visible = true;
        glow.position.set((headX + tailX) * 0.5, (headY + tailY) * 0.5);
        glow.rotation = invitation ? 0 : Math.atan2(headY - tailY, headX - tailX);
        glow.scale.set(radiusX * pulse / 64, radiusY * pulse / 64);
        const red = Math.round(245 + (206 - 245) * nightDepth);
        const green = Math.round(235 + (222 - 235) * nightDepth);
        const blue = Math.round(211 + (239 - 211) * nightDepth);
        glow.tint = (red << 16) | (green << 8) | blue;
        const alphaBase = invitation ? 0.28 : 0.30 + 0.20 * Math.max(selectedLift, firstSiteReveal);
        glow.alpha = eased * alphaBase * pulse * (1 + nightDepth * 0.36);
    }

    ensureDebugText() {
        if (this.debugText) return this.debugText;
        const text = new Text('', {
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: 10,
            fill: 0xf7fbf0,
            stroke: 0x0b1614,
            strokeThickness: 3,
            lineHeight: 12,
            align: 'left',
        });
        text.visible = false;
        text.alpha = 0;
        text.resolution = 2;
        if (text.anchor && typeof text.anchor.set === 'function') {
            text.anchor.set(0, 1);
        }
        this.container.addChild(text);
        this.debugText = text;
        return text;
    }

    updateDebugOverlay(fishInfo, history, options = {}) {
        const enabled = options?.enabled === true;
        if (!enabled) {
            if (this.debugText) this.debugText.visible = false;
            return;
        }
        const text = this.ensureDebugText();
        const hudText = formatKoiDebugHudText(fishInfo?.debugInfo);
        if (!hudText) {
            text.visible = false;
            return;
        }
        const head = this.smoothedSpine?.[0] || history?.[0] || { x: fishInfo?.x, y: fishInfo?.y };
        const headX = toFiniteNumber(head?.x, toFiniteNumber(fishInfo?.x, 0));
        const headY = toFiniteNumber(head?.y, toFiniteNumber(fishInfo?.y, 0));
        const size = Math.max(1, toFiniteNumber(options?.size, fishInfo?.baseSize || 12));
        text.text = hudText;
        text.position.set(
            headX + Math.max(12, size * 0.72),
            headY - Math.max(18, size * 1.1),
        );
        text.alpha = options?.isSelected || options?.isHovered ? 0.94 : 0.66;
        text.visible = true;
    }

    prepareFirstSiteMaterial(fishInfo) {
        const receipt = fishInfo.firstSiteReveal;
        if (this.firstSiteMaterialReceipt !== receipt) {
            this.firstSiteTexturePreparation?.cancel();
            this.firstSiteTexturePreparation = null;
            this.firstSiteMaterialReceipt = receipt;
            this.firstSiteMaterialStartedAtMs = null;
        }
        if (this.firstSiteMaterialStartedAtMs === null) {
            if (this.firstSiteTexturePreparation
                && this.firstSiteTexturePreparation.key !== this.resolveTextureKey(fishInfo)) {
                this.firstSiteTexturePreparation.cancel();
                this.firstSiteTexturePreparation = null;
            }
            if (!this.firstSiteTexturePreparation) {
                this.firstSiteTexturePreparation = this.textureCache.prepare(fishInfo);
            }
            if (!this.firstSiteTexturePreparation.advance()) return 0;
            this.firstSiteTexturePreparation = null;
            this.firstSiteMaterialStartedAtMs = performance.now();
        }
        return resolveZenFirstSiteKoiMaterialPresence(this.firstSiteMaterialStartedAtMs);
    }

    update(fishInfo, frameCount, isSelected, isHovered, sharedLightState = null, updateOptions = null) {
        const shadowSentinel = isZenKoiShadowSentinel(fishInfo);
        const materialPresence = updateOptions?.firstSiteMaterialPresence ?? 1;
        const materialTransition = !shadowSentinel && materialPresence < 1;
        let materialSignatureChanged = false;
        let materialWriteCount = 0;
        let shadowGeometryUpdateCount = 0;
        let shadowPointWriteCount = 0;
        let shadowAlphaWriteCount = 0;
        let shadowOpacity = 0;
        let shadowOpacityState = null;
        const renderDiagnostics = this.renderDiagnosticsScratch;
        renderDiagnostics.firstSiteRevealProgress = 0;
        // Sync the SimpleRope points with the physics history
        const h = fishInfo.history;
        if (!h || h.length < 5) {
            this.container.visible = false;
            if (this.debugText) this.debugText.visible = false;
            renderDiagnostics.visible = false;
            renderDiagnostics.materialSignatureChanged = materialSignatureChanged;
            renderDiagnostics.materialWriteCount = materialWriteCount;
            renderDiagnostics.effectiveOpacity = 0;
            renderDiagnostics.shadowRequested = false;
            renderDiagnostics.shadowEnabled = false;
            renderDiagnostics.shadowTextureAllocated =
                this.hasShadowTexture;
            renderDiagnostics.shadowGeometryUpdateCount = 0;
            renderDiagnostics.shadowPointWriteCount = 0;
            renderDiagnostics.shadowAlphaWriteCount = shadowAlphaWriteCount;
            renderDiagnostics.shadowOpacity = shadowOpacity;
            renderDiagnostics.shadowOpacityState = shadowOpacityState;
            return renderDiagnostics;
        }
        this.container.visible = true;
        const naturalShadowProfile = this.resolveShadowProfile(fishInfo);
        const shadowProfile = materialTransition ? {
            ...naturalShadowProfile, enabled: true, cadence: 1,
            blur: 2 + (naturalShadowProfile.blur - 2) * materialPresence,
            scale: 1 + (naturalShadowProfile.scale - 1) * materialPresence,
        } : naturalShadowProfile;
        if (!this.firstSiteTexturePreparation && this.hasTextureFieldChanged(fishInfo)) {
            this.refreshTextures(fishInfo, true);
            this.refreshShadowTexture(fishInfo, shadowProfile);
        }
        const shadowProfileChanged = !this.firstSiteTexturePreparation && this.hasShadowProfileChanged(fishInfo);
        if (shadowProfileChanged || (this.lastMaterialPresence < 1 && materialPresence === 1)) {
            this.refreshShadowTexture(fishInfo, shadowProfile);
        } else if (!this.shadowRope.visible && shadowProfile.enabled && this.hasShadowTexture) {
            this.shadowRope.visible = true;
        }
        const updatePlan = resolvePixiKoiUpdatePlan({
            frameCount,
            shadowCadence: shadowProfile.cadence,
            forceFullUpdate: updateOptions?.forceFullUpdate,
            sceneCadenceProfile: updateOptions?.sceneCadenceProfile,
        });

        const slotVisualProfile = resolvePixiKoiSlotVisualProfile(fishInfo?.slot);
        const roleVisualBlend = isHovered || isSelected ? 0.7 : 1;
        const expressionVisualScale = resolvePixiKoiExpressionVisualScale(fishInfo);
        const bodyVisualScale = expressionVisualScale;
        const size = fishInfo.baseSize * fishInfo.hoverScale * expressionVisualScale;
        const bakedSize = Math.max(1, Number(this.textures?.size) || 1);
        const scaleRatio = (size * (1 + ((slotVisualProfile.scale || 1) - 1) * roleVisualBlend)) / bakedSize; // scale relative to baked texture
        let tailScaleX = scaleRatio;
        let tailScaleY = scaleRatio;
        const spineSnapDistance = Math.max(24, size * 1.9);
        const measuredSpeed = Math.max(0, Number(fishInfo.lastSpeed) || 0);
        const baseSpeedRef = Math.max(0.01, Number(fishInfo.baseSpeed) || 0.08);
        const speedNorm = clampValue(measuredSpeed / (baseSpeedRef * 3.2), 0, 1);
        const spineFollowGain = clampValue(0.9 + speedNorm * 0.08, 0.9, 0.98);
        this.ensureSmoothedSpine(h);
        const spineSnapDistanceSq = spineSnapDistance * spineSnapDistance;

        // Map the physics absolute world coordinates directly to the Rope points. 
        // We set the container's position to 0,0 and let the rope vertices dictate position.
        this.container.position.set(0, 0);

        for (let i = 0; i < h.length; i++) {
            const p = h[i];
            const smoothedPoint = this.smoothedSpine[i];
            if (smoothedPoint) {
                const dx = Number(p?.x) - smoothedPoint.x;
                const dy = Number(p?.y) - smoothedPoint.y;
                if (!Number.isFinite(dx) || !Number.isFinite(dy) || ((dx * dx) + (dy * dy)) > spineSnapDistanceSq) {
                    smoothedPoint.x = Number(p?.x) || 0;
                    smoothedPoint.y = Number(p?.y) || 0;
                    smoothedPoint.angle = resolveKoiSpineRenderAngle(p, resolveKoiSpineRenderAngle(smoothedPoint, 0));
                } else {
                    const followGain = spineFollowGain;
                    smoothedPoint.x += dx * followGain;
                    smoothedPoint.y += dy * followGain;
                    smoothedPoint.angle = resolveKoiSpineRenderAngle(p, resolveKoiSpineRenderAngle(smoothedPoint, 0));
                }
            }
        }
        const renderContract = resolveKoiRenderContract({
            adapter: fishInfo,
            history: h,
            renderSpine: this.smoothedSpine,
            size,
            visualScale: bodyVisualScale,
            shadowProfile,
            shadowOffsetScale: 0,
        });
        if (!renderContract) {
            this.container.visible = false;
            if (this.debugText) this.debugText.visible = false;
            renderDiagnostics.visible = false;
            renderDiagnostics.materialSignatureChanged = materialSignatureChanged;
            renderDiagnostics.materialWriteCount = materialWriteCount;
            renderDiagnostics.shadowRequested = (
                shadowProfile.enabled !== false
                && shadowProfile.cadence > 0
            );
            renderDiagnostics.shadowEnabled = false;
            renderDiagnostics.shadowTextureAllocated =
                this.hasShadowTexture;
            renderDiagnostics.shadowGeometryUpdateCount = 0;
            renderDiagnostics.shadowPointWriteCount = 0;
            renderDiagnostics.shadowAlphaWriteCount = shadowAlphaWriteCount;
            renderDiagnostics.shadowOpacity = shadowOpacity;
            renderDiagnostics.shadowOpacityState = shadowOpacityState;
            return renderDiagnostics;
        }
        const renderPose = renderContract.pose;
        const shadowSurface = shadowProfile.enabled && shadowProfile.cadence > 0
            ? resolvePixiKoiPondShadowSurface(
                renderContract.surfaces.shadow, updateOptions?.pondShadowProjection,
            )
            : null;

        for (let i = 0; i < h.length; i++) {
            const renderPoint = this.smoothedSpine[i] || h[i];
            if (this.ropePoints[i]) {
                // The geometry of the rope points is mapped such that
                // the distance between points dictates the texture stretching.
                this.ropePoints[i].set(renderPoint.x, renderPoint.y);
            }
            if (updatePlan.updateShadowGeometry && shadowProfile.enabled && shadowSurface && this.shadowPoints[i]) {
                const shadowPoint = projectKoiShadowSurfacePoint(
                    renderPoint,
                    shadowSurface,
                    this.shadowSurfacePointScratch,
                );
                this.shadowPoints[i].set(
                    Number(shadowPoint?.x) || 0,
                    Number(shadowPoint?.y) || 0,
                );
                shadowPointWriteCount += 1;
            }
        }
        shadowGeometryUpdateCount =
            shadowPointWriteCount > 0 ? 1 : 0;
        const bodyVisualAnchor = renderPose.anchor.point;
        this.bodyVisualTransformSnapshot.anchorX =
            toFiniteNumber(bodyVisualAnchor?.x, 0);
        this.bodyVisualTransformSnapshot.anchorY =
            toFiniteNumber(bodyVisualAnchor?.y, 0);
        this.bodyVisualTransformSnapshot.scale =
            bodyVisualScale;
        applyPixiKoiRopeVisualScale(this.bodyRope, bodyVisualAnchor, bodyVisualScale);
        this.bodyRope.setWorldLight(updateOptions.pondShadowLight);
        this.bodyRope.setWaterHaze(updateOptions.waterMaterial.haze);
        this.bodyRope.setMoonlightPresence(sharedLightState, fishInfo.depth);
        this.bodyRope.setCausticReceiver(updateOptions.koiCausticReceiver ?? null, fishInfo.depth, size);
        syncPixiKoiBodyReceiverEffectTransform(this);
        const shadowVisualAnchor = shadowSurface
            ? projectKoiShadowSurfacePoint(bodyVisualAnchor, shadowSurface, this.shadowAnchorScratch)
            : bodyVisualAnchor;
        applyPixiKoiRopeVisualScale(this.shadowRope, shadowVisualAnchor, bodyVisualScale);

        const firstSiteReveal = resolveZenFirstSiteKoiReveal(fishInfo);
        this.updateFocusGlow(
            isSelected,
            isHovered,
            updateOptions.renderTimeMs,
            size,
            h,
            fishInfo?.entityKind === 'invitation',
            firstSiteReveal,
            sharedLightState,
        );

        // The physics history remains canonical; visual size expands by scaling
        // body ropes and appendage anchors around the same spine point.

        const cfg = fishInfo.tuning || {};
        const pedunclePoint = renderPose.tail.pedunclePoint;
        const tipPoint = renderPose.tail.tipPoint;
        if (updatePlan.updateAppendages) {
            const pectoralPose = renderPose.appendages.pectoral;
            const ventralPose = renderPose.appendages.ventral;
            const turnThreshold = clampValue(cfg.pectoralTurnThreshold ?? 0.0018, 0, 0.08);
            const turnRateRef = Math.max(
                turnThreshold + 1e-6,
                clampValue(cfg.pectoralTurnRateRef ?? 0.078, 0.01, 0.35),
            );
            const turnAbs = Math.abs(fishInfo.turnRate || 0);
            const turnBlend = clampValue((turnAbs - turnThreshold) / Math.max(1e-6, turnRateRef - turnThreshold), 0, 1);
            const driveSide = fishInfo.turnRate > turnThreshold ? 1 : (fishInfo.turnRate < -turnThreshold ? -1 : 0);
            const driveAmpBoost = clampValue(cfg.pectoralDriveAmpBoost ?? 0.58, 0, 1.8);
            const opposingAmpMin = clampValue(cfg.pectoralOpposingAmpMin ?? 0.36, 0.05, 1.0);
            const driveSweep = clampValue(cfg.pectoralDriveSweep ?? 0.18, -0.8, 0.8);
            const opposingFold = clampValue(cfg.pectoralOpposingFold ?? 0.44, 0, 1.4);
            const opposingRecoveryFeather = clampValue(cfg.pectoralOpposingRecoveryFeather ?? 0.4, 0, 0.9);
            const strokeRecoveryStart = clampValue(
                Number.isFinite(cfg.pectoralStrokePowerEndPhase) ? cfg.pectoralStrokePowerEndPhase : 0.42,
                0.1,
                0.88,
            );
            const strokeRecoveryEnd = clampValue(
                Number.isFinite(cfg.pectoralStrokeRecoveryEndPhase) ? cfg.pectoralStrokeRecoveryEndPhase : 0.82,
                strokeRecoveryStart + 0.03,
                0.98,
            );

            const finContext = this.finTransformScratch;
            finContext.cfg = cfg;
            finContext.fishInfo = fishInfo;
            finContext.scaleRatio = scaleRatio;
            finContext.driveSide = driveSide;
            finContext.turnBlend = turnBlend;
            finContext.driveAmpBoost = driveAmpBoost;
            finContext.opposingAmpMin = opposingAmpMin;
            finContext.driveSweep = driveSweep;
            finContext.opposingFold = opposingFold;
            finContext.opposingRecoveryFeather = opposingRecoveryFeather;
            finContext.strokeRecoveryStart = strokeRecoveryStart;
            finContext.strokeRecoveryEnd = strokeRecoveryEnd;
            finContext.appendagePose = fishInfo.appendagePose || null;

            applyKoiFinTransform(
                this.finMainL,
                pectoralPose.point,
                pectoralPose.radius,
                true,
                -1,
                pectoralPose.bend,
                pectoralPose.index,
                finContext,
            );
            applyKoiFinTransform(
                this.finMainR,
                pectoralPose.point,
                pectoralPose.radius,
                true,
                1,
                pectoralPose.bend,
                pectoralPose.index,
                finContext,
            );
            applyKoiFinTransform(
                this.finSubL,
                ventralPose.point,
                ventralPose.radius,
                false,
                -1,
                ventralPose.bend,
                ventralPose.index,
                finContext,
            );
            applyKoiFinTransform(
                this.finSubR,
                ventralPose.point,
                ventralPose.radius,
                false,
                1,
                ventralPose.bend,
                ventralPose.index,
                finContext,
            );

            // Update Tail transform
            this.tail.position.set(pedunclePoint.x, pedunclePoint.y);

            // Tail rotation follows the same contract utility used by Canvas rendering.
            const rootPrevPoint = renderPose.tail.rootPrevPoint;
            const fallbackRootAngle = resolveKoiSpineRenderAngle(pedunclePoint, 0);
            const fallbackTipAngle = resolveKoiSpineRenderAngle(tipPoint, fallbackRootAngle);
            const tailPoseHistory = this.tailPoseHistory;
            tailPoseHistory[0].x = Number(rootPrevPoint?.x) || 0;
            tailPoseHistory[0].y = Number(rootPrevPoint?.y) || 0;
            tailPoseHistory[0].angle = fallbackRootAngle;
            tailPoseHistory[1].x = Number(pedunclePoint?.x) || 0;
            tailPoseHistory[1].y = Number(pedunclePoint?.y) || 0;
            tailPoseHistory[1].angle = fallbackRootAngle;
            tailPoseHistory[2].x = Number(tipPoint?.x) || 0;
            tailPoseHistory[2].y = Number(tipPoint?.y) || 0;
            tailPoseHistory[2].angle = fallbackTipAngle;
            const turnRate = fishInfo.turnRate || 0;
            const tailTurnAbs = Math.abs(turnRate);
            const bank = fishInfo.banking || 0;
            const targetTailRotation = resolveZenKoiTailSpriteRotation({
                history: tailPoseHistory,
                swimModel: cfg.physics?.swimModel,
                turnRate,
                bank,
                tailTurnSpreadGain: cfg.tailFinTurnSpreadGain ?? 0.45,
            });
            if (!Number.isFinite(this.smoothedTailRotation)) {
                this.smoothedTailRotation = targetTailRotation;
            }
            const tailSpeedNorm = clampValue(measuredSpeed / (baseSpeedRef * 3.2), 0, 1);
            const tailRotationFollow = clampValue(0.42 + tailTurnAbs * 26 + tailSpeedNorm * 0.16, 0.42, 0.86);
            this.smoothedTailRotation += wrapAngle(targetTailRotation - this.smoothedTailRotation) * tailRotationFollow;
            this.tail.rotation = this.smoothedTailRotation;
            const appendagePose = fishInfo.appendagePose?.model === 'continuous_body_v1'
                ? fishInfo.appendagePose
                : null;
            const tailFan = clampValue(Number(appendagePose?.tailFan) || 0, 0, 1);
            const tailFold = clampValue(Number(appendagePose?.tailFold) || 0, 0, 1);
            const tailKick = clampValue(Number(appendagePose?.tailKick) || 0, 0, 1);
            tailScaleX = scaleRatio * (1 - tailFold * 0.08 + tailKick * 0.025);
            tailScaleY = scaleRatio * (1 + tailFan * 0.16 - tailFold * 0.04);
            this.tail.scale.set(tailScaleX, tailScaleY);
        }

        const nextMaterialSignature = buildPixiKoiMaterialSignature({
            sharedLightState,
            fishInfo,
            slotVisualProfile,
            roleVisualBlend,
            waterMaterial: updateOptions.waterMaterial,
        });
        if (nextMaterialSignature !== this.materialSignature || updateOptions?.forceFullUpdate === true
            || materialTransition || this.lastMaterialPresence < 1) {
            const materialVisuals = resolveKoiLightingVisuals({
                sharedLightState,
                fishInfo,
                slotVisualProfile,
                roleVisualBlend,
            });
            materialVisuals.roleBaseTint = tintZenKoiWaterMaterial(materialVisuals.roleBaseTint, updateOptions.waterMaterial.pigmentGain);
            materialVisuals.roleHighlightTint = tintZenKoiWaterMaterial(materialVisuals.roleHighlightTint, updateOptions.waterMaterial.pigmentGain);
            const materialApplyResult = applyPixiKoiMaterialVisuals(this, materialVisuals);
            materialWriteCount = Number(materialApplyResult?.writeCount) || 0;
            materialSignatureChanged = true;
            this.materialSignature = nextMaterialSignature;
        }

        // Shadow Visibility Updates
        const shadowEnabled = (
            shadowProfile.enabled !== false
            && shadowProfile.cadence > 0
            && this.hasShadowTexture
        );
        if (shadowEnabled && !this.shadowRope.visible) {
            this.shadowRope.visible = true;
        } else if (!shadowEnabled && this.shadowRope.visible) {
            this.shadowRope.visible = false;
        }
        if (!shadowEnabled) {
            this.shadowTail.visible = false;
            this.shadowFins.visible = false;
        } else if (this.shadowTail.texture !== Texture.EMPTY) {
            this.shadowTail.visible = true;
        }

        if (shadowEnabled) {
            const penumbra = updateOptions.pondShadowProjection.penumbra;
            const softness = Math.hypot(penumbra, shadowProfile.blur * 0.22);
            this.shadowRope.setPenumbra(softness);
            this.shadowTail.setPenumbra(softness);
            this.shadowFins.setPenumbra(softness);
            shadowOpacityState = shadowSentinel ? null : resolvePixiKoiNaturalShadowOpacity({
                shadowProfile,
                slotVisualProfile,
                roleVisualBlend,
                sharedShadowLightState: updateOptions?.sharedFishShadowLighting,
                target: this.shadowOpacityStateScratch,
            });
            shadowOpacity = shadowSentinel
                ? resolveZenShadowSentinelOpacity(sharedLightState)
                : shadowOpacityState.opacity * updateOptions.waterMaterial.shadowTransmission;
            const finCastOpacity = !shadowSentinel && naturalShadowProfile.enabled && naturalShadowProfile.cadence > 0
                ? shadowOpacity * materialPresence : 0;
            if (materialTransition) {
                const naturalOpacity = naturalShadowProfile.enabled && naturalShadowProfile.cadence > 0 ? shadowOpacity : 0;
                shadowOpacity = resolveZenShadowSentinelOpacity(sharedLightState) * (1 - materialPresence)
                    + naturalOpacity * materialPresence;
            }
            const shadowAlphaApplyResult = applyPixiKoiShadowAlpha(this.shadowRope, this.shadowTail, shadowOpacity);
            this.shadowFins.alpha = finCastOpacity;
            this.shadowFins.visible = finCastOpacity > 0;
            if (this.shadowFins.visible) this.shadowFins.updatePose(this.shadowFinSources, shadowSurface);
            shadowAlphaWriteCount = Number(shadowAlphaApplyResult?.writeCount) || 0;
            const shadowPedunclePoint = shadowSurface
                ? projectKoiShadowSurfacePoint(
                    renderPose.tail.peduncleSourcePoint,
                    shadowSurface,
                    this.shadowTailPointScratch,
                )
                : pedunclePoint;
            const projectedShadowPedunclePoint = projectPixiKoiVisualPoint(
                shadowPedunclePoint,
                shadowVisualAnchor,
                bodyVisualScale,
            );
            this.shadowTail.position.set(
                Number(projectedShadowPedunclePoint?.x) || 0,
                Number(projectedShadowPedunclePoint?.y) || 0,
            );
            this.shadowTail.rotation = this.smoothedTailRotation;
            const shadowScaleRatio = scaleRatio
                * shadowProfile.scale
                * (1 + ((slotVisualProfile.shadowScale || 1) - 1) * roleVisualBlend);
            this.shadowTail.scale.set(
                shadowScaleRatio * (tailScaleX / Math.max(1e-6, scaleRatio)),
                shadowScaleRatio * (tailScaleY / Math.max(1e-6, scaleRatio)),
            );
        }

        applyZenKoiShadowSentinelPresentation(this, shadowSentinel, shadowOpacity, materialPresence);
        this.lastMaterialPresence = materialPresence;

        this.updateDebugOverlay(fishInfo, h, {
            enabled: updateOptions?.rendererDebugToggles?.koiIntentHudEnabled === true,
            size,
            isSelected,
            isHovered,
        });
        renderDiagnostics.visible = true;
        renderDiagnostics.shadowSentinel = shadowSentinel;
        renderDiagnostics.firstSiteRevealProgress = firstSiteReveal;
        renderDiagnostics.firstSiteMaterialPresence = materialPresence;
        renderDiagnostics.materialSignatureChanged = materialSignatureChanged;
        renderDiagnostics.materialWriteCount = materialWriteCount;
        renderDiagnostics.effectiveOpacity = clampValue(Number(this.container.alpha), 0, 1);
        renderDiagnostics.shadowRequested = (
            shadowProfile.enabled !== false
            && shadowProfile.cadence > 0
        );
        renderDiagnostics.shadowEnabled = shadowEnabled;
        renderDiagnostics.shadowTextureAllocated =
            this.hasShadowTexture;
        renderDiagnostics.shadowGeometryUpdateCount =
            shadowGeometryUpdateCount;
        renderDiagnostics.shadowPointWriteCount =
            shadowPointWriteCount;
        renderDiagnostics.shadowAlphaWriteCount = shadowAlphaWriteCount;
        renderDiagnostics.shadowOpacity = shadowOpacity;
        renderDiagnostics.shadowOpacityState = shadowOpacityState;
        return renderDiagnostics;
    }

    destroy() {
        this.firstSiteTexturePreparation?.cancel();
        disposePixiKoiBodyReceiverEffects(this);
        if (typeof this.textureCache?.release === 'function' && this.textureKey) {
            this.textureCache.release(this.textureKey);
            this.textureKey = null;
        }
        if (typeof this.textureCache?.releaseShadow === 'function' && this.shadowTextureKey) {
            this.textureCache.releaseShadow(this.shadowTextureKey);
            this.shadowTextureKey = null;
        }
        this.container.destroy({ children: true });
    }
}
