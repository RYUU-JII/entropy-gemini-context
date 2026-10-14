import React from 'react';
import { motion } from 'framer-motion';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useArtifactRenderChannels } from '@/themes/core/tools/useArtifactRenderChannels.js';
import { useArtifactSvgIdScope } from '@/themes/core/artifacts/scene/useArtifactSvgIdScope.js';
import { createArtifactSvgViewBox, ARTIFACT_SVG_FILTER_REGIONS } from '@/themes/core/artifacts/scene/artifactSvgCoordinateSystem.js';
import { getArtifactVisualProfile } from '../../../shared/artifactVisualProfile.js';
import { requireMatrixArtifactProjection } from './requireMatrixArtifactProjection.js';
import { getMatrixArtifactMaterial } from './matrixArtifactMaterial.js';

const VIEW_BOX = createArtifactSvgViewBox(320, 260);
const LATTICE_CELLS = Array.from({ length: 48 }, (_, i) => ({
    x: 55 + (i % 12) * 18, y: 76 + Math.floor(i / 12) * 25,
}));
const FINS = Array.from({ length: 5 }, (_, i) => i);

// A horizontal code lattice meters an incoming pulse. Its shutters show the
// configured pacing intent; they do not report a fabricated throughput value.
export default function MatrixPulseDamper({ artifactRenderContext = null, isEnabled = true }) {
    const { t } = useAppTranslation('tools');
    const childRatio = requireMatrixArtifactProjection(artifactRenderContext, 'brake');
    const channels = useArtifactRenderChannels({ artifactRenderContext });
    const ids = useArtifactSvgIdScope('matrix-pulse-damper');
    const color = channels.color;
    const material = getMatrixArtifactMaterial(channels.isVisuallyActive);
    const metal = material.metal(['#9bbd9f', '#25432b', '#061208', '#416449']);
    const shouldAnimate = isEnabled && channels.shouldAnimateMotion && !channels.renderState.reducedMotion;
    const clickPause = childRatio('clickPause');
    const scrollFriction = childRatio('scrollFriction');
    const inputVisualBrake = childRatio('inputVisualBrake');
    const skipFriction = childRatio('skipFriction');
    const jawRest = Math.max(clickPause, skipFriction) * 10;
    const visualProfile = getArtifactVisualProfile({ themeId: channels.themeId, signatureColor: color,
        isActive: channels.isVisuallyActive, artifactRenderState: channels.renderState });
    const loopProps = (animated, still, duration, delay = 0) => ({
        initial: still, animate: shouldAnimate ? animated : still,
        transition: shouldAnimate ? { duration, delay, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0, delay: 0, repeat: 0 },
    });

    return (
        <div data-artifact-material={material.mode} className="pointer-events-none relative h-[260px] w-[320px] overflow-hidden rounded-lg"
            style={visualProfile.backgroundStyle}>
            <div className="absolute inset-0" style={visualProfile.materialOverlayStyle} />
            <svg className="relative h-full w-full" viewBox={VIEW_BOX} fill="none" aria-hidden="true">
                <defs>
                    <linearGradient id={ids.get('chassis')} x1="45" y1="50" x2="275" y2="207" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#17251a" /><stop offset="0.42" stopColor="#040b05" /><stop offset="1" stopColor="#09190b" />
                    </linearGradient>
                    <linearGradient id={ids.get('metal')} x1="0" y1="0" x2="1" y2="1">
                        <stop stopColor={metal[0]} /><stop offset="0.3" stopColor={metal[1]} /><stop offset="0.6" stopColor={metal[2]} /><stop offset="1" stopColor={metal[3]} />
                    </linearGradient>
                    <linearGradient id={ids.get('pulse')} x1="30" y1="0" x2="290" y2="0" gradientUnits="userSpaceOnUse">
                        <stop stopColor={color} stopOpacity="0.12" /><stop offset="0.48" stopColor={color} stopOpacity="0.85" />
                        <stop offset="1" stopColor={color} stopOpacity="0.16" />
                    </linearGradient>
                    <filter id={ids.get('shadow')} {...ARTIFACT_SVG_FILTER_REGIONS.objectGlow}>
                        <feDropShadow dx="0" dy="8" stdDeviation="5" floodColor="#000" floodOpacity="0.7" />
                    </filter>
                </defs>
                <ellipse cx="160" cy="221" rx="118" ry="9" fill="#000" opacity="0.7" />
                <g filter={ids.url('shadow')}>
                    <path d="M47 54h226l15 15v130l-15 12H47l-15-12V69z" fill={ids.url('chassis')} stroke={material.edge('#385e3f')} />
                    <path d="M47 58h224l12 12M37 77v115l13 13h219" stroke="#89b48d" strokeOpacity="0.22" />
                    <path d="M50 69h218v128H50z" fill={material.face('#010602')} stroke={material.innerEdge('#24412b')} />
                    {LATTICE_CELLS.map(({ x, y }, i) => <path key={i} d={`M${x} ${y}h${i % 3 === 0 ? 8 : 4}m-4 5h3`}
                        stroke={color} strokeOpacity={0.12 + channels.visualWeight * 0.14} />)}
                    <path d="M26 147h268" stroke={ids.url('metal')} strokeWidth="12" />
                    <path d="M26 146h268" stroke="#9be2a8" strokeOpacity="0.3" strokeWidth="1" />
                    <rect x="113" y="89" width="91" height="100" rx="3" fill={ids.url('chassis')} stroke={material.edge('#61966a')} />
                    <rect x="120" y="98" width="77" height="82" fill={material.face('#010502')} stroke={material.innerEdge('#284d31')} />
                    <motion.path d="M36 147h247" stroke={ids.url('pulse')} strokeWidth="2" strokeDasharray="14 26"
                        {...loopProps({ strokeDashoffset: [0, -80], opacity: [0.24, 0.64, 0.24] }, { strokeDashoffset: 0, opacity: 0.2 }, 3.6)} />
                    <motion.g data-artifact-child="clickPause" {...loopProps({ x: [jawRest, jawRest + 1.8, jawRest] }, { x: jawRest }, 3.6)}>
                        <path d="M99 107h12v27h12v25h-12v24H99z" fill={ids.url('metal')} stroke="#92b69a" strokeOpacity="0.65" />
                        <path d="M107 136h12v22h-12z" fill={color} opacity={0.15 + clickPause * 0.4} />
                    </motion.g>
                    <g data-artifact-child="scrollFriction" transform={`translate(0 ${scrollFriction * 4})`}>
                        {FINS.map(i => <path key={i} d={`M${132 + i * 12} 110v62`} stroke={ids.url('metal')} strokeWidth="7" />)}
                        <path d="M128 119h59m-59 42h59" stroke={color} strokeOpacity={0.16 + scrollFriction * 0.56} />
                    </g>
                    <g data-artifact-child="inputVisualBrake" opacity={channels.isVisuallyActive ? 0.38 + inputVisualBrake * 0.5 : 1}>
                        <rect x="223" y="88" width="35" height="95" rx="2" fill={material.face('#091a0d')} stroke={material.edge('#598263')} />
                        {[0, 1, 2, 3, 4, 5].map(i => <path key={i} d={`M230 ${103 + i * 13}h${18 - (i % 3) * 4}`}
                            stroke={color} strokeWidth="2" strokeOpacity={0.28 + inputVisualBrake * 0.48} />)}
                        <path d="M229 94h23m-23 83h23" stroke="#b9e8c1" strokeOpacity="0.3" />
                    </g>
                    <path d="M57 185h42m-42 5h25m113-113h62" stroke="#659771" strokeOpacity="0.45" />
                    <path d="M60 210v6h18v-6m164 0v6h18v-6" fill={ids.url('metal')} stroke="#3c6043" />
                    {[46, 274].map(x => <g key={x}><circle cx={x} cy="76" r="3" fill="#071108" stroke="#58735e" />
                        <path d={`M${x - 1.5} 76h3`} stroke="#a0bda5" strokeOpacity="0.4" /></g>)}
                </g>
            </svg>
            <div className="absolute inset-x-0 bottom-3 text-center font-mono text-[9px] font-black uppercase tracking-[0.22em] text-[#9adca8]"
                style={{ color: material.caption('#9adca8') }}>
                {t('artifacts.brake.title')}
            </div>
        </div>
    );
}
