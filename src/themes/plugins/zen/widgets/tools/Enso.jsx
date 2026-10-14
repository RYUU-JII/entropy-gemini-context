import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useZenEnsoConstellation } from './useZenEnsoConstellation.js';
import { getArtifactVisualProfile } from '../../shared/artifactVisualProfile.js';
import {
    ZEN_ENSO_FORM,
    mountZenEnsoCanvas,
    prewarmZenEnsoStaticSnapshot,
} from '../../presentation/ZenEnsoCanvas.js';
import { clamp01, buildDailyTwinkleStars, buildDailyConstellation, withAlpha, blendHex } from '../../presentation/artifacts/engine/zenEnsoRecipe.js';
import { useZenArtifactRenderChannels } from './useZenArtifactRenderChannels.js';

const ENSO_ARTIFACT_SEED = 'zen:artifact-veil-complete';
const ENSO_ARTIFACT_STATIC_CACHE_KEY = 'zen-artifact-veil-complete-v1';
const ENSO_ARTIFACT_CANVAS_SIZE = 340;
const ENSO_ARTIFACT_PREWARM_IDLE_TIMEOUT_MS = 240;
const ENSO_ARTIFACT_PREWARM_FALLBACK_DELAY_MS = 48;

let hasScheduledEnsoPrewarm = false;

function scheduleEnsoArtifactPrewarm() {
    if (hasScheduledEnsoPrewarm || typeof window === 'undefined') return;
    hasScheduledEnsoPrewarm = true;

    const prewarm = () => {
        prewarmZenEnsoStaticSnapshot({
            seed: ENSO_ARTIFACT_SEED,
            form: ZEN_ENSO_FORM.COMPLETE,
            includePaper: false,
            inkFillMode: 'cosmic',
            staticCacheKey: ENSO_ARTIFACT_STATIC_CACHE_KEY,
            width: ENSO_ARTIFACT_CANVAS_SIZE,
            height: ENSO_ARTIFACT_CANVAS_SIZE,
        });
    };

    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(prewarm, { timeout: ENSO_ARTIFACT_PREWARM_IDLE_TIMEOUT_MS });
        return;
    }
    window.setTimeout(prewarm, ENSO_ARTIFACT_PREWARM_FALLBACK_DELAY_MS);
}

scheduleEnsoArtifactPrewarm();

export default function ZenEnso({
    isActive = true,
    color = '#c5a14a',
    artifactVisualState: fallbackArtifactVisualState = null,
    artifactRenderContext = null,
    artifactRenderState = null,
}) {
    const canvasRef = useRef(null);
    const shouldReduceMotion = useReducedMotion();
    const renderChannels = useZenArtifactRenderChannels({
        artifactRenderContext,
        artifactRenderState,
        color,
        isActive,
    });
    const renderColor = renderChannels.color;
    const renderIsActive = renderChannels.isVisuallyActive;
    const shouldAnimate = renderChannels.shouldAnimateAmbient;
    const artifactVisualState = renderChannels.visualState || fallbackArtifactVisualState;
    const visualProfile = getArtifactVisualProfile({
        themeId: 'zen',
        signatureColor: renderColor,
        isActive: renderChannels.shouldRenderEffects,
    });

    const socialMetricsRatio = clamp01(artifactVisualState?.children?.socialMetrics?.ratio);
    const timeSignalsRatio = clamp01(artifactVisualState?.children?.timeSignals?.ratio);
    const socialSurfaceRatio = clamp01(artifactVisualState?.children?.socialSurface?.ratio);
    const spiritualIntensity = clamp01(
        artifactVisualState?.overallIntensity
        ?? ((socialMetricsRatio * 0.42) + (timeSignalsRatio * 0.34) + (socialSurfaceRatio * 0.24))
    );

    const palette = useMemo(() => {
        const gold = renderColor || '#c5a14a';
        return {
            starGlow: blendHex(gold, '#bfdbfe', renderChannels.nightDepth),
        };
    }, [renderChannels.nightDepth, renderColor]);

    const ensoOpacity = renderIsActive ? 0.92 + (spiritualIntensity * 0.08) : 0.58;
    const shadowOpacity = renderIsActive ? 0.14 + (spiritualIntensity * 0.12) : 0.08;
    const contrast = renderIsActive ? 1.08 + (spiritualIntensity * 0.12) : 0.96;
    const saturation = renderIsActive ? 1.08 + (spiritualIntensity * 0.18) : 0.82;
    const twinkleLayerOpacity = renderIsActive ? 0.62 + (spiritualIntensity * 0.28) : 0.28;
    const { constellationDayKey, isConstellationVisible } = useZenEnsoConstellation(renderIsActive);
    const twinkleStars = useMemo(() => buildDailyTwinkleStars(constellationDayKey), [constellationDayKey]);
    const constellation = useMemo(
        () => buildDailyConstellation(twinkleStars, constellationDayKey),
        [constellationDayKey, twinkleStars]
    );
    const shouldAnimateConstellation = shouldAnimate && !shouldReduceMotion;

    useLayoutEffect(() => (
        mountZenEnsoCanvas(canvasRef.current, {
            seed: ENSO_ARTIFACT_SEED,
            renderMode: 'static',
            form: ZEN_ENSO_FORM.COMPLETE,
            includePaper: false,
            inkFillMode: 'cosmic',
            cosmicBreath: false,
            staticCacheKey: ENSO_ARTIFACT_STATIC_CACHE_KEY,
        })
    ), []);


    return (
        <div
            className="relative flex h-[420px] w-[420px] items-center justify-center overflow-visible pointer-events-none"
            style={{ transform: 'translateY(-12px)' }}
        >
            <motion.div
                className="absolute h-[340px] w-[340px]"
                style={{
                    filter: [
                        `contrast(${contrast})`,
                        `saturate(${saturation})`,
                        `drop-shadow(0 14px 20px rgba(2, 6, 23, ${shadowOpacity}))`,
                    ].join(' '),
                }}
                animate={{ opacity: ensoOpacity }}
                transition={{ duration: shouldAnimate ? 0.28 : 0.2, ease: visualProfile.motionEase }}
            >
                <canvas
                    ref={canvasRef}
                    aria-hidden="true"
                    className="block h-full w-full select-none"
                    width="640"
                    height="640"
                />
                <AnimatePresence>
                    {isConstellationVisible && constellation.path ? (
                        <motion.svg
                            aria-hidden="true"
                            className="absolute inset-0 pointer-events-none overflow-visible"
                            data-enso-constellation="daily"
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: shouldAnimateConstellation ? 0.34 : 0.12 }}
                            style={{
                                mixBlendMode: 'screen',
                                filter: `drop-shadow(0 0 7px ${withAlpha(palette.starGlow, 0.56)})`,
                            }}
                        >
                            <motion.path
                                d={constellation.path}
                                fill="none"
                                stroke={withAlpha(palette.starGlow, 0.28)}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.8"
                                vectorEffect="non-scaling-stroke"
                                initial={{ opacity: 0, pathLength: shouldAnimateConstellation ? 0 : 1 }}
                                animate={{ opacity: 0.9, pathLength: 1 }}
                                transition={{
                                    duration: shouldAnimateConstellation ? 1.24 : 0.16,
                                    ease: visualProfile.motionEase,
                                }}
                            />
                            <motion.path
                                d={constellation.path}
                                fill="none"
                                stroke={withAlpha('#ffffff', 0.88)}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="0.42"
                                vectorEffect="non-scaling-stroke"
                                initial={{ opacity: 0, pathLength: shouldAnimateConstellation ? 0 : 1 }}
                                animate={{ opacity: 0.86, pathLength: 1 }}
                                transition={{
                                    duration: shouldAnimateConstellation ? 1.08 : 0.16,
                                    ease: visualProfile.motionEase,
                                }}
                            />
                            {constellation.points.map((point, pointIndex) => (
                                <motion.circle
                                    key={`enso-constellation-node-${point.index}`}
                                    cx={point.x}
                                    cy={point.y}
                                    r="1.06"
                                    data-enso-constellation-node="true"
                                    fill={withAlpha('#ffffff', 0.94)}
                                    initial={{ opacity: 0, scale: shouldAnimateConstellation ? 0.5 : 1 }}
                                    animate={{
                                        opacity: shouldAnimateConstellation ? [0, 1, 0.72] : 0.78,
                                        scale: shouldAnimateConstellation ? [0.5, 1.9, 1.08] : 1,
                                    }}
                                    transition={{
                                        delay: shouldAnimateConstellation ? 0.14 + (pointIndex * 0.08) : 0,
                                        duration: shouldAnimateConstellation ? 0.86 : 0.12,
                                        ease: visualProfile.motionEase,
                                    }}
                                    style={{
                                        filter: `drop-shadow(0 0 5px ${withAlpha(palette.starGlow, 0.82)})`,
                                        transformBox: 'fill-box',
                                        transformOrigin: 'center',
                                    }}
                                />
                            ))}
                        </motion.svg>
                    ) : null}
                </AnimatePresence>
                <div
                    className="absolute inset-0 pointer-events-none overflow-visible"
                    aria-hidden="true"
                    style={{
                        mixBlendMode: 'screen',
                        opacity: twinkleLayerOpacity,
                        WebkitMaskImage: 'radial-gradient(circle at 50% 52%, transparent 0 20%, #000 24%, #000 42%, transparent 49%)',
                        maskImage: 'radial-gradient(circle at 50% 52%, transparent 0 20%, #000 24%, #000 42%, transparent 49%)',
                    }}
                >
                    {twinkleStars.map((star, index) => {
                        const isConstellationStar = isConstellationVisible && constellation.indexSet.has(index);
                        return (
                            <span
                                key={`enso-hero-star-${index}`}
                                className="absolute block"
                                data-enso-star-layout="daily"
                                data-enso-constellation-star={isConstellationStar ? 'true' : undefined}
                                style={{
                                    left: `${star.left}%`,
                                    top: `${star.top}%`,
                                    width: `${star.size}px`,
                                    height: `${star.size}px`,
                                    transform: 'translate(-50%, -50%)',
                                }}
                            >
                                {isConstellationStar ? (
                                    <motion.span
                                        className="absolute rounded-full"
                                        data-enso-constellation-flare="true"
                                        initial={{ opacity: 0, scale: shouldAnimateConstellation ? 0.42 : 1 }}
                                        animate={{
                                            opacity: shouldAnimateConstellation ? [0, 0.82, 0.18] : 0.26,
                                            scale: shouldAnimateConstellation ? [0.42, 3.8, 2.1] : 1.6,
                                        }}
                                        transition={{
                                            duration: shouldAnimateConstellation ? 0.9 : 0.12,
                                            ease: visualProfile.motionEase,
                                        }}
                                        style={{
                                            inset: `${Math.min(-2, star.size * -0.68)}px`,
                                            background: `radial-gradient(circle, ${withAlpha('#ffffff', 0.7)} 0%, ${withAlpha(palette.starGlow, 0.34)} 42%, transparent 72%)`,
                                        }}
                                    />
                                ) : null}
                                <motion.span
                                    className="absolute inset-0 block rounded-full"
                                    style={{
                                        background: `radial-gradient(circle, rgba(255,255,255,0.98) 0%, ${withAlpha(palette.starGlow, isConstellationStar ? 0.98 : 0.82)} 44%, transparent 76%)`,
                                        boxShadow: isConstellationStar
                                            ? `0 0 ${Math.max(9, star.size * 4.8)}px ${withAlpha(palette.starGlow, 0.95)}, 0 0 ${Math.max(18, star.size * 8)}px rgba(255,255,255,0.38)`
                                            : `0 0 ${Math.max(5, star.size * 3.2)}px ${withAlpha(palette.starGlow, 0.62)}, 0 0 ${Math.max(10, star.size * 5)}px rgba(255,255,255,0.22)`,
                                        filter: 'blur(0.05px)',
                                        transformOrigin: '50% 50%',
                                        willChange: 'opacity, transform',
                                    }}
                                    animate={shouldAnimate ? (isConstellationStar ? {
                                        opacity: [star.opacity * 0.72, 1, 0.82, 1, 0.76],
                                        scale: [0.92, 2.05, 1.36, 1.72, 1.12],
                                    } : {
                                        opacity: [
                                            star.opacity * 0.2,
                                            star.opacity,
                                            star.opacity * 0.34,
                                            star.opacity * 0.82,
                                            star.opacity * 0.18,
                                        ],
                                        scale: [0.56, 1.46, 0.74, 1.14, 0.62],
                                    }) : {
                                        opacity: isConstellationStar ? 0.96 : star.opacity * 0.46,
                                        scale: isConstellationStar ? 1.38 : 0.82,
                                    }}
                                    transition={shouldAnimate ? (isConstellationStar ? {
                                        duration: 1.55,
                                        repeat: Infinity,
                                        repeatDelay: 0.45,
                                        ease: visualProfile.motionEase,
                                    } : {
                                        duration: star.duration,
                                        delay: star.delay,
                                        repeat: Infinity,
                                        ease: 'easeInOut',
                                    }) : {
                                        duration: 0.2,
                                    }}
                                />
                            </span>
                        );
                    })}
                </div>
            </motion.div>
        </div>
    );
}
