import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { getArtifactVisualProfile } from '../../shared/artifactVisualProfile.js';
import { useZenArtifactRenderChannels } from './useZenArtifactRenderChannels.js';
import { createArtifactSvgViewBox } from '@/themes/core/artifacts/scene/artifactSvgCoordinateSystem.js';

import {
    VIEWBOX_WIDTH,
    VIEWBOX_HEIGHT,
    FRAME_WIDTH,
    FRAME_HEIGHT,
    WAVE_RX,
    WAVE_RY,
    WAVE_RINGS,
    FILL_BLEED_X,
    FILL_BLEED_Y,
    BOB_DISTANCE_ACTIVE,
    BOB_DISTANCE_IDLE,
    BOB_DURATION_ACTIVE,
    BOB_DURATION_IDLE,
    withAlpha,
    createZenGreatWaveGrid
} from '../../presentation/artifacts/engine/zenGreatWaveRecipe.js';

// SVG coordinate projection belongs to this document surface. The retained
// Worker executor consumes the shared numeric grid without SVG-only owners.
const GREAT_WAVE_VIEW_BOX = createArtifactSvgViewBox(VIEWBOX_WIDTH, VIEWBOX_HEIGHT);

export default function ZenGreatWave({
    isActive = true,
    color = '#2f6f9e',
    artifactRenderContext = null,
    artifactRenderState = null,
}) {
    const renderChannels = useZenArtifactRenderChannels({
        artifactRenderContext,
        artifactRenderState,
        color,
        isActive,
    });
    const renderColor = renderChannels.color;
    const renderIsActive = renderChannels.isVisuallyActive;
    const shouldAnimate = renderChannels.shouldAnimateAmbient;
    const visualProfile = getArtifactVisualProfile({
        themeId: 'zen',
        signatureColor: renderColor,
        isActive: renderChannels.shouldRenderEffects,
    });

    // Generate grid points with ellipse-aware packing.
    const waves = useMemo(() => {
        return createZenGreatWaveGrid({ color: renderColor, isActive: renderIsActive });
    }, [renderColor, renderIsActive]);
    const frameGlow = renderIsActive
        ? withAlpha(renderColor, 0.14, 'rgba(14, 165, 233, 0.14)')
        : 'rgba(15, 23, 42, 0.18)';
    const innerBoxShadow = visualProfile.backgroundStyle?.boxShadow
        ? `${visualProfile.backgroundStyle.boxShadow}, inset 0 0 46px rgba(2,6,23,0.5)`
        : 'inset 0 0 46px rgba(2,6,23,0.5)';

    return (
        <div
            className="relative pointer-events-none overflow-visible"
            style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT, transform: 'translateY(-20px)' }}
        >
            <div className="absolute left-7 right-7 bottom-[-14px] h-8 rounded-[999px] bg-slate-950/40 blur-2xl" />
            <div
                className="relative h-full w-full rounded-[2px] p-[6px]"
                style={{
                    backgroundImage: 'linear-gradient(145deg, #111827 0%, #05070c 48%, #020617 100%)',
                    boxShadow: `0 26px 46px rgba(2,6,23,0.44), 0 8px 16px rgba(2,6,23,0.28), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 22px ${frameGlow}`,
                }}
            >
                <div className="absolute inset-[2px] rounded-[1px] border border-white/[0.07]" />
                <div className="absolute inset-[6px] rounded-[1px] border border-black/80 shadow-[inset_0_1px_8px_rgba(0,0,0,0.8)]" />
                <div
                    className="relative h-full w-full overflow-hidden rounded-[1px] border border-slate-950/90 bg-[#fdfcf8]"
                    style={{
                        ...visualProfile.backgroundStyle,
                        boxShadow: innerBoxShadow,
                    }}
                >
                    <svg viewBox={GREAT_WAVE_VIEW_BOX} className="absolute inset-0 h-full w-full">
                        {waves.map((w) => (
                            <WaveUnit
                                key={w.id}
                                x={w.x}
                                y={w.y}
                                delay={w.delay}
                                strokeColor={w.strokeColor}
                                strokeWidth={w.strokeWidth}
                                bobDistance={renderIsActive ? BOB_DISTANCE_ACTIVE : BOB_DISTANCE_IDLE}
                                bobDuration={renderIsActive ? BOB_DURATION_ACTIVE : BOB_DURATION_IDLE}
                                shouldAnimate={shouldAnimate}
                            />
                        ))}
                    </svg>

                    <div className="absolute inset-0 pointer-events-none" style={visualProfile.materialOverlayStyle} />
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,rgba(2,6,23,0.58)_0%,rgba(15,23,42,0.28)_42%,rgba(15,23,42,0.08)_100%)] mix-blend-multiply" />
                    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_72%,transparent_18%,rgba(2,6,23,0.26)_67%,rgba(2,6,23,0.62)_100%)] mix-blend-multiply" />
                    <div className="absolute inset-x-0 top-0 h-1/4 pointer-events-none bg-[linear-gradient(to_bottom,rgba(255,255,255,0.08),transparent)] mix-blend-screen" />
                </div>
            </div>
        </div>
    );
}

/**
 * Single Seigaiha Wave Unit (Elliptical)
 */
const WaveUnit = ({ x, y, delay, strokeColor, strokeWidth, bobDistance, bobDuration, shouldAnimate }) => {
    // Generate concentric ellipses radii
    const rings = useMemo(() => {
        return Array.from({ length: WAVE_RINGS }, (_, i) => {
            // Linear ring shrinking
            const factor = 1 - (i / WAVE_RINGS);
            return {
                rx: WAVE_RX * factor,
                ry: WAVE_RY * factor
            };
        });
    }, []);

    return (
        <motion.g
            initial={{ y }}
            animate={shouldAnimate ? { y: [y, y - bobDistance, y] } : { y }}
            transition={shouldAnimate
                ? {
                    duration: bobDuration,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: delay,
                }
                : { duration: 0.2, ease: "linear" }}
        >
            <g transform={`translate(${x}, 0)`}>
                {/* 
                   Background Fill (Upper Semi-Ellipse):
                   Crucial for masking.
                   M -rx,0 A rx,ry 0 0,1 rx,0 Z (Close path)
                */}
                <path
                    d={`M -${WAVE_RX + FILL_BLEED_X},0 A ${WAVE_RX + FILL_BLEED_X},${WAVE_RY + FILL_BLEED_Y} 0 0,1 ${WAVE_RX + FILL_BLEED_X},0 Z`}
                    fill="#fdfcf8"
                />

                {/* Concentric Stroked Arcs */}
                {rings.map((ring, i) => (
                    <motion.path
                        key={i}
                        d={`M -${ring.rx},0 A ${ring.rx},${ring.ry} 0 0,1 ${ring.rx},0`}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />
                ))}
            </g>
        </motion.g>
    );
};
