import React from 'react';
import { motion } from 'framer-motion';
import { getArtifactVisualProfile } from '../../../shared/artifactVisualProfile.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useArtifactRenderChannels } from '@/themes/core/tools/useArtifactRenderChannels.js';
import { getMatrixArtifactMaterial } from './matrixArtifactMaterial.js';

const BREAK_RINGS = Array.from({ length: 3 }, (_, index) => index);

export default function EventHorizon({
    color: fallbackColor = '#39ff14',
    isActive: fallbackIsActive = true,
    artifactRenderContext = null,
    artifactRenderState: fallbackArtifactRenderState = null,
    systemMode = 'matrix',
    visualKey = 'gate',
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
    const footerLabel = visualKey === 'gate'
        ? t('artifacts.loop_breaker.title')
        : t('matrix.artifact_visuals.event_horizon');

    return (
        <div
            data-artifact-material={material.mode}
            className="pointer-events-none relative flex h-[290px] w-[290px] items-center justify-center overflow-hidden rounded-full"
            style={visualProfile.backgroundStyle}
        >
            <div className="absolute inset-0 rounded-full" style={visualProfile.materialOverlayStyle} />

            <motion.div
                className="absolute inset-[7%] rounded-full"
                style={{ background: `radial-gradient(circle, transparent 50%, ${color}20 74%, transparent 88%)` }}
                animate={shouldAnimate ? { opacity: [0.2, 0.46, 0.2], scale: [1, 1.08, 1] } : { opacity: 0.08, scale: 1 }}
                transition={shouldAnimate ? { duration: 3.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
            />

            <motion.div
                className="absolute h-[226px] w-[226px] rounded-full border-2 border-dashed"
                style={{ borderColor: material.edge(`${color}88`) }}
                animate={shouldAnimate
                    ? {
                        opacity: 1,
                        rotate: [0, 360],
                        scale: [1, 1.02, 0.9, 1],
                        boxShadow: [`0 0 10px ${color}44`, `0 0 24px ${color}88`, `0 0 10px ${color}44`],
                    }
                    : {
                        rotate: 12,
                        opacity: 1,
                        scale: 0.95,
                        boxShadow: 'none',
                    }}
                transition={shouldAnimate ? {
                    rotate: { duration: 8.8, repeat: Infinity, ease: 'linear' },
                    scale: { duration: 4.4, repeat: Infinity, times: [0, 0.55, 0.68, 1], ease: 'easeInOut' },
                    boxShadow: { duration: 1.6, repeat: Infinity, ease: 'linear' },
                } : { duration: 0, repeat: 0, delay: 0 }}
            />

            <motion.div
                className="absolute h-[170px] w-[170px] rounded-full border border-[#1f4727]"
                style={{
                    borderColor: material.innerEdge('#1f4727'),
                    background: material.face(`conic-gradient(from 0deg, transparent 0%, ${color}2e 22%, transparent 42%, ${color}24 65%, transparent 100%)`),
                    WebkitMask: 'radial-gradient(circle, transparent 46%, black 47%, black 58%, transparent 59%)',
                    mask: 'radial-gradient(circle, transparent 46%, black 47%, black 58%, transparent 59%)',
                }}
                animate={shouldAnimate ? { rotate: [360, 0], opacity: 1 } : { rotate: 0, opacity: 1 }}
                transition={shouldAnimate ? { duration: shouldAnimate ? 4.2 : 1.2, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
            />

            <motion.div
                className="absolute h-[2px] w-[242px] rounded-full"
                style={{
                    background: material.innerEdge(`linear-gradient(90deg, transparent 0%, ${color} 38%, #ffffff 50%, ${color} 62%, transparent 100%)`),
                }}
                animate={shouldAnimate
                    ? {
                        rotate: [0, 360],
                        opacity: [0.5, 1, 0.5],
                        boxShadow: [`0 0 8px ${color}`, `0 0 18px ${color}`, `0 0 8px ${color}`],
                    }
                    : {
                        rotate: 45,
                        opacity: 1,
                        boxShadow: 'none',
                    }}
                transition={shouldAnimate ? {
                    rotate: { duration: shouldAnimate ? 2.2 : 1.2, repeat: Infinity, ease: 'linear' },
                    opacity: { duration: 0.9, repeat: Infinity, ease: 'linear' },
                    boxShadow: { duration: 1.1, repeat: Infinity, ease: 'linear' },
                } : { duration: 0, repeat: 0, delay: 0 }}
            />

            {BREAK_RINGS.map((ring) => (
                <motion.div
                    key={`break-ring-${ring}`}
                    className="absolute rounded-full border"
                    style={{
                        borderColor: `${color}88`,
                        width: `${102 + ring * 24}px`,
                        height: `${102 + ring * 24}px`,
                    }}
                    animate={shouldAnimate ? { scale: [0.78, 1.2], opacity: [0, 0.5, 0] } : { opacity: 0, scale: 1 }}
                    transition={shouldAnimate ? {
                        duration: 2.6,
                        delay: ring * 0.42,
                        repeat: Infinity,
                        ease: 'easeOut',
                    } : { duration: 0, repeat: 0, delay: 0 }}
                />
            ))}

            <motion.div
                className="relative z-10 h-[90px] w-[90px] rounded-full border border-[#1b2b1c] bg-black"
                style={{ borderColor: material.edge('#1b2b1c'), background: material.face('#000000') }}
                animate={shouldAnimate
                    ? {
                        opacity: 1,
                        scale: [1, 1.05, 1],
                        boxShadow: [`0 0 0px ${color}`, `0 0 18px ${color}88`, `0 0 0px ${color}`],
                    }
                    : {
                        opacity: 1,
                        scale: 0.96,
                        boxShadow: 'none',
                    }}
                transition={shouldAnimate ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
            >
                <div className="absolute inset-[26%] rounded-full border border-[#233225] bg-black"
                    style={{ borderColor: material.innerEdge('#233225') }} />
                <div className="absolute inset-0 rounded-full" style={{ boxShadow: 'inset 0 0 24px rgba(0, 0, 0, 0.95)' }} />
            </motion.div>

            <div className="absolute bottom-5 text-[9px] font-black uppercase tracking-[0.24em] text-[#9adca8]"
                style={{ color: material.caption('#9adca8') }}>
                {footerLabel}
            </div>
        </div>
    );
}
