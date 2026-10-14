import React from 'react';
import { motion } from 'framer-motion';
import ClinicalArtifactInstrument from './ClinicalArtifactInstrument.jsx';
import { useClinicalArtifactPresentation } from './useClinicalArtifactPresentation.js';

const LOUVERS = Array.from({ length: 7 }, (_, i) => 113 + i * 11);

// Flare is a measured nudge rather than a fabricated alarm reading. The beacon
// breathes through its calibrated collar only when canonical motion is admitted.
export default function ClinicalWarningBeacon(props) {
    const p = useClinicalArtifactPresentation('flare', props);
    const { ids, loopProps, weight, childRatio } = p;
    const sentinelFlare = childRatio('sentinelFlare');
    return (
        <ClinicalArtifactInstrument family="flare" presentation={p}>
            <ellipse cx="170" cy="309" rx="87" ry="10" fill="var(--clinical-ink)" opacity="0.09" />
            <g filter={ids.url('shadow')}>
                <path d="M109 282h122l14 20H95z" fill={ids.url('porcelain')} stroke="var(--clinical-edge)" />
                <path d="M96 301h148v8H96z" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                <rect x="152" y="216" width="36" height="67" rx="3" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                <path d="M143 270h54v13h-54z" fill={ids.url('porcelain')} stroke="var(--clinical-edge)" />
                <path d="M117 185V99c0-27 20-47 53-47s53 20 53 47v86z" fill={ids.url('glass')} stroke="var(--clinical-edge)" strokeWidth="1.5" />
                <path d="M125 177V102c0-23 17-41 45-41s45 18 45 41v75z" fill={ids.url('glass')} />
                <motion.g {...loopProps({ opacity: [0.2, 0.75, 0.2] }, { opacity: 0.16 + sentinelFlare * 0.4 }, 4.2)}>
                    <path d="M141 110c0-17 12-30 29-30s29 13 29 30v66h-58z" fill="var(--clinical-signal)" opacity="0.25" />
                    <rect x="153" y="98" width="34" height="80" rx="15" fill="var(--clinical-signal)"
                        opacity={0.08 + sentinelFlare * 0.55} data-clinical-child="sentinelFlare" />
                    <path d="M165 102v61" stroke="var(--clinical-white)" strokeWidth="3" opacity="0.72" />
                </motion.g>
                {LOUVERS.map(y => <path key={y} d={`M137 ${y}h66`} stroke="var(--clinical-teal)" strokeOpacity="0.2" />)}
                <path d="M134 101c0-17 9-31 22-36" stroke="var(--color-background)" strokeWidth="5" strokeLinecap="round" opacity="0.85" />
                <path d="M210 104v62" stroke="var(--color-background)" strokeWidth="2" opacity="0.75" />
                <rect x="111" y="180" width="118" height="24" rx="5" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                <path d="M117 188h106m-102 8h98" stroke="var(--clinical-edge)" />
                <path d="M127 204h86l-10 16h-66z" fill={ids.url('porcelain')} stroke="var(--clinical-edge)" />
                <g stroke="var(--clinical-ink)" strokeOpacity="0.28">
                    <path d="M126 183v4m11-4v4m11-4v4m11-4v4m11-4v4m11-4v4m11-4v4m11-4v4m11-4v4" />
                </g>
                <circle cx="170" cy="240" r="6" fill="var(--clinical-white)" stroke="var(--clinical-edge)" />
                <path d="M168 240h4" stroke="var(--clinical-teal)" strokeWidth="2" />
                <motion.path d="M143 290h54" stroke="var(--clinical-teal)" strokeWidth="2"
                    {...loopProps({ opacity: [0.18, 0.55, 0.18] }, { opacity: weight * 0.25 }, 4.2)} />
            </g>
        </ClinicalArtifactInstrument>
    );
}
