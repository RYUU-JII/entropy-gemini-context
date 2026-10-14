import React from 'react';
import { motion } from 'framer-motion';
import { getArtifactVisualProfile } from '../../../shared/artifactVisualProfile.js';
import { useArtifactRenderChannels } from '@/themes/core/tools/useArtifactRenderChannels.js';
import { requireCyberpunkArtifactProjection } from './requireCyberpunkArtifactProjection.js';
import { getCyberpunkArtifactMaterial } from './cyberpunkArtifactMaterial.js';

const VISOR_PANES = Object.freeze([
    { key: 'grayscale', left: 34, top: 34, width: 58, height: 116, skew: -18, accent: '#d6f6ff' },
    { key: 'blur', left: 98, top: 28, width: 64, height: 126, skew: -14, accent: '#00f3ff' },
]);

export default function VisorPrism({
    artifactRenderContext = null,
    isEnabled = true,
}) {
    const childRatio = requireCyberpunkArtifactProjection(artifactRenderContext, 'lens');
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
    const grayscaleRatio = childRatio('grayscale');
    const blurRatio = childRatio('blur');
    const brightness = childRatio('brightness');
    const contrast = childRatio('contrast');
    const saturation = childRatio('saturation');

    return (
        <div
            data-artifact-material={material.mode}
            className="pointer-events-none relative flex h-[262px] w-[220px] items-center justify-center overflow-hidden rounded-xl"
            style={visualProfile.backgroundStyle}
        >
            <div className="absolute inset-0" style={visualProfile.materialOverlayStyle} />

            <div className="absolute inset-[14px] rounded-[18px] border" style={{ borderColor: material.edge('#25446f'), background: material.face('rgba(2,8,20,0.88)') }} />
            <div className="absolute inset-[14px] rounded-[18px] bg-[repeating-linear-gradient(135deg,rgba(0,243,255,0.05)_0px,rgba(0,243,255,0.05)_1px,transparent_1px,transparent_10px)]" />

            {VISOR_PANES.map((pane, index) => {
                const ratio = pane.key === 'grayscale' ? grayscaleRatio : blurRatio;
                const opacity = isActive ? 0.28 + ratio * 0.68 : 0.7 + ratio * 0.16;

                return (
                    <motion.div
                        key={pane.key}
                        className="absolute rounded-[14px] border"
                        style={{
                            left: `${pane.left}px`,
                            top: `${pane.top}px`,
                            width: `${pane.width}px`,
                            height: `${pane.height}px`,
                            transform: `skewX(${pane.skew}deg)`,
                            borderColor: material.edge(`${pane.accent}aa`),
                            background: 'linear-gradient(180deg, rgba(209,250,255,0.18) 0%, rgba(0,243,255,0.14) 32%, rgba(2,7,18,0.92) 100%)',
                            boxShadow: isActive ? `0 0 12px ${pane.accent}22` : 'none',
                            opacity,
                            filter: `brightness(${1 - brightness * 0.5}) contrast(${1 - contrast * 0.5}) saturate(${1 - saturation})`,
                        }}
                        animate={shouldAnimate
                            ? {
                                y: [0, -3 - index, 0],
                                boxShadow: [
                                    `0 0 6px ${pane.accent}22`,
                                    `0 0 ${10 + ratio * 8}px ${pane.accent}44`,
                                    `0 0 6px ${pane.accent}22`,
                                ],
                            }
                            : {
                                y: 0,
                                boxShadow: isActive ? `0 0 12px ${pane.accent}22` : 'none',
                            }}
                        transition={shouldAnimate ? { duration: 1.8 + index * 0.22, repeat: Infinity, ease: visualProfile.motionEase } : { duration: 0, repeat: 0, delay: 0 }}
                    >
                        <div className="absolute inset-[6px] rounded-[10px] border border-white/10" />
                        {pane.key === 'blur' && (
                            <div
                                className="absolute inset-[8px] rounded-[10px]"
                                style={{
                                    background: `radial-gradient(circle at 50% 38%, rgba(214,246,255,${0.16 + ratio * 0.34}) 0%, transparent 72%)`,
                                    filter: `blur(${6 + ratio * 12}px)`,
                                }}
                            />
                        )}
                    </motion.div>
                );
            })}

            <motion.div
                className="absolute left-1/2 top-1/2 h-[58px] w-[58px] -translate-x-1/2 -translate-y-1/2 rounded-full border"
                style={{ borderColor: material.innerEdge('#356ea4') }}
                animate={shouldAnimate ? { opacity: [0.24, 0.82, 0.24], scale: [0.96, 1.04, 0.96] } : { opacity: 1, scale: 1 }}
                transition={shouldAnimate ? { duration: 1.2, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
            >
                <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#00f3ff]" />
                <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[#a78bfa]" />
                <div className="absolute inset-[18px] rounded-full border border-[#5cc8ff]" />
            </motion.div>

            <motion.div
                className="absolute inset-x-[26px] h-[26px] rounded-[12px]"
                style={{
                    top: '42px',
                    background: 'linear-gradient(90deg, transparent 0%, rgba(0,243,255,0.7) 42%, rgba(255,255,255,0.95) 50%, rgba(167,139,250,0.7) 58%, transparent 100%)',
                    filter: 'blur(2px)',
                }}
                animate={shouldAnimate ? { x: [-18, 22, -18], opacity: [0.12, 0.5, 0.12] } : { x: 0, opacity: 0.08 }}
                transition={shouldAnimate ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
            />

            <div className="absolute bottom-4 text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: material.caption('#d8f5ff') }}>
                VISOR PRISM
            </div>
        </div>
    );
}
