import React from 'react';
import { motion } from 'framer-motion';
import { getArtifactVisualProfile } from '../../../shared/artifactVisualProfile.js';
import { useArtifactRenderChannels } from '@/themes/core/tools/useArtifactRenderChannels.js';
import { getCyberpunkArtifactMaterial } from './cyberpunkArtifactMaterial.js';

const GLYPH_ROWS = Array.from({ length: 9 }, (_, index) => index);
const SIDE_NODES = Array.from({ length: 5 }, (_, index) => index);

export default function CyberpunkMonolith({
    color: fallbackColor = '#00f3ff',
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
            className="pointer-events-none relative flex h-[252px] w-[184px] items-center justify-center overflow-hidden rounded-xl"
            style={visualProfile.backgroundStyle}
        >
            <div className="absolute inset-0" style={visualProfile.materialOverlayStyle} />

            <motion.div
                className="absolute inset-0"
                style={{ background: `radial-gradient(circle at 50% 36%, ${color}1f 0%, transparent 64%)` }}
                animate={shouldAnimate ? { opacity: [0.16, 0.42, 0.16] } : { opacity: 0.1 }}
                transition={shouldAnimate ? { duration: 2.2, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
            />

            <div className="relative h-[216px] w-[96px]">
                <motion.div
                    className="absolute inset-0 border"
                    style={{
                        borderColor: material.edge('#24537a'),
                        clipPath: 'polygon(14% 0%, 86% 0%, 100% 100%, 0% 100%)',
                        background: material.face('linear-gradient(180deg, rgba(5, 16, 30, 0.96) 0%, rgba(2, 8, 18, 0.98) 56%, rgba(0, 0, 0, 1) 100%)'),
                    }}
                    animate={shouldAnimate
                        ? {
                            opacity: 1,
                            boxShadow: [
                                `0 0 10px ${color}2f, inset 0 0 18px rgba(0,0,0,0.75)`,
                                `0 0 24px ${color}6b, inset 0 0 24px rgba(0,0,0,0.86)`,
                                `0 0 10px ${color}2f, inset 0 0 18px rgba(0,0,0,0.75)`,
                            ],
                        }
                        : {
                            opacity: 1,
                            boxShadow: 'inset 0 0 24px rgba(0, 0, 0, 0.9)',
                        }}
                    transition={shouldAnimate ? { duration: 1.8, repeat: Infinity, ease: visualProfile.motionEase } : { duration: 0, repeat: 0, delay: 0 }}
                />

                <div className="absolute inset-x-[20px] bottom-[20px] top-[18px] overflow-hidden rounded-[5px] border" style={{ borderColor: material.innerEdge('#1d4c71'), background: material.face('rgba(1,7,18,0.9)') }}>
                    {GLYPH_ROWS.map((row) => (
                        <div key={`glyph-row-${row}`}>
                            <div
                                className="absolute left-0 right-0 h-px"
                                style={{ top: `${8 + row * 18}px`, background: material.innerEdge('#163752') }}
                            />
                            <motion.div
                                className="absolute h-[2px]"
                                style={{
                                    top: `${7 + row * 18}px`,
                                    left: `${row % 2 === 0 ? 6 : 18}px`,
                                    width: `${row % 2 === 0 ? 24 : 16}px`,
                                    background: color,
                                }}
                                animate={shouldAnimate ? { opacity: [0.15, 0.9, 0.15] } : { opacity: 0.08 }}
                                transition={shouldAnimate ? { duration: 1.2, delay: row * 0.06, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
                            />
                        </div>
                    ))}

                    <motion.div
                        className="absolute inset-x-[4px] h-[24px]"
                        style={{
                            background: `linear-gradient(180deg, transparent 0%, ${color}66 46%, transparent 100%)`,
                        }}
                        animate={shouldAnimate ? { y: [0, 132, 0], opacity: [0.22, 0.82, 0.22] } : { y: 66, opacity: 0.08 }}
                        transition={shouldAnimate ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : { duration: 0, repeat: 0, delay: 0 }}
                    />

                    <motion.div
                        className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2"
                        style={{
                            background: `linear-gradient(180deg, transparent 0%, ${color} 16%, ${color} 84%, transparent 100%)`,
                        }}
                        animate={shouldAnimate ? { opacity: [0.22, 0.74, 0.22] } : { opacity: 0.14 }}
                        transition={shouldAnimate ? { duration: 1.3, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
                    />
                </div>

                <div className="absolute -left-[16px] top-[34px] h-[142px] w-[10px] overflow-hidden rounded-sm border" style={{ borderColor: material.edge('#224e74'), background: material.face('#020b18') }}>
                    {SIDE_NODES.map((node) => (
                        <motion.div
                            key={`left-node-${node}`}
                            className="absolute left-1/2 h-[10px] w-[2px] -translate-x-1/2"
                            style={{
                                top: `${12 + node * 24}px`,
                                background: color,
                            }}
                            animate={shouldAnimate ? { opacity: [0.2, 1, 0.2] } : { opacity: 0.12 }}
                            transition={shouldAnimate ? { duration: 0.9, delay: node * 0.08, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
                        />
                    ))}
                </div>

                <div className="absolute -right-[16px] top-[34px] h-[142px] w-[10px] overflow-hidden rounded-sm border" style={{ borderColor: material.edge('#224e74'), background: material.face('#020b18') }}>
                    {SIDE_NODES.map((node) => (
                        <motion.div
                            key={`right-node-${node}`}
                            className="absolute left-1/2 h-[10px] w-[2px] -translate-x-1/2"
                            style={{
                                top: `${12 + node * 24}px`,
                                background: '#a78bfa',
                            }}
                            animate={shouldAnimate ? { opacity: [0.1, 0.85, 0.1] } : { opacity: 0.08 }}
                            transition={shouldAnimate ? { duration: 1, delay: node * 0.09, repeat: Infinity, ease: 'linear' } : { duration: 0, repeat: 0, delay: 0 }}
                        />
                    ))}
                </div>
            </div>

            <div className="absolute bottom-3 text-[9px] font-black uppercase tracking-[0.24em]" style={{ color: material.caption('#9ddaf8') }}>
                TIME ANCHOR
            </div>
        </div>
    );
}
