import React from 'react';
import { motion } from 'framer-motion';
import ClinicalArtifactInstrument from './ClinicalArtifactInstrument.jsx';
import { useClinicalArtifactPresentation } from './useClinicalArtifactPresentation.js';

const CARTRIDGES = ['historyCleanup', 'bookmarkConceal', 'tabEvaporation'];
const SEAL_MARKS = [0, 1, 2, 3, 4, 5, 6];

// Echo's sealed archive represents memory retention/decay. It never counts
// records, opens a cartridge, or performs the controller's destructive actions.
export default function ClinicalSpecimenArchive(props) {
    const p = useClinicalArtifactPresentation('echo', props);
    const { ids, loopProps, weight, childRatio } = p;
    return (
        <ClinicalArtifactInstrument family="echo" presentation={p}>
            <ellipse cx="171" cy="307" rx="110" ry="10" fill="var(--clinical-ink)" opacity="0.08" />
            <g filter={ids.url('shadow')}>
                <path d="M83 142l40-24h141v154l-40 28-141-23z" fill={ids.url('porcelain')} stroke="var(--clinical-edge)" />
                <path d="M83 142l40-24h141l-40 29z" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                <path d="M224 147l40-29v154l-40 28z" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                <path d="M93 155l120 4v115l-120-18z" fill="var(--color-surface-sunken)" stroke="var(--clinical-edge)" />
                {CARTRIDGES.map((childKey, i) => (
                    <g key={childKey} transform={`translate(${104 + i * 35} ${i * 3})`}>
                        <rect x="0" y="154" width="24" height="92" rx="5" fill={ids.url('glass')} stroke="var(--clinical-teal)" strokeOpacity="0.3" />
                        <path d="M3 180h18v55H3z" fill={ids.url('teal')}
                            opacity={0.08 + childRatio(childKey) * 0.55} data-clinical-child={childKey} />
                        <rect x="-2" y="147" width="28" height="16" rx="3" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                        <path d="M5 152h14m-14 4h14" stroke="var(--clinical-edge)" />
                        <path d="M5 169v63" stroke="var(--color-background)" strokeWidth="2" opacity="0.8" />
                        <motion.path d="M8 194h8m-8 11h8m-8 11h8" stroke="var(--clinical-teal)" strokeWidth="2"
                            {...loopProps({ opacity: [0.12, 0.5, 0.12] }, { opacity: weight * 0.25 }, 8.4, i * 0.5)} />
                        <path d="M3 238h18" stroke="var(--clinical-teal)" strokeOpacity="0.4" />
                    </g>
                ))}
                <path d="M90 152l128 5v129L90 266z" fill={ids.url('glass')} stroke="var(--clinical-edge)" />
                <path d="M99 164v82m4-83v66" stroke="var(--color-background)" strokeWidth="3" opacity="0.8" />
                <rect x="200" y="205" width="7" height="22" rx="2" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                <path d="M123 116V94h45v31l-10-1v-19h-24v13z" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                <path d="M185 136l-8-20h41l12 20" fill={ids.url('porcelain')} stroke="var(--clinical-edge)" />
                <path d="M226 194l31-22v16l-31 23z" fill="var(--clinical-teal)" opacity="0.14" />
                <g stroke="var(--clinical-ink)" strokeOpacity="0.3">
                    {SEAL_MARKS.map(i => <path key={i} d={`M${232 + i * 3} ${192 - i * 2}v${i % 2 ? 5 : 8}`} />)}
                </g>
                <circle cx="244" cy="240" r="3" fill="var(--clinical-signal)" opacity={0.15 + weight * 0.6} />
                <path d="M99 279l21 3m77 12 19 3" stroke="var(--clinical-edge)" strokeWidth="4" strokeLinecap="round" />
            </g>
        </ClinicalArtifactInstrument>
    );
}
