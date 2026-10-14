import React from 'react';
import { motion } from 'framer-motion';
import { getArtifactVisualProfile } from '../../../shared/artifactVisualProfile.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useArtifactRenderChannels } from '@/themes/core/tools/useArtifactRenderChannels.js';
import { requireMatrixArtifactProjection } from './requireMatrixArtifactProjection.js';
import { getMatrixArtifactMaterial } from './matrixArtifactMaterial.js';

const GLYPH_COLUMNS = Array.from({ length: 8 }, (_, index) => index);
const FILTER_PANES = Object.freeze([
    { key: 'grayscale', left: 17, top: 18, height: 118, width: 46, skew: -12 },
    { key: 'blur', left: 65, top: 30, height: 106, width: 48, skew: -10 },
]);

export default function GlyphPrism({
    artifactRenderContext = null,
    isEnabled = true,
}) {
    const { t } = useAppTranslation('tools');
    const childRatio = requireMatrixArtifactProjection(artifactRenderContext, 'lens');
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
    const grayscaleRatio = childRatio('grayscale');
    const blurRatio = childRatio('blur');
    const brightness = childRatio('brightness');
    const contrast = childRatio('contrast');
    const saturation = childRatio('saturation');

    return (
        <div
            data-artifact-material={material.mode}
            className="pointer-events-none relative flex h-[252px] w-[214px] items-center justify-center overflow-hidden rounded-xl"
            style={visualProfile.backgroundStyle}
        >
            <div className="absolute inset-0" style={visualProfile.materialOverlayStyle} />

            {GLYPH_COLUMNS.map((column) => (
                <motion.div
                    key={`glyph-prism-column-${column}`}
                    className="absolute top-[18px] bottom-[34px] w-px"
                    style={{
                        left: `${18 + column * 24}px`,
                        background: `linear-gradient(180deg, transparent 0%, ${color}${column % 2 === 0 ? '44' : '22'} 18%, transparent 100%)`,
                    }}
                    animate={shouldAnimate ? { opacity: [0.1, 0.58, 0.1] } : { opacity: 0.08 }}
                    transition={shouldAnimate ? { duration: 1.6 + column * 0.14, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
                />
            ))}

            <div className="relative h-[186px] w-[148px]" style={{ filter: `brightness(${1 - brightness * 0.5}) contrast(${1 - contrast * 0.5}) saturate(${1 - saturation})` }}>
                <motion.div
                    className="absolute inset-0 rounded-[20px] border border-[#224b20] bg-black/80"
                    style={{ borderColor: material.edge('#224b20'), background: material.face('rgba(0,0,0,0.8)') }}
                    animate={shouldAnimate
                        ? {
                            opacity: 1,
                            boxShadow: [
                                `0 0 12px ${color}26, inset 0 0 18px rgba(0, 0, 0, 0.82)`,
                                `0 0 28px ${color}5a, inset 0 0 28px rgba(0, 0, 0, 0.92)`,
                                `0 0 12px ${color}26, inset 0 0 18px rgba(0, 0, 0, 0.82)`,
                            ],
                        }
                        : {
                            opacity: 1,
                            boxShadow: 'inset 0 0 24px rgba(0, 0, 0, 0.94)',
                        }}
                    transition={shouldAnimate ? { duration: 1.8, repeat: Infinity, ease: visualProfile.motionEase } : { duration: 0, repeat: 0, delay: 0 }}
                />

                <div className="absolute inset-[14px] overflow-hidden rounded-[16px] border border-[#193218] bg-[#020702]"
                    style={{ borderColor: material.innerEdge('#193218') }}>
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(57,255,20,0.06)_0%,transparent_35%,transparent_65%,rgba(57,255,20,0.05)_100%)]" />
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(57,255,20,0.06)_0px,rgba(57,255,20,0.06)_1px,transparent_1px,transparent_7px)]" />

                    {FILTER_PANES.map((pane, index) => {
                        const ratio = pane.key === 'grayscale' ? grayscaleRatio : blurRatio;
                        const fill =
                            pane.key === 'grayscale'
                                ? 'linear-gradient(180deg, rgba(216,249,208,0.78) 0%, rgba(134,239,172,0.18) 44%, rgba(2,7,2,0.92) 100%)'
                                : 'linear-gradient(180deg, rgba(220,252,231,0.36) 0%, rgba(134,239,172,0.12) 38%, rgba(2,7,2,0.84) 100%)';

                        return (
                            <motion.div
                                key={pane.key}
                                className="absolute rounded-[12px] border border-[#3a7c33]"
                                style={{
                                    left: `${pane.left}px`,
                                    top: `${pane.top}px`,
                                    width: `${pane.width}px`,
                                    height: `${pane.height}px`,
                                    background: fill,
                                    borderColor: material.edge('#3a7c33'),
                                    transform: `skewX(${pane.skew}deg)`,
                                    opacity: isActive ? 0.28 + ratio * 0.68 : 0.7 + ratio * 0.16,
                                }}
                                animate={shouldAnimate
                                    ? {
                                        y: [0, -2 - index, 0],
                                        boxShadow: [
                                            `0 0 0px ${color}`,
                                            `0 0 ${10 + ratio * 10}px ${color}99`,
                                            `0 0 0px ${color}`,
                                        ],
                                    }
                                    : {
                                        y: 0,
                                        boxShadow: 'none',
                                    }}
                                transition={shouldAnimate ? { duration: 2 + index * 0.3, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
                            >
                                {pane.key === 'blur' && (
                                    <div
                                        className="absolute inset-[6px] rounded-[10px]"
                                        style={{
                                            background: `radial-gradient(circle at 50% 42%, rgba(220,252,231,${0.12 + ratio * 0.32}) 0%, transparent 72%)`,
                                            filter: `blur(${6 + ratio * 12}px)`,
                                        }}
                                    />
                                )}
                                <div className="absolute inset-[6px] rounded-[10px] border border-white/8" />
                            </motion.div>
                        );
                    })}

                    <motion.div
                        className="absolute inset-x-[10px] h-[18px] rounded-full"
                        style={{ top: '18px', background: `linear-gradient(180deg, transparent 0%, ${color}88 50%, transparent 100%)` }}
                        animate={shouldAnimate ? { y: [0, 108, 0], opacity: [0.2, 0.82, 0.2] } : { y: 54, opacity: 0.12 }}
                        transition={shouldAnimate ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
                    />

                    <motion.div
                        className="absolute left-1/2 top-1/2 h-[44px] w-[44px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#29532a]"
                        style={{ borderColor: material.innerEdge('#29532a') }}
                        animate={shouldAnimate ? { opacity: [0.24, 0.72, 0.24], scale: [0.96, 1.04, 0.96] } : { opacity: 0.18, scale: 1 }}
                        transition={shouldAnimate ? { duration: 1.4, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
                    >
                        <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#3a7c33]" />
                        <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[#3a7c33]" />
                    </motion.div>
                </div>
            </div>

            <div className="absolute bottom-3 text-[9px] font-black uppercase tracking-[0.22em] text-[#9adca8]"
                style={{ color: material.caption('#9adca8') }}>
                {t('matrix.artifact_visuals.lens')}
            </div>
        </div>
    );
}
