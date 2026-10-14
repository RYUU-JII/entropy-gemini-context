import { requireZenPetalAppearance } from '../../../../runtime/petals/zenPetalMaterial.js';
import {
  Container,
  Sprite,
} from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import { clamp as clampValue } from '../../../model/koi/koiMotion.js';
import { removeMissingFromPool, resolveArray } from '../pixiSceneHelpers.js';
import { PETAL_BASE_SIZE } from '../pixiSceneTextureFactories.js';
import { ZEN_SURFACE_DISTURBANCE_SOURCES } from '../../../runtime/surface/zenSurfaceDisturbance.js';

const AMBIENT_VIEWPORT_CULL_PADDING = 64;
const TAP_RING_PHASE_FREQUENCY = 2.28;
const TAP_RING_SPACING_PER_WIDTH = (Math.PI * 2) / TAP_RING_PHASE_FREQUENCY;

const resolveViewportBounds = (visibleWorldBounds) => {
    if (!visibleWorldBounds || typeof visibleWorldBounds !== 'object') return null;
    const x = Number(visibleWorldBounds.x);
    const y = Number(visibleWorldBounds.y);
    const width = Number(visibleWorldBounds.width);
    const height = Number(visibleWorldBounds.height);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
        return null;
    }
    if (width <= 0 || height <= 0) return null;
    return { x, y, width, height };
};

const intersectsViewportBounds = ({
    x,
    y,
    radius = 0,
    visibleWorldBounds = null,
    padding = AMBIENT_VIEWPORT_CULL_PADDING,
} = {}) => {
    const viewportBounds = resolveViewportBounds(visibleWorldBounds);
    if (!viewportBounds) return true;
    const centerX = Number(x) || 0;
    const centerY = Number(y) || 0;
    const safeRadius = Math.max(0, Number(radius) || 0) + Math.max(0, Number(padding) || 0);
    return (
        centerX + safeRadius >= viewportBounds.x
        && centerX - safeRadius <= viewportBounds.x + viewportBounds.width
        && centerY + safeRadius >= viewportBounds.y
        && centerY - safeRadius <= viewportBounds.y + viewportBounds.height
    );
};

const syncParticles = ({
    particlesRef,
    particlePool,
    particlesContainer,
    getParticleTextureRecord,
    aliveSet = null,
    visibleWorldBounds = null,
}) => {
    const particles = resolveArray(particlesRef);
    const aliveParticles = aliveSet || new Set();
    aliveParticles.clear();
    for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];
        if (!particle) continue;
        aliveParticles.add(particle);

        const colorKey = typeof particle.color === 'string' ? particle.color : '197,214,222';
        const x = Number(particle.x) || 0;
        const y = Number(particle.y) || 0;
        const particleSize = Number(particle.size) || 0.4;
        let entry = particlePool.get(particle);
        if (!intersectsViewportBounds({
            x,
            y,
            radius: particleSize * 2,
            visibleWorldBounds,
        })) {
            if (entry?.sprite) {
                entry.sprite.visible = false;
            }
            continue;
        }
        if (!entry) {
            const textureRecord = getParticleTextureRecord(colorKey);
            const sprite = new Sprite(textureRecord.texture);
            sprite.anchor.set(0.5, 0.5);
            entry = { sprite, textureRecord, colorKey };
            particlePool.set(particle, entry);
            particlesContainer.addChild(sprite);
        } else if (entry.colorKey !== colorKey) {
            entry.colorKey = colorKey;
            entry.textureRecord = getParticleTextureRecord(colorKey);
            entry.sprite.texture = entry.textureRecord.texture;
        }

        const fade = Math.sin((Number(particle.life) / Math.max(1, Number(particle.maxLife))) * Math.PI);
        const fadeMix = 0.28 + Math.max(0, fade) * 0.72;
        const alpha = clampValue((Number(particle.opacity) || 0) * fadeMix * 1.28, 0, 1);
        const scale = Math.max(0.04, (particleSize * 1.16) / entry.textureRecord.baseRadius);
        entry.sprite.visible = alpha > 0.001;
        if (entry.sprite.visible) {
            entry.sprite.position.set(x, y);
            entry.sprite.scale.set(scale);
            entry.sprite.alpha = alpha;
        }
    }
    removeMissingFromPool(particlePool, aliveParticles, (entry) => {
        entry.sprite.parent?.removeChild(entry.sprite);
        entry.sprite.destroy();
    });
};

const resolveRingRippleVisual = (disturbance) => {
    const source = disturbance?.source;
    if (disturbance.selectionCue === true) {
        return { opacity: 0.14, lineWidth: 1.05, secondaryOffsetPx: 0 };
    }
    if (source === ZEN_SURFACE_DISTURBANCE_SOURCES.KOI_WAKE) {
        return { opacity: 0.12, lineWidth: 1.05, secondaryOffsetPx: 0 };
    }
    if (source === ZEN_SURFACE_DISTURBANCE_SOURCES.PETAL) {
        return { opacity: 0.1, lineWidth: 0.9, secondaryOffsetPx: 0 };
    }
    const widthPx = Number(disturbance?.widthPx);
    if (!Number.isFinite(widthPx) || widthPx <= 0) {
        throw new Error('ZEN_TAP_RIPPLE_WIDTH_INVALID');
    }
    return {
        opacity: 0.18,
        lineWidth: 1.35,
        // Match the next crest in the surface-field wave packet. As width
        // disperses, the visible rings separate instead of staying locked.
        secondaryOffsetPx: widthPx * TAP_RING_SPACING_PER_WIDTH,
    };
};

const smoothstep01 = (value) => {
    const progress = clampValue(Number(value) || 0, 0, 1);
    return progress * progress * (3 - 2 * progress);
};

const resolveStaggeredTapRippleAlpha = ({
    disturbance,
    visual,
    radius,
    radiusSecondary,
}) => {
    const amplitudeRatio = clampValue(Number(disturbance?.life) || 0, 0, 1);
    const maxRadius = Math.max(radius, Number(disturbance?.maxRadiusPx) || radius);
    const progress = clampValue(radius / maxRadius, 0, 1);
    // Opacity follows the physical amplitude envelope. The small perceptual
    // exponent keeps the weakened final crest readable without flattening the
    // continuous energy loss produced by the disturbance simulation.
    const energyAlpha = Math.pow(amplitudeRatio, 0.82) * visual.opacity;

    // The leading ring releases first. The trailing ring enters softly and
    // carries the final beat so the whole packet does not vanish in one frame.
    const primaryRelease = smoothstep01((progress - 0.54) / 0.3);
    const secondaryArrival = smoothstep01(radiusSecondary / 8);

    return {
        primary: energyAlpha * (1 - primaryRelease),
        secondary:
            energyAlpha
            * 0.48
            * secondaryArrival,
    };
};

const syncRingRippleProjection = ({
    surfaceDisturbancesRef,
    ripplePool,
    ripplesContainer,
    getRingTextureRecord,
    aliveSet = null,
    visibleWorldBounds = null,
    nightDepth,
}) => {
    const disturbances = resolveArray(surfaceDisturbancesRef);
    const aliveRipples = aliveSet || new Set();
    aliveRipples.clear();
    for (let i = 0; i < disturbances.length; i += 1) {
        const disturbance = disturbances[i];
        if (!disturbance) continue;
        aliveRipples.add(disturbance);

        let entry = ripplePool.get(disturbance);
        const visual = resolveRingRippleVisual(disturbance);
        let tint = 0xffffff;
        if (disturbance.selectionCue === true) {
            if (!Number.isFinite(nightDepth) || nightDepth < 0 || nightDepth > 1) {
                throw new Error('ZEN_KOI_SELECTION_RIPPLE_NIGHT_DEPTH_INVALID');
            }
            const mix = (day, night) => Math.round(day + (night - day) * nightDepth);
            tint = (mix(245, 206) << 16) | (mix(235, 222) << 8) | mix(211, 239);
        }
        const x = Number(disturbance.x) || 0;
        const y = Number(disturbance.y) || 0;
        const radius = Math.max(0.1, Number(disturbance.radiusPx) || 0.1);
        if (!intersectsViewportBounds({
            x,
            y,
            radius,
            visibleWorldBounds,
        })) {
            if (entry?.container) {
                entry.container.visible = false;
            }
            continue;
        }
        if (!entry) {
            const textureRecord = getRingTextureRecord(visual.lineWidth);
            const container = new Container();
            const primary = new Sprite(textureRecord.texture);
            primary.anchor.set(0.5, 0.5);
            container.addChild(primary);

            let secondary = null;
            if (visual.secondaryOffsetPx > 0) {
                secondary = new Sprite(textureRecord.texture);
                secondary.anchor.set(0.5, 0.5);
                container.addChild(secondary);
            }

            entry = {
                container,
                primary,
                secondary,
                textureRecord,
            };
            ripplePool.set(disturbance, entry);
            ripplesContainer.addChild(container);
        }

        const alpha = clampValue((Number(disturbance.life) || 0) * visual.opacity, 0, 1);
        const scale = radius / entry.textureRecord.baseRadius;
        const radiusSecondary = radius - visual.secondaryOffsetPx;
        const staggeredAlpha = entry.secondary
            ? resolveStaggeredTapRippleAlpha({
                disturbance,
                visual,
                radius,
                radiusSecondary,
            })
            : null;
        const primaryAlpha = staggeredAlpha?.primary ?? alpha;
        entry.container.visible = true;
        entry.container.position.set(x, y);
        entry.primary.visible = true;
        entry.primary.scale.set(scale);
        entry.primary.alpha = primaryAlpha;
        entry.primary.tint = tint;

        if (entry.secondary) {
            const secondaryAlpha = staggeredAlpha?.secondary ?? 0;
            const secondaryVisible = radiusSecondary > 0.1;
            entry.secondary.visible = secondaryVisible;
            if (secondaryVisible) {
                entry.secondary.scale.set(radiusSecondary / entry.textureRecord.baseRadius);
                entry.secondary.alpha = secondaryAlpha;
            }
        }
    }

    removeMissingFromPool(ripplePool, aliveRipples, (entry) => {
        entry.container.parent?.removeChild(entry.container);
        entry.container.destroy({ children: true });
    });
};

const syncPetals = ({
    materialLighting,
    petalsRef,
    petalPool,
    petalsContainer,
    getPetalTextureRecord,
    aliveSet = null,
    visibleWorldBounds = null,
}) => {
    const petals = resolveArray(petalsRef);
    const alivePetals = aliveSet || new Set();
    alivePetals.clear();
    for (let i = 0; i < petals.length; i += 1) {
        const petal = petals[i];
        if (!petal) continue;
        alivePetals.add(petal);

        let entry = petalPool.get(petal);
        const x = Number(petal.x) || 0;
        const y = Number(petal.y) || 0;
        const size = Number(petal.size) || PETAL_BASE_SIZE;
        if (!intersectsViewportBounds({
            x,
            y,
            radius: size,
            visibleWorldBounds,
        })) {
            if (entry?.sprite) {
                entry.sprite.visible = false;
            }
            continue;
        }
        requireZenPetalAppearance(petal);
        const { color, shapeType: shape } = petal;
        const key = `${color}|${shape}`;
        if (!entry) {
            const textureRecord = getPetalTextureRecord(color, shape, materialLighting);
            const sprite = new Sprite(textureRecord.texture);
            sprite.anchor.set(0.5, 0.5);
            entry = { sprite, textureRecord, key };
            petalPool.set(petal, entry);
            petalsContainer.addChild(sprite);
        } else if (entry.key !== key) {
            entry.key = key;
            entry.textureRecord = getPetalTextureRecord(color, shape, materialLighting);
            entry.sprite.texture = entry.textureRecord.texture;
        } else {
            // Existing sprites, including those returning from cull, only check
            // the retained material; do not repeat cache admission/validation.
            entry.textureRecord.setMaterialLighting(materialLighting);
        }

        const alpha = clampValue(Number(petal.opacity) || 0, 0, 1);
        const scaleBase = Math.max(0.01, size / entry.textureRecord.baseSize);

        entry.sprite.visible = alpha > 0.001;
        if (entry.sprite.visible) {
            entry.sprite.position.set(x, y);
            entry.sprite.rotation = Number(petal.rotation) || 0;
            entry.sprite.scale.set(scaleBase);
            entry.sprite.alpha = alpha;
        }
    }
    removeMissingFromPool(petalPool, alivePetals, (entry) => {
        entry.sprite.parent?.removeChild(entry.sprite);
        entry.sprite.destroy();
    });
};

const syncGlimmers = ({
    glimmersRef,
    glimmerPool,
    glimmersContainer,
    getGlimmerTextureRecord,
    aliveSet = null,
    visibleWorldBounds = null,
}) => {
    const glimmers = resolveArray(glimmersRef);
    const aliveGlimmers = aliveSet || new Set();
    aliveGlimmers.clear();
    let glimmerTexture = null;
    const ensureGlimmerTexture = () => {
        if (!glimmerTexture) {
            glimmerTexture = getGlimmerTextureRecord();
        }
        return glimmerTexture;
    };
    for (let i = 0; i < glimmers.length; i += 1) {
        const glimmer = glimmers[i];
        if (!glimmer) continue;
        aliveGlimmers.add(glimmer);

        let sprite = glimmerPool.get(glimmer);
        const x = Number(glimmer.x) || 0;
        const y = Number(glimmer.y) || 0;
        const size = Number(glimmer.size) || 0;
        if (!intersectsViewportBounds({
            x,
            y,
            radius: size,
            visibleWorldBounds,
        })) {
            if (sprite) {
                sprite.visible = false;
            }
            continue;
        }
        if (!sprite) {
            const glimmerTextureRecord = ensureGlimmerTexture();
            sprite = new Sprite(glimmerTextureRecord.texture);
            sprite.anchor.set(0.5, 0.5);
            glimmerPool.set(glimmer, sprite);
            glimmersContainer.addChild(sprite);
        }

        const visible = Boolean(glimmer.active) && size > 0.1;
        sprite.visible = visible;
        if (visible) {
            const glimmerTextureRecord = ensureGlimmerTexture();
            sprite.position.set(x, y);
            sprite.scale.set(Math.max(0.02, size / glimmerTextureRecord.baseSize));
            sprite.alpha = 0.8;
        }
    }
    removeMissingFromPool(glimmerPool, aliveGlimmers, (sprite) => {
        sprite.parent?.removeChild(sprite);
        sprite.destroy();
    });
};

export {
    syncParticles,
    syncRingRippleProjection,
    syncPetals,
    syncGlimmers,
};
