import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    ARTIFACT_SVG_FILTER_REGIONS,
    createArtifactSvgViewBox,
} from '@/themes/core/artifacts/scene/artifactSvgCoordinateSystem.js';
import { useArtifactSvgIdScope } from '@/themes/core/artifacts/scene/useArtifactSvgIdScope.js';
import { useZenArtifactRenderChannels } from './useZenArtifactRenderChannels.js';

const SUIKINKUTSU_VIEW_BOX = createArtifactSvgViewBox(360, 300);

const STONE_NODES = Object.freeze([
    { cx: 80, cy: 188, rx: 24, ry: 13, rotate: -14, tone: 0 },
    { cx: 112, cy: 173, rx: 28, ry: 14, rotate: -8, tone: 1 },
    { cx: 151, cy: 165, rx: 26, ry: 13, rotate: 5, tone: 2 },
    { cx: 192, cy: 164, rx: 29, ry: 14, rotate: -2, tone: 1 },
    { cx: 233, cy: 171, rx: 27, ry: 13, rotate: 10, tone: 0 },
    { cx: 267, cy: 188, rx: 23, ry: 13, rotate: 15, tone: 2 },
    { cx: 258, cy: 210, rx: 28, ry: 14, rotate: -8, tone: 1 },
    { cx: 218, cy: 224, rx: 30, ry: 14, rotate: 6, tone: 0 },
    { cx: 176, cy: 229, rx: 31, ry: 15, rotate: -3, tone: 2 },
    { cx: 133, cy: 224, rx: 30, ry: 14, rotate: 9, tone: 1 },
    { cx: 94, cy: 210, rx: 28, ry: 14, rotate: -12, tone: 0 },
]);

const RAKE_LINES = Object.freeze([
    { rx: 88, ry: 31, opacity: 0.26 },
    { rx: 72, ry: 25, opacity: 0.24 },
    { rx: 56, ry: 19, opacity: 0.22 },
    { rx: 40, ry: 13, opacity: 0.2 },
]);

const WATER_DROPS = Object.freeze([
    { cx: 174, startY: 54, endY: 153, r: 3.4, delay: 0 },
    { cx: 184, startY: 34, endY: 156, r: 2.6, delay: 0.92 },
    { cx: 178, startY: 18, endY: 150, r: 2.1, delay: 1.76 },
]);

function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
}

function hexToRgb(value) {
    if (typeof value !== 'string') return null;
    const raw = value.trim().replace('#', '');
    if (!/^[\da-fA-F]{3}([\da-fA-F]{3})?$/.test(raw)) return null;
    const fullHex = raw.length === 3
        ? raw.split('').map((char) => char + char).join('')
        : raw;
    return {
        r: parseInt(fullHex.slice(0, 2), 16),
        g: parseInt(fullHex.slice(2, 4), 16),
        b: parseInt(fullHex.slice(4, 6), 16),
    };
}

function withAlpha(value, alpha, fallback = `rgba(255,255,255,${alpha})`) {
    const rgb = hexToRgb(value);
    if (!rgb) return fallback;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function lerp(start, end, amount) {
    return start + ((end - start) * clamp01(amount));
}

function blendHex(start, end, amount) {
    const from = hexToRgb(start);
    const to = hexToRgb(end);
    if (!from || !to) return start;
    const t = clamp01(amount);
    const channel = (value) => Math.round(value).toString(16).padStart(2, '0');
    return `#${channel(from.r + ((to.r - from.r) * t))}${channel(from.g + ((to.g - from.g) * t))}${channel(from.b + ((to.b - from.b) * t))}`;
}

function resolveStoneFill(tone) {
    if (tone === 1) return '#57534e';
    if (tone === 2) return '#44403c';
    return '#292524';
}

export default function ZenSuikinkutsu({
    isActive = true,
    color = '#38bdf8',
    artifactRenderContext = null,
    artifactRenderState = null,
}) {
    const idScope = useArtifactSvgIdScope('zen-suikinkutsu');
    const renderChannels = useZenArtifactRenderChannels({
        artifactRenderContext,
        artifactRenderState,
        color,
        isActive,
    });
    const renderColor = renderChannels.color || '#38bdf8';
    const renderIsActive = renderChannels.isVisuallyActive;
    const shouldAnimate = renderChannels.shouldAnimateAmbient && renderChannels.shouldRenderEffects;
    const activityWeight = clamp01(
        renderChannels.renderState?.visualActivityWeight
        ?? (renderIsActive ? 1 : 0.24),
    );
    const nightDepth = renderChannels.nightDepth;

    const palette = useMemo(() => ({
        gravel: blendHex('#e7e5e4', '#cbd5e1', nightDepth),
        gravelEdge: blendHex('#a8a29e', '#64748b', nightDepth),
        aperture: blendHex('#1c1917', '#020617', nightDepth),
        water: renderColor,
        waterSoft: withAlpha(renderColor, 0.22, 'rgba(125,211,252,0.22)'),
        waterLine: withAlpha(renderColor, 0.64, 'rgba(125,211,252,0.64)'),
    }), [nightDepth, renderColor]);

    const waterOpacity = renderIsActive ? 0.78 + (activityWeight * 0.2) : 0.16;
    const quietOpacity = renderIsActive ? 1 : 0.62;

    return (
        <div
            className="relative flex h-[320px] w-[360px] items-center justify-center overflow-visible pointer-events-none"
            style={{ transform: 'translateY(28px)' }}
        >
            <svg
                role="img"
                aria-label="Suikinkutsu resonance basin"
                viewBox={SUIKINKUTSU_VIEW_BOX}
                className="h-full w-full overflow-visible"
            >
                <defs>
                    <radialGradient id={idScope.get('gravel')} cx="48%" cy="38%" r="72%">
                        <stop offset="0%" stopColor="#f8fafc" stopOpacity={lerp(0.72, 0.82, nightDepth)} />
                        <stop offset="52%" stopColor={palette.gravel} stopOpacity="0.96" />
                        <stop offset="100%" stopColor={palette.gravelEdge} stopOpacity="0.9" />
                    </radialGradient>
                    <radialGradient id={idScope.get('aperture')} cx="50%" cy="46%" r="62%">
                        <stop offset="0%" stopColor="#000000" stopOpacity="0.96" />
                        <stop offset="58%" stopColor={palette.aperture} stopOpacity="0.92" />
                        <stop offset="100%" stopColor={palette.water} stopOpacity={renderIsActive ? 0.28 : 0.08} />
                    </radialGradient>
                    <linearGradient id={idScope.get('stoneEdge')} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#78716c" />
                        <stop offset="46%" stopColor="#44403c" />
                        <stop offset="100%" stopColor="#1c1917" />
                    </linearGradient>
                    <filter id={idScope.get('softShadow')} {...ARTIFACT_SVG_FILTER_REGIONS.objectGlow}>
                        <feDropShadow dx="0" dy="12" stdDeviation="9" floodColor="#020617" floodOpacity={lerp(0.24, 0.48, nightDepth)} />
                    </filter>
                    <filter id={idScope.get('waterGlow')} {...ARTIFACT_SVG_FILTER_REGIONS.objectHeavyGlow}>
                        <feGaussianBlur stdDeviation="5" result="blur" />
                        <feColorMatrix
                            in="blur"
                            type="matrix"
                            values="0 0 0 0 0.2 0 0 0 0 0.78 0 0 0 0 1 0 0 0 0.55 0"
                            result="glow"
                        />
                        <feMerge>
                            <feMergeNode in="glow" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                <ellipse
                    cx="180"
                    cy="222"
                    rx="118"
                    ry="28"
                    fill="#020617"
                    opacity={lerp(0.16, 0.34, nightDepth)}
                    filter={`url(#${idScope.get('softShadow')})`}
                />

                <motion.g
                    initial={false}
                    animate={{ opacity: quietOpacity }}
                    transition={{ duration: 0.35 }}
                    filter={`url(#${idScope.get('softShadow')})`}
                >
                    <ellipse cx="180" cy="196" rx="106" ry="50" fill={idScope.url('gravel')} />
                    <ellipse cx="180" cy="196" rx="98" ry="43" fill="none" stroke="#f8fafc" strokeOpacity="0.3" strokeWidth="1.4" />
                    <ellipse cx="180" cy="196" rx="86" ry="35" fill="none" stroke="#0f172a" strokeOpacity={lerp(0.1, 0.16, nightDepth)} strokeWidth="1" />

                    {RAKE_LINES.map((line) => (
                        <ellipse
                            key={`${line.rx}-${line.ry}`}
                            cx="180"
                            cy="196"
                            rx={line.rx}
                            ry={line.ry}
                            fill="none"
                            stroke="#57534e"
                            strokeOpacity={line.opacity}
                            strokeWidth="1.2"
                        />
                    ))}
                    <path
                        d="M88 198 C118 181 146 181 180 194 C212 207 242 207 272 192"
                        fill="none"
                        stroke="#f8fafc"
                        strokeOpacity={lerp(0.32, 0.2, nightDepth)}
                        strokeWidth="1.4"
                    />
                    <path
                        d="M97 210 C132 197 157 198 183 209 C212 222 240 218 264 206"
                        fill="none"
                        stroke="#57534e"
                        strokeOpacity="0.18"
                        strokeWidth="1.2"
                    />
                </motion.g>

                <g aria-hidden="true">
                    {STONE_NODES.map((stone, index) => (
                        <ellipse
                            key={`${stone.cx}-${stone.cy}-${index}`}
                            cx={stone.cx}
                            cy={stone.cy}
                            rx={stone.rx}
                            ry={stone.ry}
                            transform={`rotate(${stone.rotate} ${stone.cx} ${stone.cy})`}
                            fill={resolveStoneFill(stone.tone)}
                            stroke={idScope.url('stoneEdge')}
                            strokeWidth="1.1"
                            opacity="0.98"
                        />
                    ))}
                </g>

                <motion.g
                    aria-hidden="true"
                    filter={`url(#${idScope.get('waterGlow')})`}
                    initial={false}
                    animate={shouldAnimate ? {
                        opacity: [waterOpacity * 0.6, waterOpacity, waterOpacity * 0.72],
                    } : {
                        opacity: renderIsActive ? waterOpacity * 0.7 : 0,
                    }}
                    transition={shouldAnimate ? { duration: 3.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
                >
                    <line
                        x1="180"
                        y1="42"
                        x2="180"
                        y2="146"
                        stroke={palette.waterLine}
                        strokeWidth="1"
                        strokeLinecap="round"
                        strokeDasharray="2 8"
                    />
                    {WATER_DROPS.map((drop) => (
                        <motion.circle
                            key={`${drop.cx}-${drop.delay}`}
                            cx={drop.cx}
                            r={drop.r}
                            fill={palette.water}
                            initial={false}
                            animate={shouldAnimate ? {
                                cy: [drop.startY, drop.endY],
                                opacity: [0, 0.86, 0.08],
                                scale: [0.72, 1, 0.44],
                            } : {
                                cy: drop.endY,
                                opacity: 0,
                                scale: 0.8,
                            }}
                            transition={shouldAnimate ? {
                                duration: 2.8,
                                delay: drop.delay,
                                repeat: Infinity,
                                ease: [0.28, 0.08, 0.24, 1],
                            } : { duration: 0.2 }}
                        />
                    ))}
                </motion.g>

                <g aria-hidden="true">
                    <ellipse cx="180" cy="195" rx="22" ry="10" fill={idScope.url('aperture')} />
                    <ellipse cx="180" cy="192" rx="13" ry="5.5" fill="#020617" opacity="0.86" />
                    <ellipse cx="177" cy="190" rx="4.6" ry="1.4" fill="#f8fafc" opacity={lerp(0.2, 0.16, nightDepth)} />
                </g>

                <motion.g
                    aria-hidden="true"
                    initial={false}
                    animate={shouldAnimate ? {
                        opacity: [0.04, 0.38 * activityWeight, 0.04],
                        scale: [0.58, 1.1, 1.42],
                    } : {
                        opacity: renderIsActive ? 0.12 : 0.02,
                        scale: 0.86,
                    }}
                    transition={shouldAnimate ? {
                        duration: 3.1,
                        repeat: Infinity,
                        ease: 'easeOut',
                    } : { duration: 0.2 }}
                    style={{ transformOrigin: '180px 196px' }}
                >
                    <ellipse cx="180" cy="196" rx="34" ry="12" fill="none" stroke={palette.water} strokeWidth="1.4" />
                    <ellipse cx="180" cy="196" rx="52" ry="18" fill="none" stroke={palette.waterSoft} strokeWidth="1.2" />
                </motion.g>
            </svg>
        </div>
    );
}
