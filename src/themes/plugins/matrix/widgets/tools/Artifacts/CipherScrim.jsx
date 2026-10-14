import React from 'react';
import { motion } from 'framer-motion';
import { getArtifactVisualProfile } from '../../../shared/artifactVisualProfile.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useArtifactRenderChannels } from '@/themes/core/tools/useArtifactRenderChannels.js';
import { requireMatrixArtifactProjection } from './requireMatrixArtifactProjection.js';
import { getMatrixArtifactMaterial } from './matrixArtifactMaterial.js';

const CODE_COLUMNS = Array.from({ length: 7 }, (_, index) => index);
const SHROUD_BANDS = Object.freeze([
    { key: 'socialMetrics', top: 28, color: '#bbf7d0' },
    { key: 'timeSignals', top: 66, color: '#86efac' },
    { key: 'shortformBlock', top: 104, color: '#4ade80' },
]);

export default function CipherScrim({
    artifactRenderContext = null,
    isEnabled = true,
}) {
    const { t } = useAppTranslation('tools');
    const childRatio = requireMatrixArtifactProjection(artifactRenderContext, 'veil');
    const renderChannels = useArtifactRenderChannels({ artifactRenderContext });
    const color = renderChannels.color;
    const isActive = renderChannels.isVisuallyActive;
    const material = getMatrixArtifactMaterial(isActive);
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
            className="pointer-events-none relative flex h-[252px] w-[214px] items-center justify-center overflow-hidden rounded-xl"
            style={visualProfile.backgroundStyle}
        >
            <div className="absolute inset-0" style={visualProfile.materialOverlayStyle} />

            <motion.div
                className="absolute inset-[12%] rounded-[22px]"
                style={{ background: `radial-gradient(circle at 50% 44%, ${color}16 0%, transparent 72%)` }}
                animate={shouldAnimate ? { opacity: [0.12, 0.32, 0.12] } : { opacity: 0.06 }}
                transition={shouldAnimate ? { duration: 2.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
            />

            <div className="relative h-[186px] w-[148px]">
                <motion.div
                    className="absolute inset-0 rounded-[20px] border border-[#234e20] bg-black/84"
                    style={{ borderColor: material.edge('#234e20'), background: material.face('rgba(0,0,0,0.84)') }}
                    animate={shouldAnimate
                        ? {
                            opacity: 1,
                            boxShadow: [
                                `0 0 12px ${color}20, inset 0 0 18px rgba(0, 0, 0, 0.84)`,
                                `0 0 26px ${color}4e, inset 0 0 28px rgba(0, 0, 0, 0.92)`,
                                `0 0 12px ${color}20, inset 0 0 18px rgba(0, 0, 0, 0.84)`,
                            ],
                        }
                        : {
                            opacity: 1,
                            boxShadow: 'inset 0 0 24px rgba(0, 0, 0, 0.94)',
                        }}
                    transition={shouldAnimate ? { duration: 1.9, repeat: Infinity, ease: visualProfile.motionEase } : { duration: 0, repeat: 0, delay: 0 }}
                />

                <div className="absolute inset-[14px] overflow-hidden rounded-[16px] border border-[#1b3618] bg-[#010401]"
                    style={{ borderColor: material.innerEdge('#1b3618') }}>
                    {CODE_COLUMNS.map((column) => (
                        <div key={`cipher-column-${column}`}>
                            <div
                                className="absolute top-[12px] bottom-[12px] w-px bg-[#173116]"
                                style={{ left: `${16 + column * 16}px` }}
                            />
                            <motion.div
                                className="absolute w-[8px] rounded-[2px]"
                                style={{
                                    left: `${12 + column * 16}px`,
                                    height: `${14 + (column % 3) * 10}px`,
                                    background: column % 2 === 0 ? color : '#bbf7d0',
                                }}
                                animate={shouldAnimate ? { y: [10, 116, 10], opacity: [0, 0.66, 0] } : { y: 54, opacity: 0.1 }}
                                transition={shouldAnimate ? { duration: 2.1 + column * 0.12, repeat: Infinity, delay: column * 0.08, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
                            />
                        </div>
                    ))}

                    {SHROUD_BANDS.map((band, index) => {
                        const ratio =
                            band.key === 'socialMetrics'
                                ? socialMetricsRatio
                                : band.key === 'timeSignals'
                                    ? timeSignalsRatio
                                    : shortformBlockRatio;
                        const width = 94 + ratio * 24;

                        return (
                            <motion.div
                                key={band.key}
                                className="absolute left-1/2 h-[24px] rounded-full border"
                                style={{
                                    top: `${band.top}px`,
                                    width: `${width}px`,
                                    marginLeft: `${-width / 2}px`,
                                    borderColor: material.edge(`${band.color}88`),
                                    background:
                                        'linear-gradient(90deg, rgba(1,4,1,0.08) 0%, rgba(1,4,1,0.94) 18%, rgba(0,0,0,1) 50%, rgba(1,4,1,0.94) 82%, rgba(1,4,1,0.08) 100%)',
                                    boxShadow: isActive ? `0 0 18px ${color}18` : 'none',
                                    opacity: isActive ? 0.26 + ratio * 0.54 : 0.7 + ratio * 0.16,
                                }}
                                animate={shouldAnimate ? { x: [-4 + index, 5 - index, -4 + index] } : { x: 0 }}
                                transition={shouldAnimate ? { duration: 2 + index * 0.28, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
                            >
                                <motion.div
                                    className="absolute inset-y-[5px] w-[26%] rounded-full"
                                    style={{
                                        left: '8px',
                                        background: `linear-gradient(90deg, transparent 0%, ${band.color}aa 50%, transparent 100%)`,
                                    }}
                                    animate={shouldAnimate ? { x: ['0%', '200%', '0%'], opacity: [0.12, 0.78, 0.12] } : { x: '60%', opacity: 0.12 }}
                                    transition={shouldAnimate ? { duration: 1.5 + index * 0.24, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
                                />
                            </motion.div>
                        );
                    })}

                    <motion.div
                        className="absolute left-1/2 top-1/2 h-[92px] w-[56px] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-[#214020] bg-black/90"
                        style={{ borderColor: material.edge('#214020'), background: material.face('rgba(0,0,0,0.9)') }}
                        animate={shouldAnimate ? { opacity: [0.7, 1, 0.7] } : { opacity: 1 }}
                        transition={shouldAnimate ? { duration: 1.4, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
                    >
                        <div className="absolute inset-x-[10px] top-[12px] h-px bg-[#315b2f]" />
                        <div className="absolute inset-x-[10px] bottom-[12px] h-px bg-[#315b2f]" />
                    </motion.div>
                </div>
            </div>

            <div className="absolute bottom-3 text-[9px] font-black uppercase tracking-[0.22em] text-[#9adca8]"
                style={{ color: material.caption('#9adca8') }}>
                {t('matrix.artifact_visuals.veil')}
            </div>
        </div>
    );
}
