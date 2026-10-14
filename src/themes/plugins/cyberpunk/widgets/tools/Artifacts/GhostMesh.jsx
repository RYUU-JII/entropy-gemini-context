import React from 'react';
import { motion } from 'framer-motion';
import { getArtifactVisualProfile } from '../../../shared/artifactVisualProfile.js';
import { useArtifactRenderChannels } from '@/themes/core/tools/useArtifactRenderChannels.js';
import { requireCyberpunkArtifactProjection } from './requireCyberpunkArtifactProjection.js';
import { getCyberpunkArtifactMaterial } from './cyberpunkArtifactMaterial.js';

const GHOST_BANDS = Object.freeze([
    { key: 'socialMetrics', top: 58, accent: '#d6f6ff' },
    { key: 'timeSignals', top: 98, accent: '#00f3ff' },
    { key: 'shortformBlock', top: 138, accent: '#a78bfa' },
]);

export default function GhostMesh({
    artifactRenderContext = null,
    isEnabled = true,
}) {
    const childRatio = requireCyberpunkArtifactProjection(artifactRenderContext, 'veil');
    const renderChannels = useArtifactRenderChannels({ artifactRenderContext });
    const color = renderChannels.color;
    const isActive = renderChannels.isVisuallyActive;
    const material = getCyberpunkArtifactMaterial(isActive);
    const artifactRenderState = renderChannels.renderState;
    const visualProfile = getArtifactVisualProfile({
        themeId: renderChannels.themeId,
        signatureColor: color,
        isActive,
        artifactRenderState,
    });
    const shouldAnimate = isEnabled && renderChannels.shouldAnimateMotion && !artifactRenderState.reducedMotion;
    const socialMetricsRatio = childRatio('socialMetrics');
    const timeSignalsRatio = childRatio('timeSignals');
    const shortformBlockRatio = childRatio('shortformBlock');

    return (
        <div
            data-artifact-material={material.mode}
            className="pointer-events-none relative flex h-[262px] w-[220px] items-center justify-center overflow-hidden rounded-xl"
            style={visualProfile.backgroundStyle}
        >
            <div className="absolute inset-0" style={visualProfile.materialOverlayStyle} />

            <div className="absolute left-1/2 top-[20px] h-[90px] w-[166px] -translate-x-1/2 overflow-hidden">
                <motion.div
                    className="absolute left-1/2 top-[-72px] h-[172px] w-[172px] -translate-x-1/2 rounded-full border"
                    style={{ borderColor: '#00f3ff88' }}
                    animate={shouldAnimate ? { rotate: [0, 18, 0], opacity: [0.22, 0.62, 0.22] } : { opacity: 0.12, rotate: 0 }}
                    transition={shouldAnimate ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
                />
            </div>

            <div className="absolute left-1/2 bottom-[22px] h-[92px] w-[166px] -translate-x-1/2 overflow-hidden">
                <motion.div
                    className="absolute left-1/2 bottom-[-74px] h-[172px] w-[172px] -translate-x-1/2 rounded-full border"
                    style={{ borderColor: '#a78bfa88' }}
                    animate={shouldAnimate ? { rotate: [0, -18, 0], opacity: [0.18, 0.54, 0.18] } : { opacity: 0.12, rotate: 0 }}
                    transition={shouldAnimate ? { duration: 2.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
                />
            </div>

            <motion.div
                className="relative h-[190px] w-[154px] overflow-hidden rounded-[22px] border"
                style={{ borderColor: material.edge('#2b4f78'), background: material.face('rgba(2,8,20,0.92)') }}
                animate={shouldAnimate
                    ? {
                        opacity: 1,
                        boxShadow: [
                            `0 0 8px ${color}18, inset 0 0 18px rgba(0, 0, 0, 0.84)`,
                            `0 0 18px ${color}32, inset 0 0 22px rgba(0, 0, 0, 0.92)`,
                            `0 0 8px ${color}18, inset 0 0 18px rgba(0, 0, 0, 0.84)`,
                        ],
                    }
                    : {
                        opacity: 1,
                        boxShadow: 'inset 0 0 24px rgba(0, 0, 0, 0.94)',
                    }}
                transition={shouldAnimate ? { duration: 1.8, repeat: Infinity, ease: visualProfile.motionEase } : { duration: 0, repeat: 0, delay: 0 }}
            >
                <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(0,243,255,0.08)_0px,rgba(0,243,255,0.08)_1px,transparent_1px,transparent_10px),repeating-linear-gradient(45deg,rgba(167,139,250,0.06)_0px,rgba(167,139,250,0.06)_1px,transparent_1px,transparent_12px)]" />
                <div className="absolute inset-[18px] rounded-[18px] border" style={{ borderColor: material.innerEdge('#1c3856'), background: material.face('rgba(0,0,0,0.84)') }} />

                {GHOST_BANDS.map((band, index) => {
                    const ratio =
                        band.key === 'socialMetrics'
                            ? socialMetricsRatio
                            : band.key === 'timeSignals'
                                ? timeSignalsRatio
                                : shortformBlockRatio;
                    const width = 98 + ratio * 24;

                    return (
                        <motion.div
                            key={band.key}
                            className="absolute left-1/2 h-[24px] rounded-full border"
                            style={{
                                top: `${band.top}px`,
                                width: `${width}px`,
                                marginLeft: `${-width / 2}px`,
                                borderColor: material.edge(`${band.accent}aa`),
                                background:
                                    'linear-gradient(90deg, rgba(2,8,20,0.08) 0%, rgba(2,8,20,0.9) 18%, rgba(0,0,0,1) 50%, rgba(2,8,20,0.9) 82%, rgba(2,8,20,0.08) 100%)',
                                boxShadow: isActive ? `0 0 16px ${band.accent}33` : 'none',
                                opacity: isActive ? 0.24 + ratio * 0.58 : 0.7 + ratio * 0.16,
                            }}
                            animate={shouldAnimate ? { x: [-3 + index, 4 - index, -3 + index] } : { x: 0 }}
                            transition={shouldAnimate ? { duration: 1.8 + index * 0.22, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
                        >
                            <div className="absolute inset-[4px] rounded-full bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.12)_0px,rgba(255,255,255,0.12)_2px,transparent_2px,transparent_8px)]" />
                            <motion.div
                                className="absolute inset-y-[5px] w-[28%] rounded-full"
                                style={{
                                    left: '10px',
                                    background: `linear-gradient(90deg, transparent 0%, ${band.accent}cc 50%, transparent 100%)`,
                                    filter: 'blur(1px)',
                                }}
                                animate={shouldAnimate ? { x: ['0%', '180%', '0%'], opacity: [0.1, 0.86, 0.1] } : { x: '60%', opacity: 0.12 }}
                                transition={shouldAnimate ? { duration: 1.4 + index * 0.18, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
                            />
                        </motion.div>
                    );
                })}

                <motion.div
                    className="absolute left-1/2 top-1/2 h-[96px] w-[62px] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border"
                    style={{ borderColor: material.edge('#355b86'), background: material.face('#000') }}
                    animate={shouldAnimate ? { opacity: [0.72, 1, 0.72], scale: [1, 1.03, 1] } : { opacity: 1, scale: 1 }}
                    transition={shouldAnimate ? { duration: 1.2, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
                >
                    <div className="absolute inset-[14px] rounded-[12px] border border-white/10" />
                    <div className="absolute inset-x-[12px] top-[16px] h-px bg-[#4a7aad]" />
                    <div className="absolute inset-x-[12px] bottom-[16px] h-px bg-[#7c69d6]" />
                </motion.div>
            </motion.div>

            <div className="absolute bottom-4 text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: material.caption('#d8f5ff') }}>
                GHOST MESH
            </div>
        </div>
    );
}
