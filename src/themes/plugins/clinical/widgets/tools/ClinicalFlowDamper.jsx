import React from 'react';
import { motion } from 'framer-motion';
import ClinicalArtifactInstrument from './ClinicalArtifactInstrument.jsx';
import { useClinicalArtifactPresentation } from './useClinicalArtifactPresentation.js';

const METER_TICKS = Array.from({ length: 9 }, (_, i) => 120 + i * 14);

// Brake adds deliberate pacing. A closed metering cylinder absorbs flow; this
// is a mechanical rhythm, not fabricated throughput or a protection command.
export default function ClinicalFlowDamper(props) {
    const p = useClinicalArtifactPresentation('brake', props);
    const { ids, loopProps, weight, childRatio } = p;
    const clickPause = childRatio('clickPause');
    const scrollFriction = childRatio('scrollFriction');
    const inputVisualBrake = childRatio('inputVisualBrake');
    const pistonRest = scrollFriction * 4;
    const skipFriction = childRatio('skipFriction');
    const needleRest = clickPause * 18;
    return (
        <ClinicalArtifactInstrument family="brake" presentation={p}>
            <ellipse cx="173" cy="304" rx="103" ry="12" fill="var(--clinical-ink)" opacity="0.08" />
            <g filter={ids.url('shadow')}>
                <path d="M103 267h134l17 29H86z" fill={ids.url('porcelain')} stroke="var(--clinical-edge)" />
                <path d="M88 297h164v8H88z" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                <path d="M94 158H72v92c0 18 19 24 34 24h14" stroke="var(--clinical-edge)" strokeWidth="12" />
                <path d="M94 158H72v92c0 18 19 24 34 24h14" stroke="var(--clinical-white)" strokeWidth="7" />
                <path d="M226 231h37v-96c0-22-12-32-33-32h-19" stroke="var(--clinical-edge)" strokeWidth="12" />
                <path d="M226 231h37v-96c0-22-12-32-33-32h-19" stroke="var(--clinical-white)" strokeWidth="7" />
                <rect x="125" y="90" width="92" height="177" rx="15" fill={ids.url('glass')} stroke="var(--clinical-edge)" strokeWidth="2" />
                <path d="M136 172h70v73c0 8-6 12-12 12h-47c-7 0-11-5-11-12z" fill={ids.url('teal')}
                    opacity={0.12 + scrollFriction * 0.28} data-clinical-child="scrollFriction" />
                <path d="M142 109v141m4-141v141" stroke="var(--color-background)" strokeWidth="3" opacity="0.85" />
                {METER_TICKS.map((y, i) => <path key={y} d={`M190 ${y}h${i % 2 ? 8 : 14}`} stroke="var(--clinical-teal)" strokeOpacity="0.55" />)}
                <rect x="122" y="83" width="98" height="20" rx="5" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                <rect x="122" y="252" width="98" height="20" rx="5" fill={ids.url('metal')} stroke="var(--clinical-teal)"
                    strokeWidth={1 + inputVisualBrake} strokeOpacity={0.18 + inputVisualBrake * 0.6} data-clinical-child="inputVisualBrake" />
                <rect x="163" y="59" width="16" height="64" rx="3" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                <path d="M143 55h56v8h-56z" fill={ids.url('porcelain')} stroke="var(--clinical-edge)" />
                <motion.g {...loopProps({ y: [pistonRest, pistonRest + 7, pistonRest] }, { y: pistonRest }, 4.8)}>
                    <rect x="144" y="150" width="53" height="14" rx="3" fill={ids.url('metal')} stroke="var(--clinical-teal)" strokeOpacity="0.45" />
                    <rect x="165" y="114" width="11" height="37" fill={ids.url('metal')} />
                    <path d="M146 155h49" stroke="var(--clinical-white)" strokeWidth="2" />
                </motion.g>
                <circle cx="98" cy="198" r="21" fill={ids.url('porcelain')} stroke="var(--clinical-edge)" />
                <circle cx="98" cy="198" r="16" stroke="var(--clinical-teal)" strokeOpacity={0.25 + skipFriction * 0.55} strokeWidth={1 + skipFriction} data-clinical-child="skipFriction" />
                <motion.path d="M98 198l9-10" stroke="var(--clinical-teal)" strokeWidth="2" strokeLinecap="round" data-clinical-child="clickPause"
                    style={{ transformOrigin: '98px 198px' }}
                    {...loopProps({ rotate: [needleRest - 6, needleRest + 6, needleRest - 6] }, { rotate: needleRest }, 4.8)} />
                <circle cx="98" cy="198" r="3" fill="var(--clinical-ink)" />
                <path d="M156 288h30" stroke="var(--clinical-signal)" strokeWidth="2" opacity={weight * 0.7} />
            </g>
        </ClinicalArtifactInstrument>
    );
}
