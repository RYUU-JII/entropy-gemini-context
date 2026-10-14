import React from 'react';
import { motion } from 'framer-motion';
import { createArtifactSvgViewBox } from '@/themes/core/artifacts/scene/artifactSvgCoordinateSystem.js';
import { getArtifactVisualProfile } from '../../../shared/artifactVisualProfile.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useArtifactRenderChannels } from '@/themes/core/tools/useArtifactRenderChannels.js';
import { getMatrixArtifactMaterial } from './matrixArtifactMaterial.js';

const CALL_RINGS = Array.from({ length: 3 }, (_, index) => index);
const METER_SEGMENTS = Array.from({ length: 6 }, (_, index) => index);
const SENTINEL_FLARE_ICON_VIEW_BOX = createArtifactSvgViewBox(24, 24);

export default function SentinelFlare({
    color: fallbackColor = '#22c55e',
    isActive: fallbackIsActive = true,
    artifactRenderContext = null,
    artifactRenderState: fallbackArtifactRenderState = null,

    mode = 'stable',
    systemMode = 'matrix',
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
    const material = getMatrixArtifactMaterial(isActive);
    const artifactRenderState = renderChannels.renderState;
    const visualProfile = getArtifactVisualProfile({
        themeId: renderChannels.themeId || systemMode,
        signatureColor: color,
        isActive,
        artifactRenderState,
    });
    const shouldAnimate = renderChannels.shouldAnimateMotion;
    const isVolatile = mode === 'volatile';
    const pulseDuration = isVolatile ? 0.85 : 1.5;

    return (
        <div
            data-artifact-material={material.mode}
            className="pointer-events-none relative flex h-[250px] w-[190px] items-end justify-center overflow-hidden rounded-xl"
            style={visualProfile.backgroundStyle}
        >
            <div className="absolute inset-0" style={visualProfile.materialOverlayStyle} />

            <motion.div
                className="absolute bottom-[80px] h-[122px] w-[154px]"
                style={{
                    background: `linear-gradient(180deg, ${color}77 0%, ${color}1f 40%, transparent 100%)`,
                    clipPath: 'polygon(50% 0%, 86% 100%, 14% 100%)',
                    filter: 'blur(1px)',
                }}
                animate={shouldAnimate
                    ? {
                        opacity: [0.2, 0.72, 0.2],
                        scaleX: [0.9, 1.06, 0.9],
                    }
                    : {
                        opacity: 0.08,
                        scaleX: 0.85,
                    }}
                transition={shouldAnimate ? { duration: pulseDuration, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
            />

            {CALL_RINGS.map((ring) => (
                <motion.div
                    key={`call-ring-${ring}`}
                    className="absolute left-1/2 top-[30px] rounded-full border border-dashed"
                    style={{
                        borderColor: `${color}99`,
                        width: `${48 + ring * 26}px`,
                        height: `${48 + ring * 26}px`,
                        marginLeft: `${-(48 + ring * 26) / 2}px`,
                        marginTop: `${-(48 + ring * 26) / 2}px`,
                    }}
                    animate={shouldAnimate ? { scale: [0.72, 1.24], opacity: [0, 0.6, 0] } : { opacity: 0, scale: 1 }}
                    transition={shouldAnimate ? {
                        duration: isVolatile ? 1.4 : 2.2,
                        delay: ring * 0.28,
                        repeat: Infinity,
                        ease: 'easeOut',
                    } : { duration: 0, repeat: 0, delay: 0 }}
                />
            ))}

            <motion.div
                className="absolute left-1/2 top-[48px] flex h-[52px] w-[52px] -translate-x-1/2 items-center justify-center rounded-full border"
                style={{
                    borderColor: material.edge(`${color}bb`),
                    background: material.face('radial-gradient(circle, rgba(0,0,0,0.4) 0%, rgba(2,6,3,0.95) 100%)'),
                }}
                animate={shouldAnimate
                    ? {
                        opacity: [0.6, 1, 0.6],
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
                className="absolute bottom-[72px] left-1/2 h-[94px] w-[3px] -translate-x-1/2"
                style={{
                    background: material.innerEdge(`linear-gradient(180deg, transparent 0%, ${color} 30%, ${color} 70%, transparent 100%)`),
                }}
                animate={shouldAnimate ? { opacity: [0.2, 0.9, 0.2] } : { opacity: 1 }}
                transition={shouldAnimate ? { duration: pulseDuration, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
            />

            <motion.div
                className="relative z-10 mb-6 h-[86px] w-[126px] overflow-hidden rounded-[12px] border border-[#1f4727] bg-[#020703]"
                style={{ borderColor: material.edge('#1f4727'), background: material.face('#020703') }}
                animate={shouldAnimate
                    ? {
                        opacity: 1,
                        boxShadow: [`0 0 10px ${color}26`, `0 0 18px ${color}55`, `0 0 10px ${color}26`],
                    }
                    : {
                        opacity: 1,
                        boxShadow: 'none',
                    }}
                transition={shouldAnimate ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
            >
                <div className="absolute inset-x-3 top-2 text-center text-[8px] font-black uppercase tracking-[0.18em] text-[#8ad99a]"
                    style={{ color: material.caption('#8ad99a') }}>
                    {t('matrix.artifact_visuals.sentinel_flare_title')}
                </div>

                <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
                    {METER_SEGMENTS.map((segment) => (
                        <motion.span
                            key={`meter-${segment}`}
                            className="h-[14px] w-[6px] border border-[#214a28]"
                            style={{ borderColor: material.innerEdge('#214a28') }}
                            animate={shouldAnimate
                                ? {
                                    backgroundColor: segment < 4 ? color : '#07140a',
                                    boxShadow: segment < 4 ? `0 0 8px ${color}` : 'none',
                                }
                                : {
                                    backgroundColor: material.face('#050905'),
                                    boxShadow: 'none',
                                }}
                            transition={{ duration: 0.2, delay: segment * 0.04 }}
                        />
                    ))}
                </div>

                <motion.div
                    className="absolute left-1/2 top-[34px] h-[22px] w-[22px] -translate-x-1/2 rounded-full border border-[#335e3a] bg-black"
                    style={{ borderColor: material.edge('#335e3a'), background: material.face('#000000') }}
                    animate={shouldAnimate
                        ? {
                            opacity: 1,
                            scale: [1, 1.1, 1],
                            boxShadow: [`0 0 8px ${color}77`, `0 0 18px ${color}`, `0 0 8px ${color}77`],
                        }
                        : {
                            opacity: 1,
                            scale: 1,
                            boxShadow: 'none',
                        }}
                    transition={shouldAnimate ? { duration: pulseDuration, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
                />
            </motion.div>

            <div className="absolute bottom-2 text-[9px] font-black uppercase tracking-[0.2em] text-[#9adca8]"
                style={{ color: material.caption('#9adca8') }}>
                {t('matrix.artifact_visuals.sentinel_flare_link')}
            </div>
        </div>
    );
}
