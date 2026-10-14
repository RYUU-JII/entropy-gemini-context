import React from 'react';
import { motion } from 'framer-motion';
import { createArtifactSvgViewBox } from '@/themes/core/artifacts/scene/artifactSvgCoordinateSystem.js';
import { getArtifactVisualProfile } from '../../../shared/artifactVisualProfile.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useArtifactRenderChannels } from '@/themes/core/tools/useArtifactRenderChannels.js';
import { getCyberpunkArtifactMaterial } from './cyberpunkArtifactMaterial.js';

const CALL_RINGS = Array.from({ length: 3 }, (_, index) => index);
const METER_SEGMENTS = Array.from({ length: 6 }, (_, index) => index);
const SIGNAL_LINES = Array.from({ length: 3 }, (_, index) => index);
const SENTINEL_FLARE_ICON_VIEW_BOX = createArtifactSvgViewBox(24, 24);

export default function CyberpunkSentinelFlare({
    color: fallbackColor = '#ff2d72',
    isActive: fallbackIsActive = true,
    artifactRenderContext = null,
    artifactRenderState: fallbackArtifactRenderState = null,

    mode = 'stable',
    systemMode = 'cyberpunk',
}) {
    const { t } = useAppTranslation('tools');
    const renderChannels = useArtifactRenderChannels({
        artifactRenderContext,
        artifactRenderState: fallbackArtifactRenderState,
        color: fallbackColor,
        isActive: fallbackIsActive,
        systemMode,
    });
    const color = renderChannels.color;
    const isActive = renderChannels.isVisuallyActive;
    const material = getCyberpunkArtifactMaterial(isActive);
    const artifactRenderState = renderChannels.renderState;
    const visualProfile = getArtifactVisualProfile({
        themeId: renderChannels.themeId || systemMode,
        signatureColor: color,
        isActive,
        artifactRenderState,
    });
    const shouldAnimate = renderChannels.shouldAnimateMotion;
    const isVolatile = mode === 'volatile';
    const pulseDuration = isVolatile ? 0.8 : 1.4;
    const activeMeterThreshold = isVolatile ? 5 : 4;

    return (
        <div
            data-artifact-material={material.mode}
            className="pointer-events-none relative flex h-[252px] w-[190px] items-end justify-center overflow-hidden rounded-xl"
            style={visualProfile.backgroundStyle}
        >
            <div className="absolute inset-0" style={visualProfile.materialOverlayStyle} />

            <motion.div
                className="absolute bottom-[78px] h-[128px] w-[160px]"
                style={{
                    background: `linear-gradient(180deg, ${color}88 0%, #00f3ff22 38%, transparent 100%)`,
                    clipPath: 'polygon(50% 0%, 86% 100%, 14% 100%)',
                    filter: 'blur(1px)',
                }}
                animate={shouldAnimate
                    ? {
                        opacity: [0.22, 0.8, 0.22],
                        scaleX: [0.88, 1.08, 0.88],
                    }
                    : {
                        opacity: 0.08,
                        scaleX: 0.84,
                    }}
                transition={shouldAnimate ? { duration: pulseDuration, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
            />

            {CALL_RINGS.map((ring) => (
                <motion.div
                    key={`call-ring-${ring}`}
                    className="absolute left-1/2 top-[30px] rounded-full border border-dashed"
                    style={{
                        borderColor: ring % 2 === 0 ? `${color}99` : '#00f3ffaa',
                        width: `${48 + ring * 26}px`,
                        height: `${48 + ring * 26}px`,
                        marginLeft: `${-(48 + ring * 26) / 2}px`,
                        marginTop: `${-(48 + ring * 26) / 2}px`,
                    }}
                    animate={shouldAnimate ? { scale: [0.72, 1.24], opacity: [0, 0.66, 0] } : { opacity: 0, scale: 1 }}
                    transition={shouldAnimate ? {
                        duration: isVolatile ? 1.3 : 2.1,
                        delay: ring * 0.26,
                        repeat: Infinity,
                        ease: 'easeOut',
                    } : { duration: 0, repeat: 0, delay: 0 }}
                />
            ))}

            <motion.div
                className="absolute left-1/2 top-[48px] flex h-[52px] w-[52px] -translate-x-1/2 items-center justify-center rounded-full border"
                style={{
                    borderColor: material.edge(`${color}bb`),
                    background: material.face('radial-gradient(circle, rgba(0,0,0,0.35) 0%, rgba(2,7,18,0.96) 100%)'),
                }}
                animate={shouldAnimate
                    ? {
                        opacity: [0.55, 1, 0.55],
                        boxShadow: [`0 0 8px ${color}66`, `0 0 20px ${color}`, `0 0 8px ${color}66`],
                    }
                    : {
                        opacity: 1,
                        boxShadow: 'none',
                    }}
                transition={shouldAnimate ? { duration: pulseDuration, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
            >
                <svg viewBox={SENTINEL_FLARE_ICON_VIEW_BOX} className="h-7 w-7" fill="none" stroke="currentColor" style={{ color: material.innerEdge(color) }}>
                    <polygon points="12 3 20 8 20 16 12 21 4 16 4 8 12 3" strokeWidth="1.4" />
                    <circle cx="12" cy="12" r="2.2" strokeWidth="1.4" />
                    <path d="M12 6v2.3M12 15.7V18M6.2 12H8.5M15.5 12h2.3" strokeWidth="1.2" opacity="0.85" />
                </svg>
            </motion.div>

            <motion.div
                className="absolute bottom-[72px] left-1/2 h-[96px] w-[3px] -translate-x-1/2"
                style={{
                    background: material.innerEdge(`linear-gradient(180deg, transparent 0%, #00f3ff 30%, ${color} 72%, transparent 100%)`),
                }}
                animate={shouldAnimate ? { opacity: [0.2, 0.95, 0.2] } : { opacity: 1 }}
                transition={shouldAnimate ? { duration: pulseDuration, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
            />

            <motion.div
                className="relative z-10 mb-6 h-[88px] w-[128px] overflow-hidden rounded-[12px] border"
                style={{ borderColor: material.edge('#2d4c74'), background: material.face('#020813') }}
                animate={shouldAnimate
                    ? {
                        opacity: 1,
                        boxShadow: [`0 0 10px ${color}26`, `0 0 20px ${color}5a`, `0 0 10px ${color}26`],
                    }
                    : {
                        opacity: 1,
                        boxShadow: 'none',
                    }}
                transition={shouldAnimate ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
            >
                <div className="absolute inset-x-3 top-2 text-center text-[8px] font-black uppercase tracking-[0.2em]" style={{ color: material.caption('#b5dcff') }}>
                    {t('matrix.artifact_visuals.sentinel_flare_title')}
                </div>

                <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
                    {METER_SEGMENTS.map((segment) => (
                        <motion.span
                            key={`meter-${segment}`}
                            className="h-[14px] w-[6px] border"
                            style={{ borderColor: material.innerEdge('#2f537c') }}
                            animate={shouldAnimate
                                ? {
                                    backgroundColor: segment < activeMeterThreshold ? color : '#061224',
                                    boxShadow: segment < activeMeterThreshold ? `0 0 8px ${color}` : 'none',
                                }
                                : {
                                    backgroundColor: material.face('#050a14'),
                                    boxShadow: 'none',
                                }}
                            transition={{ duration: 0.2, delay: segment * 0.04 }}
                        />
                    ))}
                </div>

                <motion.div
                    className="absolute left-1/2 top-[34px] h-[22px] w-[22px] -translate-x-1/2 rounded-full border"
                    style={{ borderColor: material.innerEdge('#3a608b'), background: material.face('#000') }}
                    animate={shouldAnimate
                        ? {
                            scale: [1, 1.1, 1],
                            opacity: 1,
                            boxShadow: [`0 0 8px ${color}77`, `0 0 18px ${color}`, `0 0 8px ${color}77`],
                        }
                        : {
                            opacity: 1,
                            scale: 1,
                            boxShadow: 'none',
                        }}
                    transition={shouldAnimate ? { duration: pulseDuration, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
                />

                {isVolatile && shouldAnimate && SIGNAL_LINES.map((line) => (
                    <motion.div
                        key={`signal-line-${line}`}
                        className="absolute left-0 right-0 h-px bg-[#00f3ff]"
                        style={{ top: `${24 + line * 14}px` }}
                        animate={{ opacity: [0, 0.9, 0], x: ['-6%', '6%', '-6%'] }}
                        transition={{ duration: 0.28, delay: line * 0.05, repeat: Infinity, ease: 'linear' }}
                    />
                ))}
            </motion.div>

            <div className="absolute bottom-2 text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: material.caption('#ffd4e3') }}>
                {t('matrix.artifact_visuals.sentinel_flare_link')}
            </div>
        </div>
    );
}
