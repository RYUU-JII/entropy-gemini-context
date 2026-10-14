import React from 'react';
import { motion } from 'framer-motion';
import { getArtifactVisualProfile } from '../../../shared/artifactVisualProfile.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useArtifactRenderChannels } from '@/themes/core/tools/useArtifactRenderChannels.js';
import { getMatrixArtifactMaterial } from './matrixArtifactMaterial.js';

const TIME_TICKS = Array.from({ length: 9 }, (_, index) => index);

export default function Monolith({
    color: fallbackColor = '#39ff14',
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
            className="pointer-events-none relative flex h-[250px] w-[180px] items-center justify-center overflow-hidden rounded-xl"
            style={visualProfile.backgroundStyle}
        >
            <div className="absolute inset-0" style={visualProfile.materialOverlayStyle} />

            <motion.div
                className="absolute inset-0"
                style={{ background: `radial-gradient(circle at 50% 40%, ${color}22 0%, transparent 58%)` }}
                animate={shouldAnimate ? { opacity: [0.2, 0.44, 0.2] } : { opacity: 0.12 }}
                transition={shouldAnimate ? { duration: 2.8, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
            />

            <div className="relative h-[214px] w-[82px]">
                <motion.div
                    className="absolute inset-0 rounded-[8px] border"
                    style={{
                        borderColor: material.edge(`${color}66`),
                        background: material.face('linear-gradient(180deg, rgba(4, 12, 6, 0.95) 0%, rgba(2, 5, 3, 0.98) 48%, rgba(0, 0, 0, 1) 100%)'),
                    }}
                    animate={shouldAnimate
                        ? {
                            opacity: 1,
                            boxShadow: [
                                `0 0 14px ${color}30, inset 0 0 16px rgba(0, 0, 0, 0.82)`,
                                `0 0 28px ${color}66, inset 0 0 22px rgba(0, 0, 0, 0.9)`,
                                `0 0 14px ${color}30, inset 0 0 16px rgba(0, 0, 0, 0.82)`,
                            ],
                        }
                        : {
                            boxShadow: 'inset 0 0 22px rgba(0, 0, 0, 0.92)',
                            opacity: 1,
                        }}
                    transition={shouldAnimate ? { duration: 2, repeat: Infinity, ease: visualProfile.motionEase } : { duration: 0, repeat: 0, delay: 0 }}
                />

                <div className="absolute inset-x-3 bottom-6 top-6 overflow-hidden rounded-[3px] border border-[#123119] bg-black/70"
                    style={{ borderColor: material.innerEdge('#123119') }}>
                    {TIME_TICKS.map((tick) => {
                        const top = 8 + tick * 18;
                        return (
                            <div key={`time-tick-${tick}`}>
                                <div
                                    className="absolute left-0 right-0 h-px bg-[#0f1f12]"
                                    style={{ top: `${top}px`, background: material.innerEdge('#0f1f12') }}
                                />
                                <motion.div
                                    className="absolute left-0 right-0 h-px"
                                    style={{
                                        top: `${top}px`,
                                        background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
                                    }}
                                    animate={shouldAnimate ? { opacity: [0.2, 0.82, 0.2] } : { opacity: 0.1 }}
                                    transition={shouldAnimate ? { duration: 1.6, repeat: Infinity, delay: tick * 0.08, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
                                />
                            </div>
                        );
                    })}

                    <motion.div
                        className="absolute inset-x-0 h-[18px]"
                        style={{
                            background: `linear-gradient(180deg, transparent 0%, ${color}66 48%, transparent 100%)`,
                        }}
                        animate={shouldAnimate ? { y: [0, 128, 0], opacity: [0.35, 0.82, 0.35] } : { y: 64, opacity: 0.16 }}
                        transition={shouldAnimate ? { duration: 3.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
                    />

                    <motion.div
                        className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2"
                        style={{
                            background: `linear-gradient(180deg, transparent 0%, ${color} 20%, ${color} 80%, transparent 100%)`,
                        }}
                        animate={shouldAnimate ? { opacity: [0.35, 0.95, 0.35] } : { opacity: 0.18 }}
                        transition={shouldAnimate ? { duration: 1.2, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
                    />
                </div>

                <motion.div
                    className="absolute -bottom-3 left-1/2 h-[10px] w-[10px] -translate-x-1/2 rounded-full border border-black/40"
                    style={{ background: color }}
                    animate={shouldAnimate ? { boxShadow: [`0 0 5px ${color}`, `0 0 16px ${color}`, `0 0 5px ${color}`] } : { opacity: 0.35, boxShadow: 'none' }}
                    transition={shouldAnimate ? { duration: 1.4, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
                />
            </div>

            <div className="absolute bottom-3 text-[9px] font-black uppercase tracking-[0.22em] text-[#9adca8]"
                style={{ color: material.caption('#9adca8') }}>
                {t('matrix.artifact_visuals.monolith')}
            </div>
        </div>
    );
}
