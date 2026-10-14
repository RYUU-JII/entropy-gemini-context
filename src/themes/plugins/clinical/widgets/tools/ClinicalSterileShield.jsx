import React from 'react';
import { motion } from 'framer-motion';
import ClinicalArtifactInstrument from './ClinicalArtifactInstrument.jsx';
import { useClinicalArtifactPresentation } from './useClinicalArtifactPresentation.js';

const FROST_LINES = Array.from({ length: 11 }, (_, i) => 105 + i * 12);

// Veil screens social/time cues. The frosted plane remains closed; its ambient
// seam shows material activity without suggesting a user decision or clinical data.
export default function ClinicalSterileShield(props) {
    const p = useClinicalArtifactPresentation('veil', props);
    const { ids, loopProps, childRatio, weight } = p;
    const socialMetrics = childRatio('socialMetrics');
    const timeSignals = childRatio('timeSignals');
    const shortformBlock = childRatio('shortformBlock');
    return (
        <ClinicalArtifactInstrument family="veil" presentation={p}>
            <ellipse cx="171" cy="307" rx="106" ry="12" fill="var(--clinical-ink)" opacity="0.07" />
            <g filter={ids.url('shadow')}>
                <path d="M90 285l52-17 118 22-51 17z" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                <path d="M90 285v9l119 23v-10z" fill="var(--color-border)" />
                <path d="M209 307v10l51-18v-9z" fill="var(--clinical-edge)" />
                <path d="M113 74l119 23v190l-119-23z" fill={ids.url('glass')} stroke="var(--clinical-edge)" strokeWidth="2" />
                <path d="M121 85l103 20v169l-103-20z" fill={ids.url('porcelain')} opacity="0.4" />
                <g filter={ids.url('frost')} stroke="var(--clinical-teal)" strokeWidth="3">
                    <g data-clinical-child="socialMetrics" opacity={0.12 + socialMetrics * 0.5}>
                        <path d="M141 122l51 10m-51 15 64 13m-64 16 35 7" />
                        <circle cx="164" cy="156" r="9" />
                    </g>
                    <g data-clinical-child="timeSignals" opacity={0.1 + timeSignals * 0.5}>
                        <path d="M141 196l56 11m-56 12 46 9" />
                    </g>
                </g>
                {FROST_LINES.map((y, i) => <path key={y} d={`M123 ${y}l99 19`} stroke="var(--color-background)" strokeOpacity={i % 3 === 0 ? 0.48 : 0.23} />)}
                <path d="M114 75l15-8 119 23-16 7z" fill={ids.url('porcelain')} stroke="var(--clinical-edge)" />
                <path d="M232 97l16-7v189l-16 8z" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                <path d="M125 89v164m4-163v162" stroke="var(--color-background)" strokeWidth="2" opacity="0.85" />
                <g data-clinical-child="shortformBlock" transform={`translate(0 ${shortformBlock * -3})`}>
                    <rect x="95" y="272" width="40" height="10" rx="2" fill={ids.url('metal')} stroke="var(--clinical-teal)"
                        strokeOpacity={0.18 + shortformBlock * 0.62} transform="rotate(11 95 272)" />
                </g>
                <rect x="208" y="292" width="36" height="9" rx="2" fill={ids.url('porcelain')} stroke="var(--clinical-edge)" transform="rotate(-18 208 292)" />
                <motion.path d="M229 110v151" stroke="var(--clinical-teal)" strokeWidth="2"
                    {...loopProps({ opacity: [0.15, 0.62, 0.15] }, { opacity: 0.12 + weight * 0.18 }, 6.2)} />
                <motion.path d="M135 96l47 9" stroke="var(--clinical-white)" strokeWidth="4" strokeLinecap="round"
                    {...loopProps({ opacity: [0.3, 0.8, 0.3], x: [0, 14, 0] }, { opacity: 0.48, x: 0 }, 7.4)} />
                <circle cx="240" cy="130" r="2" fill="var(--clinical-signal)" opacity={0.24 + weight * 0.65} />
            </g>
        </ClinicalArtifactInstrument>
    );
}
