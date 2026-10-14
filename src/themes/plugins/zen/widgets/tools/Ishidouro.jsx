// Ishidouro.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { createArtifactSvgViewBox } from '@/themes/core/artifacts/scene/artifactSvgCoordinateSystem.js';
import { useZenArtifactRenderChannels } from './useZenArtifactRenderChannels.js';

// Cyber-Zen Ishidouro (Causality Lantern)
// Metaphor: An anomalous time anchor that erases causes and severs loops.
// Visual: A mossy stone lantern with a glowing containment core.
// The pillar represents containment, the light represents the causality-erasure field.

const ISHIDOURO_CHUDAIDOU_VIEW_BOX = createArtifactSvgViewBox(128, 24);

export default function ZenIshidouro({
    isActive = true,
    color = '#17191c',
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
    const isObsidianSignature = renderChannels.colorTokens?.family === 'sumi'
        || renderColor === '#17191c'
        || renderColor === '#050505'
        || renderColor === '#000000';
    const coreColor = isObsidianSignature ? '#f8fafc' : renderColor;

    return (
        <div
            className="relative w-[300px] h-[300px] flex items-center justify-center pointer-events-none overflow-visible"
            style={{ transform: 'translateY(-45px)' }}
        >
            <div className="relative">

                {/* THE LANTERN STRUCTURE */}
                <div className="relative flex flex-col items-center z-10">

                {/* 1. Hoju (Top Jewel - Premium Water Lily Bud) */}
                <div className="relative w-8 h-10 mb-[-6px] z-20 flex flex-col items-center">
                    {/* Jewel Shape */}
                    <div className="w-6 h-8 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),inset_0_-4px_6px_rgba(0,0,0,0.6)]"
                        style={{ backgroundImage: 'radial-gradient(circle at 35% 25%, #a8a29e 0%, #57534e 40%, #292524 100%)' }} />
                    <div className="w-8 h-2 bg-stone-600 rounded-full mt-[-2px] shadow-[inset_0_-1px_2px_currentColor]" />
                </div>

                {/* 2. Ukebana (Pedal - Top of roof) */}
                <div className="w-14 h-4 rounded-t-[50%_50%_100%_100%] mb-[-2px] z-40 overflow-hidden"
                    style={{
                        background: 'linear-gradient(to bottom, #78716c, #44403c)',
                        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.5)'
                    }}>
                    {/* Water lily petal carved lines */}
                    <div className="flex w-full h-full justify-evenly opacity-30">
                        <div className="w-px h-full bg-black" /><div className="w-px h-full bg-black" /><div className="w-px h-full bg-black" />
                    </div>
                </div>

                {/* 3. Kasa (Roof - Angular Pagoda Style, matching the base style) */}
                <div className="relative z-30 flex flex-col items-center mb-[-6px] drop-shadow-2xl">
                    {/* Upper sloping trapezoid */}
                    <div
                        className="w-44 h-12 bg-linear-to-b/srgb from-stone-600 to-stone-800 shadow-inner relative overflow-hidden"
                        style={{ clipPath: 'polygon(38% 0, 62% 0, 100% 100%, 0 100%)' }}
                    >
                        {/* Subtle Stone Texture Pattern (Performance friendly) */}
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                            style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000, #000 1px, transparent 1px, transparent 10px)' }} />

                    </div>
                    {/* Bottom Thick Rim */}
                    <div className="w-52 h-6 bg-linear-to-b/srgb from-stone-700 to-stone-900 rounded-sm shadow-[0_5px_15px_rgba(0,0,0,0.9)] relative overflow-hidden">
                        {/* Subtle Stone Texture Pattern */}
                        <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
                            style={{ backgroundImage: 'repeating-linear-gradient(-45deg, #000, #000 1px, transparent 1px, transparent 8px)' }} />

                        {/* Edge highlights */}
                        <div className="absolute top-0 w-full h-px bg-white/10" />

                    </div>
                </div>

                {/* 4. HIBUKURO (Firebox - The Core with Intricate Latticework) */}
                <div className="relative w-28 h-28 bg-stone-900 flex items-center justify-center z-15 shadow-[0_10px_20px_rgba(0,0,0,0.6)]">
                    {/* Recessed Frame Edges (음각 효과) */}
                    <div className="absolute inset-0 border-[6px] border-stone-800 z-20 shadow-[inset_0_0_15px_rgba(0,0,0,0.9)]" />
                    <div className="absolute inset-0 border-t-[8px] border-b-[8px] border-stone-900/50 z-20" />

                    {/* Shadow/Depth inside box */}
                    <div className="absolute inset-0 bg-black/60 shadow-[inset_0_0_25px_black]" />

                    {/* THE CORE (Holographic Flame/Data Oracle) */}
                    <motion.div
                        className="w-14 h-14 rounded-full relative"
                        style={{
                            backgroundColor: coreColor,
                            boxShadow: `0 0 40px ${coreColor}, 0 0 80px ${coreColor}66, inset 0 0 10px white`,
                            filter: 'blur(1px)'
                        }}
                        animate={{
                            scale: renderIsActive ? [1, 1.05, 0.98, 1.02, 1] : 1,
                            y: renderIsActive ? [0, -4, 2, -2, 0] : 0,
                            opacity: renderIsActive ? 1 : 0.3
                        }}
                        transition={shouldAnimate
                            ? { duration: 6, repeat: Infinity, ease: "easeInOut" }
                            : { duration: 0.2, ease: "linear" }}
                    >
                        {/* Core Entropy Lines (Plasma flicker) */}
                        {shouldAnimate && Array.from({ length: 4 }).map((_, i) => (
                            <motion.div
                                key={i}
                                className="absolute w-full h-[2px] bg-white rounded-full blur-[1px]"
                                style={{ top: `${20 + i * 20}%` }}
                                animate={{
                                    x: [(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10],
                                    opacity: [0, 0.4, 0],
                                    scaleX: [0.8, 1.2, 0.8]
                                }}
                                transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: i * 0.5 }}
                            />
                        ))}
                    </motion.div>

                    {/* Intricate Latticework (Window Grids) */}
                    <div className="absolute inset-0 p-[12px] flex flex-col justify-between pointer-events-none">
                        {/* Horizontal Bars (Top & Bottom only) */}
                        <div className="w-full h-1.5 bg-stone-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border-y border-stone-700/20" />
                        <div className="w-full h-1.5 bg-stone-900 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] border-y border-stone-700/20" />
                    </div>
                    <div className="absolute inset-0 p-[12px] flex justify-between pointer-events-none">
                        {/* Vertical Bars (Recessed) */}
                        <div className="w-1.5 h-full bg-stone-900 shadow-[inset_1px_0_2px_rgba(0,0,0,0.8)] border-x border-stone-700/20" />
                        <div className="w-1.5 h-full bg-stone-900 shadow-[inset_1px_0_2px_rgba(0,0,0,0.8)] border-x border-stone-700/20" />
                    </div>

                    {/* Light Spill (God Rays - "Digital TopShadow") */}
                    {shouldAnimate && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-visible">
                            {/* Main Volumetric Beams - Optimized Single Layer */}
                            <motion.div
                                className="absolute w-[440px] h-[440px] blur-xl"
                                style={{
                                    background: `conic-gradient(from 0deg at 50% 50%,
                                        transparent 0deg, ${coreColor} 15deg, transparent 45deg,
                                        ${coreColor} 90deg, transparent 135deg,
                                        ${coreColor} 180deg, transparent 225deg,
                                        ${coreColor} 270deg, transparent 315deg,
                                        transparent 360deg)`,
                                    mixBlendMode: 'screen',
                                    opacity: renderChannels.nightDepth * 0.25,
                                }}
                                animate={{ rotate: [0, 360] }}
                                transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                            />
                        </div>
                    )}
                </div>

                {/* 5. Chudaidou (Middle Platform - Flared) */}
                <div className="relative w-32 h-9 mb-[-5px] z-20 flex flex-col items-center">
                    <div className="w-full h-3 bg-linear-to-b/srgb from-stone-600 to-stone-700 rounded-t-sm shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]" />
                    {/* Bottom flare: Flat where it touches the pillar (center), curved on the outer edges */}
                    <svg className="w-full h-6 drop-shadow-md" viewBox={ISHIDOURO_CHUDAIDOU_VIEW_BOX} preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="chu-bottom-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#44403c" />
                                <stop offset="100%" stopColor="#1c1917" />
                            </linearGradient>
                        </defs>
                        <path d="M 0 0 L 128 0 L 120 18 Q 115 24 100 24 L 28 24 Q 13 24 8 18 Z" fill="url(#chu-bottom-grad)" />
                    </svg>
                </div>

                {/* 6. Saodou (Pillar - Textured & Fluted) */}
                <div className="relative w-20 h-36 bg-stone-700 flex flex-col items-center shadow-[inset_4px_0_10px_rgba(0,0,0,0.5),inset_-2px_0_5px_rgba(255,255,255,0.1)] overflow-hidden">
                    {/* Vertical Fluting (Stone texture lines) */}
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 4px, #000 4px, #000 6px)' }} />

                    {/* Engraved Rune/Logo (Deep Carve) */}
                    <div className="mt-6 w-8 h-14 border-2 border-y-transparent border-black/40 flex flex-col items-center justify-center gap-2 relative shadow-[inset_0_0_10px_rgba(0,0,0,0.8)] bg-black/20">
                        {/* Glowing highlight in the rune */}
                        {shouldAnimate && (
                            <motion.div
                                className="absolute inset-0 blur-sm"
                                style={{ backgroundColor: `${coreColor}1f` }}
                                animate={{ opacity: [0.18, 0.42, 0.18] }}
                                transition={{ duration: 3, repeat: Infinity }}
                            />
                        )}
                        <div className="w-4 h-[2px] bg-black shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
                        <div className="w-2 h-[2px] bg-black shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
                        <div className="w-4 h-[2px] bg-black shadow-[0_1px_0_rgba(255,255,255,0.2)]" />
                    </div>

                </div>

                {/* 7. Kiso (Base - Tiered Water Lily Style) */}
                <div className="relative z-0 flex flex-col items-center mb-6">
                    {/* Top Tier */}
                    <div className="w-28 h-4 bg-linear-to-b/srgb from-stone-600 to-stone-800 rounded-t-lg shadow-inner" />
                    {/* Middle Tier (Main Block) */}
                    <div className="w-40 h-8 bg-linear-to-b/srgb from-stone-700 to-stone-900 rounded-sm shadow-[0_5px_15px_rgba(0,0,0,0.8)] relative overflow-hidden">
                        {/* Edge highlights */}
                        <div className="absolute top-0 w-full h-px bg-white/10" />
                    </div>
                    {/* Bottom Grounding Tier */}
                    <div className="w-44 h-4 bg-black/80 rounded-b-xl blur-[1px]" />
                </div>

            </div>

            {/* "Digital Dust" Particles */}
            {shouldAnimate && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute bg-white/40 rounded-full blur-[0.5px]"
                            style={{
                                width: Math.random() * 2 + 1 + 'px',
                                height: Math.random() * 2 + 1 + 'px',
                                left: `${10 + Math.random() * 80}%`,
                                top: `${60 + Math.random() * 40}%`, // Start lower
                            }}
                            animate={{
                                y: [-20, -100 - Math.random() * 50], // Drift Up
                                x: [0, (Math.random() - 0.5) * 30], // Slight horizontal drift
                                opacity: [0, 0.6, 0],
                                scale: [0, 1, 0],
                            }}
                            transition={{
                                duration: 3 + Math.random() * 4,
                                repeat: Infinity,
                                delay: i * 0.5,
                                ease: 'easeOut',
                            }}
                        />
                    ))}
                </div>
            )}

        </div>
        </div>
    );
}
