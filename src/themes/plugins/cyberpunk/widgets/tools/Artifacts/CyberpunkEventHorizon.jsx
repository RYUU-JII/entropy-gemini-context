import React from 'react';
import { motion } from 'framer-motion';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { getArtifactVisualProfile } from '../../../shared/artifactVisualProfile.js';
import { useArtifactRenderChannels } from '@/themes/core/tools/useArtifactRenderChannels.js';
import { getCyberpunkArtifactMaterial } from './cyberpunkArtifactMaterial.js';

const BURST_RINGS = Array.from({ length: 3 }, (_, index) => index);

export default function CyberpunkEventHorizon({
    color: fallbackColor = '#a78bfa',
    isActive: fallbackIsActive = true,
    artifactRenderContext = null,
    artifactRenderState: fallbackArtifactRenderState = null,

    systemMode = 'cyberpunk',
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
    const material = getCyberpunkArtifactMaterial(isActive);
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
        : t('artifacts.loop_breaker.subtitle');

    return (
        <div
            data-artifact-material={material.mode}
            className="pointer-events-none relative flex h-[292px] w-[292px] items-center justify-center overflow-hidden rounded-full"
            style={visualProfile.backgroundStyle}
        >
            <div className="absolute inset-0 rounded-full" style={visualProfile.materialOverlayStyle} />

            <motion.div
                className="absolute inset-[8%] rounded-full"
                style={{
                    background: `radial-gradient(circle, transparent 50%, ${color}24 72%, transparent 86%)`,
                }}
                animate={shouldAnimate ? { opacity: [0.2, 0.44, 0.2], scale: [1, 1.06, 1] } : { opacity: 0.08, scale: 1 }}
                transition={shouldAnimate ? { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
            />

            <motion.div
                className="absolute h-[232px] w-[232px] rounded-full border-2 border-dashed"
                style={{ borderColor: material.edge(`${color}88`) }}
                animate={shouldAnimate
                    ? {
                        rotate: [0, 360],
                        opacity: 1,
                        boxShadow: [`0 0 10px ${color}33`, `0 0 24px ${color}88`, `0 0 10px ${color}33`],
                    }
                    : {
                        rotate: 18,
                        opacity: 1,
                        boxShadow: 'none',
                    }}
                transition={shouldAnimate ? {
                    rotate: { duration: shouldAnimate ? 8.4 : 1.4, repeat: Infinity, ease: 'linear' },
                    boxShadow: { duration: 1.5, repeat: Infinity, ease: 'linear' },
                } : { duration: 0, repeat: 0, delay: 0 }}
            />

            <motion.div
                className="absolute h-[182px] w-[182px] rounded-full border"
                style={{
                    borderColor: material.innerEdge('#2a3f7a'),
                    background: material.face(`conic-gradient(from 0deg, transparent 0%, ${color}2f 24%, transparent 44%, #00f3ff2b 64%, transparent 100%)`),
                    WebkitMask: 'radial-gradient(circle, transparent 46%, black 48%, black 58%, transparent 60%)',
                    mask: 'radial-gradient(circle, transparent 46%, black 48%, black 58%, transparent 60%)',
                }}
                animate={shouldAnimate ? { rotate: [360, 0], opacity: 1 } : { rotate: 0, opacity: 1 }}
                transition={shouldAnimate ? { duration: shouldAnimate ? 4.6 : 1.2, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
            />

            <motion.div
                className="absolute h-[3px] w-[248px] rounded-full"
                style={{
                    background: material.innerEdge(`linear-gradient(90deg, transparent 0%, #00f3ff 36%, #ffffff 50%, ${color} 64%, transparent 100%)`),
                }}
                animate={shouldAnimate
                    ? {
                        rotate: [0, 360],
                        opacity: [0.4, 1, 0.4],
                    }
                    : {
                        rotate: 45,
                        opacity: 1,
                    }}
                transition={shouldAnimate ? {
                    rotate: { duration: shouldAnimate ? 2.4 : 1.2, repeat: Infinity, ease: 'linear' },
                    opacity: { duration: 0.9, repeat: Infinity, ease: 'linear' },
                } : { duration: 0, repeat: 0, delay: 0 }}
            />

            {BURST_RINGS.map((ring) => (
                <motion.div
                    key={`burst-ring-${ring}`}
                    className="absolute rounded-full border"
                    style={{
                        borderColor: ring % 2 === 0 ? `${color}99` : '#00f3ffaa',
                        width: `${96 + ring * 30}px`,
                        height: `${96 + ring * 30}px`,
                    }}
                    animate={shouldAnimate ? { scale: [0.8, 1.32], opacity: [0, 0.6, 0] } : { opacity: 0, scale: 1 }}
                    transition={shouldAnimate ? { duration: 2.8, delay: ring * 0.4, repeat: Infinity, ease: 'easeOut' } : { duration: 0, repeat: 0, delay: 0 }}
                />
            ))}

            <motion.div
                className="relative z-10 h-[92px] w-[92px] rounded-full border"
                style={{ borderColor: material.edge('#2a407a'), background: material.face('#000') }}
                animate={shouldAnimate
                    ? {
                        scale: [1, 1.06, 1],
                        opacity: 1,
                        boxShadow: [`0 0 0px ${color}`, `0 0 18px ${color}88`, `0 0 0px ${color}`],
                    }
                    : {
                        opacity: 1,
                        scale: 0.95,
                        boxShadow: 'none',
                    }}
                transition={shouldAnimate ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
            >
                <div className="absolute inset-[26%] rounded-full border" style={{ borderColor: material.innerEdge('#354885'), background: material.face('#000') }} />
                <div className="absolute inset-0 rounded-full" style={{ boxShadow: 'inset 0 0 26px rgba(0,0,0,0.95)' }} />
            </motion.div>

            <div className="absolute bottom-1 text-[9px] font-black uppercase tracking-[0.24em]" style={{ color: material.caption('#b8b9ff') }}>
                {footerLabel}
            </div>
        </div>
    );
}
