import React from 'react';
import { motion } from 'framer-motion';
import { getArtifactVisualProfile } from '../../../shared/artifactVisualProfile.js';
import { useArtifactRenderChannels } from '@/themes/core/tools/useArtifactRenderChannels.js';
import { getCyberpunkArtifactMaterial } from './cyberpunkArtifactMaterial.js';

const WIPE_RINGS = Array.from({ length: 3 }, (_, index) => index);
const MEMORY_SHARDS = [-56, -34, -14, 10, 30, 52];

export default function CyberpunkLethe({
    color: fallbackColor = '#d6f6ff',
    isActive: fallbackIsActive = true,
    artifactRenderContext = null,
    artifactRenderState: fallbackArtifactRenderState = null,

    systemMode = 'cyberpunk',
}) {
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

    return (
        <div
            data-artifact-material={material.mode}
            className="pointer-events-none relative flex h-[262px] w-[214px] items-center justify-center overflow-hidden rounded-xl"
            style={visualProfile.backgroundStyle}
        >
            <div className="absolute inset-0" style={visualProfile.materialOverlayStyle} />

            <motion.div
                className="absolute inset-0 bg-white mix-blend-screen"
                animate={shouldAnimate ? { opacity: [0, 0, 0.72, 0, 0] } : { opacity: 0 }}
                transition={shouldAnimate ? { duration: 4.6, repeat: Infinity, times: [0, 0.54, 0.62, 0.7, 1], ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
            />

            <div className="relative flex h-[226px] w-[126px] flex-col items-center justify-end">
                <motion.div
                    className="absolute top-[20px] h-[58px] w-[58px] rounded-full border"
                    style={{
                        borderColor: material.edge(`${color}bb`),
                        background: material.face('radial-gradient(circle at 50% 42%, rgba(255,255,255,0.98) 0%, rgba(125,249,255,0.7) 38%, rgba(2,7,18,0.95) 100%)'),
                    }}
                    animate={shouldAnimate
                        ? {
                            scale: [1, 1.06, 1],
                            opacity: 1,
                            boxShadow: [`0 0 10px ${color}66`, `0 0 26px ${color}`, `0 0 10px ${color}66`],
                        }
                        : {
                            opacity: 1,
                            scale: 0.94,
                            boxShadow: 'none',
                        }}
                    transition={shouldAnimate ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
                >
                    <div className="absolute inset-[24%] rounded-full border border-white/50" />
                </motion.div>

                {WIPE_RINGS.map((ring) => (
                    <motion.div
                        key={`wipe-ring-${ring}`}
                        className="absolute left-1/2 top-[50px] rounded-full border"
                        style={{
                            borderColor: ring % 2 === 0 ? `${color}aa` : '#00f3ff99',
                            width: `${38 + ring * 16}px`,
                            height: `${38 + ring * 16}px`,
                            marginLeft: `${-(38 + ring * 16) / 2}px`,
                            marginTop: `${-(38 + ring * 16) / 2}px`,
                        }}
                        animate={shouldAnimate ? { scale: [0.45, 1.4, 2], opacity: [0, 0.75, 0] } : { opacity: 0, scale: 1 }}
                        transition={shouldAnimate ? { duration: 2.2, delay: ring * 0.34, repeat: Infinity, ease: 'easeOut' } : { duration: 0, repeat: 0, delay: 0 }}
                    />
                ))}

                {MEMORY_SHARDS.map((offset, index) => (
                    <motion.div
                        key={`memory-shard-${offset}`}
                        className="absolute left-1/2 top-[64px] h-[2px] w-[14px] rounded-full"
                        style={{
                            marginLeft: '-7px',
                            background: index % 2 === 0 ? color : '#a78bfa',
                        }}
                        animate={shouldAnimate
                            ? {
                                x: [offset * 0.18, offset * 0.68],
                                y: [0, -22 - index * 4],
                                opacity: [0.1, 0.84, 0],
                            }
                            : {
                                opacity: 0,
                                x: 0,
                                y: 0,
                            }}
                        transition={shouldAnimate ? { duration: 1.2, delay: index * 0.08, repeat: Infinity, ease: 'easeOut' } : { duration: 0, repeat: 0, delay: 0 }}
                    />
                ))}

                <motion.div
                    className="relative h-[162px] w-[58px] overflow-hidden rounded-[14px] border"
                    style={{ borderColor: material.edge('#2d4f75'), background: material.face('#020814') }}
                    animate={shouldAnimate ? { y: [0, -2, 0], opacity: 1 } : { opacity: 1, y: 0 }}
                    transition={shouldAnimate ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
                >
                    <div className="absolute inset-x-[9px] top-[12px] bottom-[12px] rounded-[9px] border" style={{ borderColor: material.innerEdge('#315880'), background: material.face('rgba(0,0,0,0.8)') }} />

                    <motion.div
                        className="absolute inset-x-[12px] h-[22px] rounded-[8px]"
                        style={{
                            background: `linear-gradient(180deg, ${color}66 0%, transparent 100%)`,
                        }}
                        animate={shouldAnimate ? { y: [8, 126, 8], opacity: [0.2, 0.72, 0.2] } : { y: 64, opacity: 0.08 }}
                        transition={shouldAnimate ? { duration: 2.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
                    />

                    <motion.div
                        className="absolute left-1/2 top-[66px] h-[22px] w-[22px] -translate-x-1/2 rounded-full border"
                        style={{ borderColor: material.innerEdge('#3a5b86'), background: material.face('#000') }}
                        animate={shouldAnimate ? { opacity: [0.3, 0.9, 0.3] } : { opacity: 1 }}
                        transition={shouldAnimate ? { duration: 1.1, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
                    />
                </motion.div>

                <motion.div
                    className="absolute right-[24px] top-[94px] h-[30px] w-[8px] rounded-sm border"
                    style={{ borderColor: material.edge('#355a83'), background: material.face('#051020') }}
                    animate={shouldAnimate ? { y: [0, 2, 0], opacity: [0.35, 0.86, 0.35] } : { opacity: 1, y: 0 }}
                    transition={shouldAnimate ? { duration: 1.4, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
                />
            </div>

            <div className="absolute bottom-0 text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: material.caption('#ccefff') }}>
                MEMORY PURGE
            </div>
        </div>
    );
}
