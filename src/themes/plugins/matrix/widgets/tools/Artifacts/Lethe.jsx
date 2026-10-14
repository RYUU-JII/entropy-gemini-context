import React from 'react';
import { motion } from 'framer-motion';
import { getArtifactVisualProfile } from '../../../shared/artifactVisualProfile.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useArtifactRenderChannels } from '@/themes/core/tools/useArtifactRenderChannels.js';
import { getMatrixArtifactMaterial } from './matrixArtifactMaterial.js';

const WIPE_RINGS = Array.from({ length: 3 }, (_, index) => index);
const MEMORY_SHARDS = [-56, -32, -10, 10, 32, 56];

export default function Lethe({
    color: fallbackColor = '#f8fafc',
    isActive: fallbackIsActive = true,
    artifactRenderContext = null,
    artifactRenderState: fallbackArtifactRenderState = null,
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

    return (
        <div
            data-artifact-material={material.mode}
            className="pointer-events-none relative flex h-[260px] w-[210px] items-center justify-center overflow-hidden rounded-xl"
            style={visualProfile.backgroundStyle}
        >
            <div className="absolute inset-0" style={visualProfile.materialOverlayStyle} />

            <motion.div
                className="absolute inset-0 bg-white mix-blend-screen"
                animate={shouldAnimate
                    ? { opacity: [0, 0, 0.78, 0, 0] }
                    : { opacity: 0 }}
                transition={shouldAnimate ? { duration: 4.8, repeat: Infinity, times: [0, 0.54, 0.6, 0.68, 1], ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
            />

            <div className="relative flex h-[224px] w-[122px] flex-col items-center justify-end">
                <motion.div
                    className="absolute top-[22px] h-[58px] w-[58px] rounded-full border"
                    style={{
                        borderColor: material.edge(`${color}aa`),
                        background: material.face('radial-gradient(circle at 50% 42%, rgba(255,255,255,0.98) 0%, rgba(218,245,255,0.72) 35%, rgba(3,7,18,0.95) 100%)'),
                    }}
                    animate={shouldAnimate
                        ? {
                            opacity: 1,
                            scale: [1, 1.05, 1],
                            boxShadow: [`0 0 10px ${color}66`, `0 0 28px ${color}`, `0 0 10px ${color}66`],
                        }
                        : {
                            opacity: 1,
                            scale: 0.95,
                            boxShadow: 'none',
                        }}
                    transition={shouldAnimate ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
                >
                    <div className="absolute inset-[24%] rounded-full border border-white/50" />
                </motion.div>

                {WIPE_RINGS.map((ring) => (
                    <motion.div
                        key={`wipe-ring-${ring}`}
                        className="absolute left-1/2 top-[50px] rounded-full border"
                        style={{
                            borderColor: `${color}aa`,
                            width: `${38 + ring * 16}px`,
                            height: `${38 + ring * 16}px`,
                            marginLeft: `${-(38 + ring * 16) / 2}px`,
                            marginTop: `${-(38 + ring * 16) / 2}px`,
                        }}
                        animate={shouldAnimate ? { scale: [0.45, 1.4, 2], opacity: [0, 0.75, 0] } : { opacity: 0, scale: 1 }}
                        transition={shouldAnimate ? { duration: 2.3, delay: ring * 0.36, repeat: Infinity, ease: 'easeOut' } : { duration: 0, repeat: 0, delay: 0 }}
                    />
                ))}

                {MEMORY_SHARDS.map((offset, index) => (
                    <motion.div
                        key={`memory-shard-${offset}`}
                        className="absolute left-1/2 top-[62px] h-[2px] w-[14px] rounded-full"
                        style={{
                            marginLeft: '-7px',
                            background: color,
                        }}
                        animate={shouldAnimate
                            ? {
                                x: [offset * 0.2, offset * 0.7],
                                y: [0, -22 - index * 4],
                                opacity: [0.1, 0.8, 0],
                            }
                            : {
                                opacity: 0,
                                x: 0,
                                y: 0,
                            }}
                        transition={shouldAnimate ? { duration: 1.3, delay: index * 0.08, repeat: Infinity, ease: 'easeOut' } : { duration: 0, repeat: 0, delay: 0 }}
                    />
                ))}

                <motion.div
                    className="relative h-[162px] w-[56px] overflow-hidden rounded-[14px] border border-[#28412d] bg-[#060a07]"
                    style={{ borderColor: material.edge('#28412d'), background: material.face('#060a07') }}
                    animate={shouldAnimate ? { y: [0, -2, 0], opacity: 1 } : { opacity: 1, y: 0 }}
                    transition={shouldAnimate ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
                >
                    <div className="absolute inset-x-[9px] top-[12px] bottom-[12px] rounded-[9px] border border-[#36513a] bg-black/70"
                        style={{ borderColor: material.innerEdge('#36513a') }} />

                    <motion.div
                        className="absolute inset-x-[12px] h-[22px] rounded-[8px]"
                        style={{
                            background: `linear-gradient(180deg, ${color}66 0%, transparent 100%)`,
                        }}
                        animate={shouldAnimate ? { y: [8, 126, 8], opacity: [0.2, 0.66, 0.2] } : { y: 64, opacity: 0.08 }}
                        transition={shouldAnimate ? { duration: 2.9, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
                    />

                    <div className="absolute left-1/2 top-[68px] h-[20px] w-[20px] -translate-x-1/2 rounded-full border border-[#243626] bg-black/80"
                        style={{ borderColor: material.innerEdge('#243626') }} />
                </motion.div>

                <motion.div
                    className="absolute right-[26px] top-[96px] h-[28px] w-[8px] rounded-sm border border-[#36513a] bg-[#09140c]"
                    style={{ borderColor: material.edge('#36513a') }}
                    animate={shouldAnimate ? { y: [0, 2, 0], opacity: [0.35, 0.8, 0.35] } : { opacity: 1, y: 0 }}
                    transition={shouldAnimate ? { duration: 1.4, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
                />
            </div>

            <div className="absolute bottom-0 text-[9px] font-black uppercase tracking-[0.2em] text-[#e5f2ff]"
                style={{ color: material.caption('#e5f2ff') }}>
                {t('matrix.artifact_visuals.lethe')}
            </div>
        </div>
    );
}
