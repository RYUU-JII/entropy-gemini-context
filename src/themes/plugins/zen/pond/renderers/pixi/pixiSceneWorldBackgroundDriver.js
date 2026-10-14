import {
    BaseTexture,
    BLEND_MODES,
    Sprite,
    Texture,
} from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';
import {
    createZenSeededRandom,
    pickZenIndex,
    sampleZenRange,
} from '../../../shared/zenSeededRandom.js';
import { resolvePixiSceneBackgroundRenderPlan } from './pixiSceneWorldPolicy.js';

// Render the cosmos at native scene resolution for a crisp window-into-space look,
// but cap the longest edge so very large panels stay cheap to bake.
const COSMIC_BACKGROUND_TEXTURE_SCALE = 1;
const COSMIC_BACKGROUND_MAX_DIMENSION = 1600;
const TAU = Math.PI * 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const makeCanvas = (width, height) => {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
    if (typeof OffscreenCanvas === 'function') {
        return new OffscreenCanvas(width, height);
    }
    return null;
};

const createTextureFromCanvas = (canvas) => {
    if (!canvas) return null;
    return new Texture(new BaseTexture(canvas));
};

// A handful of bright foreground stars are rendered as live sprites layered over
// the baked field so they can twinkle and drift, giving the static cosmos life.
const HERO_STAR_TEXTURE_SIZE = 96;
const HERO_STAR_COUNT = 8;
const HERO_STAR_TINTS = [0xffffff, 0xfff3da, 0xd2e4ff, 0xbcd4ff, 0xffe6cf];

// Builds one shared white star sprite texture (soft halo + crisp core + 4-point
// diffraction spikes). Individual hero stars recolor it via sprite tint.
const createHeroStarTexture = (ownedTextures = null) => {
    const size = HERO_STAR_TEXTURE_SIZE;
    const canvas = makeCanvas(size, size);
    const ctx = canvas?.getContext?.('2d', { alpha: true });
    if (!ctx) return null;
    const center = size / 2;

    const halo = ctx.createRadialGradient(center, center, 0, center, center, center);
    halo.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    halo.addColorStop(0.22, 'rgba(255, 255, 255, 0.45)');
    halo.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)');
    halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(center, center, center, 0, TAU);
    ctx.fill();

    ctx.globalCompositeOperation = 'lighter';
    [0, Math.PI / 2].forEach((angle) => {
        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(angle);
        const spike = ctx.createLinearGradient(-center, 0, center, 0);
        spike.addColorStop(0, 'rgba(255, 255, 255, 0)');
        spike.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)');
        spike.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = spike;
        ctx.fillRect(-center, -1, size, 2);
        ctx.restore();
    });

    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.beginPath();
    ctx.arc(center, center, size * 0.045, 0, TAU);
    ctx.fill();

    const texture = createTextureFromCanvas(canvas);
    if (texture && ownedTextures && typeof ownedTextures.add === 'function') {
        ownedTextures.add(texture);
    }
    return texture;
};

// Shared hue families for nebulae, ambient dust and distant galaxies so the
// whole field reads as one coherent palette rather than random blobs.
const NEBULA_PALETTES = [
    { core: '64, 224, 224', mid: '40, 120, 196' },
    { core: '186, 124, 255', mid: '92, 70, 188' },
    { core: '255, 168, 120', mid: '150, 70, 120' },
    { core: '120, 196, 255', mid: '52, 96, 184' },
];

const STAR_COLORS = [
    '255, 255, 252',
    '255, 255, 252',
    '198, 224, 255',
    '173, 206, 255',
    '255, 226, 188',
    '255, 210, 196',
];

// A single soft radial deposit — the building block for clouds and dust.
const paintGlow = ({ ctx, x, y, radius, stops, alpha = 1, blend = 'screen' }) => {
    if (radius <= 0) return;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
    ctx.save();
    ctx.globalCompositeOperation = blend;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
    ctx.restore();
};

// Organic nebula = a cluster of overlapping glows plus a brighter heart.
const drawNebulaCloud = ({ ctx, rng, x, y, radius, palette, alpha }) => {
    const blobCount = Math.round(sampleZenRange(rng, 5, 9));
    for (let i = 0; i < blobCount; i += 1) {
        const angle = sampleZenRange(rng, 0, TAU);
        const distance = sampleZenRange(rng, 0, radius * 0.62);
        paintGlow({
            ctx,
            x: x + (Math.cos(angle) * distance),
            y: y + (Math.sin(angle) * distance),
            radius: radius * sampleZenRange(rng, 0.34, 0.78),
            alpha: alpha * sampleZenRange(rng, 0.22, 0.6),
            stops: [
                [0, `rgba(${palette.core}, 0.85)`],
                [0.45, `rgba(${palette.mid}, 0.4)`],
                [1, `rgba(${palette.mid}, 0)`],
            ],
        });
    }
    paintGlow({
        ctx,
        x,
        y,
        radius: radius * 0.4,
        alpha: alpha * 0.5,
        stops: [
            [0, `rgba(${palette.core}, 0.7)`],
            [0.6, `rgba(${palette.core}, 0.12)`],
            [1, `rgba(${palette.core}, 0)`],
        ],
    });
};

// A faint diagonal galactic band with one subtle dust lane for depth.
const drawMilkyWayBand = ({ ctx, rng, width, height }) => {
    const span = Math.hypot(width, height);
    const thickness = span * sampleZenRange(rng, 0.26, 0.34);
    ctx.save();
    ctx.translate(width * 0.5, height * 0.5);
    ctx.rotate(sampleZenRange(rng, -0.9, -0.35));
    ctx.globalCompositeOperation = 'screen';
    const band = ctx.createLinearGradient(0, -thickness, 0, thickness);
    band.addColorStop(0, 'rgba(70, 96, 150, 0)');
    band.addColorStop(0.5, 'rgba(150, 170, 220, 0.16)');
    band.addColorStop(1, 'rgba(70, 96, 150, 0)');
    ctx.fillStyle = band;
    ctx.fillRect(-span, -thickness, span * 2, thickness * 2);

    const laneY = sampleZenRange(rng, -thickness * 0.4, thickness * 0.4);
    const laneHalf = thickness * 0.18;
    ctx.globalCompositeOperation = 'multiply';
    const lane = ctx.createLinearGradient(0, laneY - laneHalf, 0, laneY + laneHalf);
    lane.addColorStop(0, 'rgba(6, 8, 18, 0)');
    lane.addColorStop(0.5, 'rgba(6, 8, 18, 0.42)');
    lane.addColorStop(1, 'rgba(6, 8, 18, 0)');
    ctx.fillStyle = lane;
    ctx.fillRect(-span, laneY - laneHalf, span * 2, laneHalf * 2);
    ctx.restore();
};

// A small tilted disc galaxy with a bright core, sitting far in the distance.
const drawDistantGalaxy = ({ ctx, rng, x, y, radius, palette }) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sampleZenRange(rng, 0, TAU));
    ctx.scale(1, sampleZenRange(rng, 0.32, 0.5));
    ctx.globalCompositeOperation = 'screen';
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    halo.addColorStop(0, `rgba(${palette.core}, 0.5)`);
    halo.addColorStop(0.4, `rgba(${palette.mid}, 0.2)`);
    halo.addColorStop(1, `rgba(${palette.mid}, 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, TAU);
    ctx.fill();
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.3);
    core.addColorStop(0, 'rgba(255, 250, 240, 0.9)');
    core.addColorStop(1, 'rgba(255, 250, 240, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
};

// A star: soft colored halo, crisp white core, and 4-point spikes when bright.
const drawStar = ({ ctx, x, y, radius, alpha, color, spike = false }) => {
    const glowRadius = radius * 4.2;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    glow.addColorStop(0, `rgba(${color}, ${alpha})`);
    glow.addColorStop(0.32, `rgba(${color}, ${alpha * 0.4})`);
    glow.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, glowRadius, 0, TAU);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 255, 255, ${clamp(alpha * 1.1, 0, 1)})`;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.4, radius * 0.55), 0, TAU);
    ctx.fill();

    if (!spike) return;
    const reach = glowRadius * 2.4;
    [[reach, 0], [0, reach]].forEach(([dx, dy]) => {
        const grad = ctx.createLinearGradient(x - dx, y - dy, x + dx, y + dy);
        grad.addColorStop(0, `rgba(${color}, 0)`);
        grad.addColorStop(0.5, `rgba(${color}, ${alpha * 0.5})`);
        grad.addColorStop(1, `rgba(${color}, 0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x - dx, y - dy);
        ctx.lineTo(x + dx, y + dy);
        ctx.stroke();
    });
};

const drawCosmicFlowLine = ({
    ctx,
    width,
    height,
    rng,
    alpha,
}) => {
    const startX = sampleZenRange(rng, width * -0.12, width * 0.2);
    const startY = sampleZenRange(rng, height * 0.18, height * 0.84);
    const endX = sampleZenRange(rng, width * 0.76, width * 1.16);
    const endY = sampleZenRange(rng, height * 0.12, height * 0.88);
    const controlX = sampleZenRange(rng, width * 0.26, width * 0.72);
    const controlY = sampleZenRange(rng, height * 0.02, height * 0.96);
    const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
    gradient.addColorStop(0, 'rgba(96, 211, 255, 0)');
    gradient.addColorStop(0.36, `rgba(96, 211, 255, ${alpha * 0.38})`);
    gradient.addColorStop(0.72, `rgba(220, 183, 255, ${alpha * 0.28})`);
    gradient.addColorStop(1, 'rgba(220, 183, 255, 0)');

    ctx.save();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = sampleZenRange(rng, 0.8, 2.4);
    ctx.globalCompositeOperation = 'screen';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(controlX, controlY, endX, endY);
    ctx.stroke();
    ctx.restore();
};

export const createCosmicKoiBackgroundTexture = ({
    ownedTextures = null,
    width,
    height,
    seed = '',
} = {}) => {
    const textureWidth = Math.max(64, Math.round(Number(width) || 1));
    const textureHeight = Math.max(64, Math.round(Number(height) || 1));
    const canvas = makeCanvas(textureWidth, textureHeight);
    const ctx = canvas?.getContext?.('2d', { alpha: true });
    if (!ctx) return null;

    const rng = createZenSeededRandom('cosmic-koi-background', seed, textureWidth, textureHeight);
    const maxSpan = Math.max(textureWidth, textureHeight);

    // 1. Deep space base.
    const deepGradient = ctx.createLinearGradient(0, 0, textureWidth, textureHeight);
    deepGradient.addColorStop(0, '#03050f');
    deepGradient.addColorStop(0.4, '#071529');
    deepGradient.addColorStop(0.7, '#0d1330');
    deepGradient.addColorStop(1, '#04060e');
    ctx.fillStyle = deepGradient;
    ctx.fillRect(0, 0, textureWidth, textureHeight);

    // 2. Large, faint ambient dust to break up the flat base with depth.
    for (let i = 0; i < 6; i += 1) {
        const palette = NEBULA_PALETTES[pickZenIndex(rng, NEBULA_PALETTES.length)];
        paintGlow({
            ctx,
            x: sampleZenRange(rng, 0, textureWidth),
            y: sampleZenRange(rng, 0, textureHeight),
            radius: maxSpan * sampleZenRange(rng, 0.5, 0.95),
            alpha: sampleZenRange(rng, 0.05, 0.12),
            stops: [
                [0, `rgba(${palette.mid}, 0.5)`],
                [1, `rgba(${palette.mid}, 0)`],
            ],
        });
    }

    // 3. Galactic band.
    drawMilkyWayBand({ ctx, rng, width: textureWidth, height: textureHeight });

    // 4. Foreground nebula clouds.
    for (let i = 0; i < 3; i += 1) {
        drawNebulaCloud({
            ctx,
            rng,
            x: sampleZenRange(rng, textureWidth * 0.1, textureWidth * 0.9),
            y: sampleZenRange(rng, textureHeight * 0.1, textureHeight * 0.9),
            radius: maxSpan * sampleZenRange(rng, 0.34, 0.6),
            palette: NEBULA_PALETTES[pickZenIndex(rng, NEBULA_PALETTES.length)],
            alpha: sampleZenRange(rng, 0.5, 0.78),
        });
    }

    // 5. Distant galaxies.
    const galaxyCount = Math.round(sampleZenRange(rng, 1, 2));
    for (let i = 0; i < galaxyCount; i += 1) {
        drawDistantGalaxy({
            ctx,
            rng,
            x: sampleZenRange(rng, textureWidth * 0.2, textureWidth * 0.8),
            y: sampleZenRange(rng, textureHeight * 0.18, textureHeight * 0.82),
            radius: maxSpan * sampleZenRange(rng, 0.08, 0.16),
            palette: NEBULA_PALETTES[pickZenIndex(rng, NEBULA_PALETTES.length)],
        });
    }

    // 6. Layered star field with color temperature and diffraction spikes.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const starCount = clamp(Math.round((textureWidth * textureHeight) / 1100), 120, 460);
    for (let i = 0; i < starCount; i += 1) {
        const bright = i % 23 === 0;
        const mid = i % 7 === 0;
        drawStar({
            ctx,
            x: sampleZenRange(rng, 0, textureWidth),
            y: sampleZenRange(rng, 0, textureHeight),
            radius: bright
                ? sampleZenRange(rng, 1.1, 1.7)
                : (mid ? sampleZenRange(rng, 0.6, 1.0) : sampleZenRange(rng, 0.25, 0.6)),
            alpha: bright
                ? sampleZenRange(rng, 0.8, 1)
                : (mid ? sampleZenRange(rng, 0.45, 0.78) : sampleZenRange(rng, 0.2, 0.5)),
            color: STAR_COLORS[pickZenIndex(rng, STAR_COLORS.length)],
            spike: bright,
        });
    }
    ctx.restore();

    // 7. A few drifting flow lines for gentle cosmic current.
    for (let i = 0; i < 5; i += 1) {
        drawCosmicFlowLine({
            ctx,
            width: textureWidth,
            height: textureHeight,
            rng,
            alpha: sampleZenRange(rng, 0.16, 0.5),
        });
    }

    // 8. Framing vignette so the panel reads as a window into deep space.
    const vignette = ctx.createRadialGradient(
        textureWidth * 0.5,
        textureHeight * 0.5,
        Math.min(textureWidth, textureHeight) * 0.25,
        textureWidth * 0.5,
        textureHeight * 0.5,
        maxSpan * 0.82,
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.7, 'rgba(2, 4, 10, 0.18)');
    vignette.addColorStop(1, 'rgba(1, 2, 6, 0.52)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, textureWidth, textureHeight);

    const texture = createTextureFromCanvas(canvas);
    if (texture && ownedTextures && typeof ownedTextures.add === 'function') {
        ownedTextures.add(texture);
    }
    return texture;
};

export const createPixiSceneWorldBackgroundDriver = ({
    sceneWidth,
    sceneHeight,
    sceneGenerationKey = '',
    ownedTextures = null,
    cosmicBackgroundContainer = null,
    cosmicBackgroundSprite = null,
} = {}) => {
    let textureRecord = null;
    let textureKey = '';
    let heroStarTexture = null;
    let heroStarsBuilt = false;
    let elapsedMs = 0;
    const heroStars = [];

    const disposeTexture = () => {
        if (textureRecord?.owned && textureRecord.texture && !textureRecord.texture.destroyed) {
            textureRecord.texture.destroy(true);
        }
        if (
            textureRecord?.owned
            && ownedTextures
            && textureRecord.texture
            && typeof ownedTextures.delete === 'function'
        ) {
            ownedTextures.delete(textureRecord.texture);
        }
        textureRecord = null;
        textureKey = '';
    };

    const disposeHeroStars = () => {
        for (let i = 0; i < heroStars.length; i += 1) {
            const sprite = heroStars[i]?.sprite;
            sprite?.parent?.removeChild(sprite);
            if (sprite && !sprite.destroyed) {
                sprite.destroy({ children: false, texture: false, baseTexture: false });
            }
        }
        heroStars.length = 0;
        if (heroStarTexture && !heroStarTexture.destroyed) {
            heroStarTexture.destroy(true);
        }
        if (heroStarTexture && ownedTextures && typeof ownedTextures.delete === 'function') {
            ownedTextures.delete(heroStarTexture);
        }
        heroStarTexture = null;
        heroStarsBuilt = false;
        elapsedMs = 0;
    };

    const ensureHeroStars = () => {
        if (heroStarsBuilt) return;
        heroStarsBuilt = true;
        if (!cosmicBackgroundContainer || typeof cosmicBackgroundContainer.addChild !== 'function') {
            return;
        }
        const texture = createHeroStarTexture(ownedTextures);
        if (!texture) return;
        heroStarTexture = texture;

        const width = Math.max(64, Math.round(Number(sceneWidth) || 1));
        const height = Math.max(64, Math.round(Number(sceneHeight) || 1));
        const minSpan = Math.min(width, height);
        const rng = createZenSeededRandom('cosmic-koi-hero-stars', sceneGenerationKey, width, height);

        for (let i = 0; i < HERO_STAR_COUNT; i += 1) {
            const sprite = new Sprite(texture);
            sprite.anchor.set(0.5);
            sprite.blendMode = BLEND_MODES.SCREEN;
            sprite.tint = HERO_STAR_TINTS[pickZenIndex(rng, HERO_STAR_TINTS.length)];
            const baseScale = (minSpan * sampleZenRange(rng, 0.04, 0.085)) / HERO_STAR_TEXTURE_SIZE;
            const star = {
                sprite,
                baseX: sampleZenRange(rng, width * 0.1, width * 0.9),
                baseY: sampleZenRange(rng, height * 0.1, height * 0.9),
                baseScale,
                baseAlpha: sampleZenRange(rng, 0.55, 0.92),
                twinklePhase: sampleZenRange(rng, 0, TAU),
                twinkleSpeed: sampleZenRange(rng, 0.0009, 0.0022),
                driftPhaseX: sampleZenRange(rng, 0, TAU),
                driftSpeedX: sampleZenRange(rng, 0.00012, 0.00028),
                driftAmpX: sampleZenRange(rng, 3, 8),
                driftPhaseY: sampleZenRange(rng, 0, TAU),
                driftSpeedY: sampleZenRange(rng, 0.00012, 0.00028),
                driftAmpY: sampleZenRange(rng, 3, 8),
            };
            sprite.x = star.baseX;
            sprite.y = star.baseY;
            sprite.scale.set(baseScale);
            sprite.alpha = star.baseAlpha;
            cosmicBackgroundContainer.addChild(sprite);
            heroStars.push(star);
        }
    };

    const animateHeroStars = (deltaMs, intensity) => {
        if (!heroStars.length) return;
        elapsedMs += clamp(Number(deltaMs) || 16.6667, 0, 64);
        for (let i = 0; i < heroStars.length; i += 1) {
            const star = heroStars[i];
            const twinkle = 0.5 + (0.5 * Math.sin(star.twinklePhase + (elapsedMs * star.twinkleSpeed)));
            star.sprite.alpha = clamp(star.baseAlpha * (0.4 + (0.6 * twinkle)) * intensity, 0, 1);
            star.sprite.scale.set(star.baseScale * (0.9 + (0.12 * twinkle)));
            star.sprite.x = star.baseX + (Math.sin(star.driftPhaseX + (elapsedMs * star.driftSpeedX)) * star.driftAmpX);
            star.sprite.y = star.baseY + (Math.cos(star.driftPhaseY + (elapsedMs * star.driftSpeedY)) * star.driftAmpY);
        }
    };

    const ensureCosmicTexture = () => {
        const width = Math.max(64, Math.round(Number(sceneWidth) || 1));
        const height = Math.max(64, Math.round(Number(sceneHeight) || 1));
        const fitScale = Math.min(
            1,
            COSMIC_BACKGROUND_MAX_DIMENSION / Math.max(width, height),
        );
        const scale = COSMIC_BACKGROUND_TEXTURE_SCALE * fitScale;
        const textureWidth = Math.max(64, Math.round(width * scale));
        const textureHeight = Math.max(64, Math.round(height * scale));
        const nextKey = `${sceneGenerationKey}|cosmic_space|${textureWidth}x${textureHeight}`;
        if (textureRecord && textureKey === nextKey) return textureRecord.texture;

        disposeTexture();
        const createdTexture = createCosmicKoiBackgroundTexture({
            ownedTextures,
            width: textureWidth,
            height: textureHeight,
            seed: nextKey,
        });
        textureRecord = Object.freeze({
            texture: createdTexture,
            owned: Boolean(createdTexture),
        });
        textureKey = nextKey;
        return textureRecord.texture;
    };

    const sync = ({
        worldPolicy = null,
        frameChannels = null,
        deltaMs = 16.6667,
    } = {}) => {
        if (!cosmicBackgroundSprite) return false;
        const backgroundPlan = resolvePixiSceneBackgroundRenderPlan(worldPolicy);
        if (!backgroundPlan.cosmicSpace) {
            cosmicBackgroundSprite.visible = false;
            return false;
        }

        const texture = ensureCosmicTexture();
        if (texture) {
            cosmicBackgroundSprite.texture = texture;
        }
        cosmicBackgroundSprite.x = 0;
        cosmicBackgroundSprite.y = 0;
        cosmicBackgroundSprite.width = Math.max(1, Math.round(Number(sceneWidth) || 1));
        cosmicBackgroundSprite.height = Math.max(1, Math.round(Number(sceneHeight) || 1));
        cosmicBackgroundSprite.visible = true;
        const moonlight = Number(frameChannels?.moonlight) || 0;
        cosmicBackgroundSprite.alpha = clamp(0.92 + (moonlight * 0.05), 0.9, 0.98);

        ensureHeroStars();
        animateHeroStars(deltaMs, clamp(0.85 + (moonlight * 0.15), 0.85, 1));
        return true;
    };

    return {
        sync,
        resizeWorld: (width, height) => {
            const sx = width / sceneWidth;
            const sy = height / sceneHeight;
            for (const star of heroStars) { star.baseX *= sx; star.baseY *= sy; }
            sceneWidth = width;
            sceneHeight = height;
            disposeTexture();
        },
        dispose: () => {
            disposeHeroStars();
            disposeTexture();
        },
    };
};
