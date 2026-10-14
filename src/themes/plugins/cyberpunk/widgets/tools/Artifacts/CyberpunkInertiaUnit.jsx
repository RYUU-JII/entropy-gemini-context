import React from 'react';
import { motion } from 'framer-motion';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useArtifactRenderChannels } from '@/themes/core/tools/useArtifactRenderChannels.js';
import { useArtifactSvgIdScope } from '@/themes/core/artifacts/scene/useArtifactSvgIdScope.js';
import { createArtifactSvgViewBox, ARTIFACT_SVG_FILTER_REGIONS } from '@/themes/core/artifacts/scene/artifactSvgCoordinateSystem.js';
import { getArtifactVisualProfile } from '../../../shared/artifactVisualProfile.js';
import { requireCyberpunkArtifactProjection } from './requireCyberpunkArtifactProjection.js';
import { getCyberpunkArtifactMaterial } from './cyberpunkArtifactMaterial.js';

const VIEW_BOX = createArtifactSvgViewBox(320, 280);
const COIL_SEGMENTS = Array.from({ length: 7 }, (_, i) => i);

// Opposing magnetic collars resist an impulse. Coil geometry expresses the
// configured pacing tools, without implying an executed or measured action.
export default function CyberpunkInertiaUnit({ artifactRenderContext = null, isEnabled = true }) {
    const { t } = useAppTranslation('tools');
    const childRatio = requireCyberpunkArtifactProjection(artifactRenderContext, 'brake');
    const channels = useArtifactRenderChannels({ artifactRenderContext });
    const ids = useArtifactSvgIdScope('cyberpunk-inertia-unit');
    const color = channels.color;
    const material = getCyberpunkArtifactMaterial(channels.isVisuallyActive);
    const metal = material.metal(['#477289', '#102435', '#020b16', '#324166']);
    const shouldAnimate = isEnabled && channels.shouldAnimateMotion && !channels.renderState.reducedMotion;
    const clickPause = childRatio('clickPause');
    const scrollFriction = childRatio('scrollFriction');
    const inputVisualBrake = childRatio('inputVisualBrake');
    const skipFriction = childRatio('skipFriction');
    const collarRest = clickPause * 8;
    const visualProfile = getArtifactVisualProfile({ themeId: channels.themeId, signatureColor: color,
        isActive: channels.isVisuallyActive, artifactRenderState: channels.renderState });
    const loopProps = (animated, still, duration, delay = 0) => ({
        initial: still, animate: shouldAnimate ? animated : still,
        transition: shouldAnimate ? { duration, delay, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0, delay: 0, repeat: 0 },
    });

    return (
        <div className="pointer-events-none relative h-[280px] w-[320px] overflow-hidden rounded-lg"
            data-artifact-material={material.mode}
            style={visualProfile.backgroundStyle}>
            <div className="absolute inset-0" style={visualProfile.materialOverlayStyle} />
            <svg className="relative h-full w-full" viewBox={VIEW_BOX} fill="none" aria-hidden="true">
                <defs>
                    <linearGradient id={ids.get('metal')} x1="70" y1="60" x2="245" y2="236" gradientUnits="userSpaceOnUse">
                        <stop stopColor={metal[0]} /><stop offset="0.28" stopColor={metal[1]} /><stop offset="0.56" stopColor={metal[2]} /><stop offset="1" stopColor={metal[3]} />
                    </linearGradient>
                    <linearGradient id={ids.get('glass')} x1="128" y1="96" x2="193" y2="205" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#b5eaff" stopOpacity="0.32" /><stop offset="0.22" stopColor="#1b5068" stopOpacity="0.4" />
                        <stop offset="0.68" stopColor="#070d27" stopOpacity="0.96" /><stop offset="1" stopColor="#5e4890" stopOpacity="0.5" />
                    </linearGradient>
                    <linearGradient id={ids.get('signal')} x1="110" y1="0" x2="210" y2="0" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#00f3ff" stopOpacity="0.25" /><stop offset="0.48" stopColor={color} stopOpacity="0.8" />
                        <stop offset="1" stopColor="#a78bfa" stopOpacity="0.45" />
                    </linearGradient>
                    <filter id={ids.get('shadow')} {...ARTIFACT_SVG_FILTER_REGIONS.objectGlow}>
                        <feDropShadow dx="0" dy="8" stdDeviation="5" floodColor="#000" floodOpacity="0.65" />
                    </filter>
                </defs>
                <ellipse cx="160" cy="241" rx="101" ry="11" fill="#02040d" opacity="0.8" />
                <g filter={ids.url('shadow')}>
                    <path d="M77 210l31-16h104l31 16v22H77z" fill={ids.url('metal')} stroke={material.edge('#51718b')} />
                    <path d="M78 211h163v11H78z" fill={material.face('#040d1b')} stroke={material.innerEdge('#26405a')} />
                    <path data-artifact-child="skipFriction" d="M101 215h29m60 0h30" stroke="#00f3ff" strokeOpacity={0.15 + skipFriction * 0.65} strokeWidth={2 + skipFriction} />
                    <path d="M84 205V93l26-28h100l26 28v112" stroke={ids.url('metal')} strokeWidth="13" />
                    <path d="M85 203V94l25-25h99l26 25v109" stroke="#7398b8" strokeOpacity="0.35" />
                    <path d="M95 101l17-17m96 0 17 17M92 184l17 16m102 0 17-16" stroke="#435875" strokeWidth="3" />
                    <ellipse cx="160" cy="155" rx="79" ry="31" stroke={material.edge('#374267')} strokeWidth="10" />
                    <ellipse cx="160" cy="155" rx="76" ry="28" stroke={material.innerEdge('#8295be')} strokeOpacity={channels.isVisuallyActive ? 0.25 : 1} />
                    <g data-artifact-child="scrollFriction" opacity={channels.isVisuallyActive ? 0.24 + scrollFriction * 0.58 : 1}>
                        {COIL_SEGMENTS.map(i => <path key={i} d={`M${92 + i * 9} ${142 - i * 1.8}v${26 + i * 3.6}`}
                            stroke="#00f3ff" strokeWidth="2" strokeOpacity={0.25 + scrollFriction * 0.4} />)}
                        {COIL_SEGMENTS.map(i => <path key={i} d={`M${228 - i * 9} ${142 - i * 1.8}v${26 + i * 3.6}`}
                            stroke="#a78bfa" strokeWidth="2" strokeOpacity={0.25 + scrollFriction * 0.4} />)}
                    </g>
                    <rect x="129" y="99" width="62" height="105" rx="15" fill={material.face(ids.url('glass'))} stroke={material.edge('#688eaa')} />
                    <path d="M137 113v77m5-78v76" stroke="#d0f4ff" strokeOpacity="0.3" />
                    <path d="M134 101h52m-52 100h52" stroke="#91b8cd" strokeOpacity="0.48" />
                    <motion.g data-artifact-child="clickPause" {...loopProps({ y: [collarRest, collarRest + 2, collarRest] }, { y: collarRest }, 4.2)}>
                        <path d="M124 113h72v15h-72z" fill={ids.url('metal')} stroke={material.edge('#719bb4')} />
                        <path d="M127 119h66" stroke="#00f3ff" strokeOpacity={0.2 + clickPause * 0.5} strokeWidth="2" />
                    </motion.g>
                    <g data-artifact-child="inputVisualBrake" transform={`translate(0 ${-inputVisualBrake * 6})`}>
                        <path d="M124 178h72v15h-72z" fill={ids.url('metal')} stroke={material.edge('#6d709f')} />
                        <path d="M128 184h64" stroke="#a78bfa" strokeOpacity={0.2 + inputVisualBrake * 0.55} strokeWidth="2" />
                    </g>
                    <motion.path d="M141 153h38m-34-7 8 14m6-15 7 15m3-15 7 14" stroke={ids.url('signal')} strokeWidth="2"
                        {...loopProps({ opacity: [0.24, 0.72, 0.24] }, { opacity: 0.2 }, 2.8)} />
                    <path d="M115 72h90m-90 5h23m-23 145h23m44 0h23" stroke="#91b8cd" strokeOpacity="0.33" />
                    <circle cx="86" cy="98" r="4" fill="#0a1729" stroke="#507b99" />
                    <circle cx="234" cy="98" r="4" fill="#0a1729" stroke="#60578d" />
                    <path d="M85 98h2m146 0h2" stroke="#b4c8e1" strokeOpacity="0.5" />
                </g>
            </svg>
            <div className="absolute inset-x-0 bottom-3 text-center font-mono text-[9px] font-black uppercase tracking-[0.22em]" style={{ color: material.caption('#d8f5ff') }}>
                {t('artifacts.brake.title')}
            </div>
        </div>
    );
}
