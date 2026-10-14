import React from 'react';
import { motion } from 'framer-motion';
import ClinicalArtifactInstrument from './ClinicalArtifactInstrument.jsx';
import { useClinicalArtifactPresentation } from './useClinicalArtifactPresentation.js';

const VENTS = Array.from({ length: 9 }, (_, i) => 113 + i * 13);

// Barrier shows consumption boundaries and text disruption. Its instrument
// projects configuration; the content boundary owns each actual decision.
export default function ClinicalIsolationCabinet(props) {
    const p = useClinicalArtifactPresentation('barrier', props);
    const { ids, loopProps, weight, childRatio } = p;
    const intentThreshold = childRatio('intentThreshold');
    const textRhythm = childRatio('textRhythm');
    const detourSpreadGuard = childRatio('detourSpreadGuard');
    return (
        <ClinicalArtifactInstrument family="barrier" presentation={p}>
            <ellipse cx="169" cy="307" rx="109" ry="11" fill="var(--clinical-ink)" opacity="0.08" />
            <g filter={ids.url('shadow')}>
                <path d="M77 97l20-19h158l14 19v190H77z" fill={ids.url('porcelain')} stroke="var(--clinical-edge)" />
                <path d="M255 78l14 19v190l-14 13z" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                <rect x="89" y="105" width="154" height="156" rx="3" fill={ids.url('glass')} stroke="var(--clinical-edge)" />
                <rect x="99" y="115" width="134" height="135" rx="2" fill="var(--color-surface-sunken)" />
                <path d="M108 237l22-13h69l25 13z" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                <path d="M147 206h37v25h-37z" fill={ids.url('glass')} stroke="var(--clinical-teal)" strokeOpacity="0.3" />
                <path d="M153 195h25v11h-25z" fill={ids.url('metal')} />
                <path d="M99 119h134v23H99z" fill={ids.url('porcelain')} stroke="var(--clinical-edge)" />
                {VENTS.map(x => <path key={x} d={`M${x} 128v7`} stroke="var(--clinical-teal)" strokeOpacity="0.38" />)}
                <g stroke="var(--clinical-teal)" strokeOpacity={0.08 + textRhythm * 0.3} strokeDasharray="2 6" data-clinical-child="textRhythm">
                    <path d="M118 147v52m24-52v52m24-52v37m24-37v52m24-52v52" />
                </g>
                <motion.path d="M106 148h119" stroke="var(--clinical-teal)" strokeWidth="1.3"
                    {...loopProps({ y: [0, 65, 0], opacity: [0.15, 0.4, 0.15] }, { y: 0, opacity: weight * 0.18 }, 7.2)} />
                <path d="M91 106h150v155H91z" fill={ids.url('glass')} stroke="var(--clinical-edge)"
                    opacity={0.55 + intentThreshold * 0.4} data-clinical-child="intentThreshold" />
                <path d="M105 118v111m5-110v88" stroke="var(--color-background)" strokeWidth="3" opacity="0.7" />
                <circle cx="124" cy="201" r="15" fill="var(--clinical-white)" stroke="var(--clinical-edge)" />
                <circle cx="207" cy="201" r="15" fill="var(--clinical-white)" stroke="var(--clinical-edge)" />
                <circle cx="124" cy="201" r="10" fill="var(--clinical-ink)" opacity="0.13" />
                <circle cx="207" cy="201" r="10" fill="var(--clinical-ink)" opacity="0.13" />
                <path d="M115 202l10-5 9 5m64 0 9-5 10 5" stroke="var(--clinical-edge)" strokeWidth="3" />
                <rect x="224" y="160" width="9" height="25" rx="2" fill={ids.url('metal')} stroke="var(--clinical-teal)"
                    strokeOpacity={0.15 + intentThreshold * 0.65} transform={`translate(0 ${intentThreshold * -4})`} data-clinical-child="intentThreshold" />
                <path d="M100 277h121" stroke="var(--clinical-edge)" />
                <rect x="102" y="273" width="33" height="7" rx="1" fill="var(--clinical-teal)"
                    opacity={0.12 + detourSpreadGuard * 0.55} data-clinical-child="detourSpreadGuard" />
                <circle cx="237" cy="277" r="3" fill="var(--clinical-signal)" opacity={0.2 + weight * 0.65} />
                <path d="M87 287v15h23v-15m118 0v15h23v-15" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
            </g>
        </ClinicalArtifactInstrument>
    );
}
