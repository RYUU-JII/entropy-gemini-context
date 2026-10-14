import React from 'react';
import { motion } from 'framer-motion';
import ClinicalArtifactInstrument from './ClinicalArtifactInstrument.jsx';
import { useClinicalArtifactPresentation } from './useClinicalArtifactPresentation.js';

// Gate is a two-step decision threshold. The staggered examination chambers
// identify entry and return without executing either ritual inside the gallery.
export default function ClinicalExaminationAirlock(props) {
    const p = useClinicalArtifactPresentation('gate', props);
    const { ids, loopProps, weight, childRatio } = p;
    const entryCheckpoint = childRatio('entryCheckpoint');
    const returnGuard = childRatio('returnGuard');
    return (
        <ClinicalArtifactInstrument family="gate" presentation={p}>
            <ellipse cx="171" cy="308" rx="109" ry="10" fill="var(--clinical-ink)" opacity="0.08" />
            <g filter={ids.url('shadow')}>
                <path d="M79 278l58-39 118 24-46 40z" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                <path d="M79 278v9l130 26v-10z" fill="var(--color-border)" />
                <path d="M209 303v10l46-41v-9z" fill="var(--clinical-edge)" />
                <path d="M151 98l25-20h77v170l-21 20-81-17z" fill={ids.url('glass')} stroke="var(--clinical-edge)" />
                <path d="M155 99h73v153l-15-3V116h-44v125l-14-3z" fill={ids.url('porcelain')} stroke="var(--clinical-edge)" />
                <path d="M228 99l25-21v170l-25 20z" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                <path d="M176 78h77l-25 21h-73z" fill={ids.url('porcelain')} stroke="var(--clinical-edge)" />
                <path d="M185 120h24v123l-24-5z" fill={ids.url('teal')} stroke="var(--clinical-teal)"
                    opacity={0.12 + returnGuard * 0.5} strokeOpacity={0.2 + returnGuard * 0.6} data-clinical-child="returnGuard" />
                <motion.path d="M175 108h33" stroke="var(--clinical-teal)" strokeWidth="2"
                    {...loopProps({ opacity: [0.15, 0.65, 0.15] }, { opacity: weight * 0.3 }, 5.6, 2.8)} />
                <path d="M89 133l26-24h77v175l-27 20-76-15z" fill={ids.url('glass')} stroke="var(--clinical-edge)" />
                <path d="M89 133h77v171l-16-3V151h-45v141l-16-3z" fill={ids.url('porcelain')} stroke="var(--clinical-edge)" />
                <path d="M166 133l26-24v175l-26 20z" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                <path d="M115 109h77l-26 24H89z" fill={ids.url('porcelain')} stroke="var(--clinical-edge)" />
                <rect x="112" y="154" width="30" height="125" fill={ids.url('teal')} stroke="var(--clinical-teal)"
                    opacity={0.12 + entryCheckpoint * 0.5} strokeOpacity={0.2 + entryCheckpoint * 0.6} data-clinical-child="entryCheckpoint" />
                <path d="M128 155v122" stroke="var(--color-background)" strokeWidth="2" opacity="0.8" />
                <path d="M139 218v19" stroke="var(--clinical-edge)" strokeWidth="3" strokeLinecap="round" />
                <motion.path d="M110 142h34" stroke="var(--clinical-teal)" strokeWidth="2"
                    {...loopProps({ opacity: [0.15, 0.65, 0.15] }, { opacity: weight * 0.3 }, 5.6)} />
                <path d="M164 274l26-20m-21 31 25-21" stroke="var(--clinical-teal)" strokeOpacity="0.25" />
                <circle cx="175" cy="187" r="4" fill="var(--clinical-signal)" opacity={0.2 + weight * 0.6} />
                <circle cx="239" cy="153" r="3" fill="var(--clinical-signal)" opacity={0.2 + weight * 0.6} />
                <path d="M91 291l13 2m43 8 16 3m66-36 21-19" stroke="var(--clinical-edge)" strokeWidth="2" />
            </g>
        </ClinicalArtifactInstrument>
    );
}
