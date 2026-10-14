import React from 'react';
import { motion } from 'framer-motion';
import { ARTIFACT_SVG_FILTER_REGIONS } from '@/themes/core/artifacts/scene/artifactSvgCoordinateSystem.js';
import ClinicalArtifactInstrument from './ClinicalArtifactInstrument.jsx';
import { useClinicalArtifactPresentation } from './useClinicalArtifactPresentation.js';

const DIAL_TICKS = Array.from({ length: 24 }, (_, i) => i * 15);

// Lens quiets visual stimulation: separate optical wafers represent its real
// grayscale and blur projections rather than manufacturing a laboratory result.
export default function ClinicalOpticalAssay(props) {
    const p = useClinicalArtifactPresentation('lens', props);
    const { ids, childRatio, loopProps, weight } = p;
    const blur = childRatio('blur');
    const grayscale = childRatio('grayscale');
    const brightness = childRatio('brightness');
    const contrast = childRatio('contrast');
    const saturation = childRatio('saturation');
    return (
        <ClinicalArtifactInstrument family="lens" presentation={p}>
            <defs>
                <filter id={ids.get('opticalGrayscale')} {...ARTIFACT_SVG_FILTER_REGIONS.tightObjectBlur}>
                    <feColorMatrix type="saturate" values={1 - grayscale} />
                </filter>
                <filter id={ids.get('opticalBlur')} {...ARTIFACT_SVG_FILTER_REGIONS.tightObjectBlur}>
                    <feGaussianBlur stdDeviation={blur * 1.4} />
                </filter>
            </defs>
            <ellipse cx="170" cy="307" rx="92" ry="11" fill="var(--clinical-ink)" opacity="0.08" />
            <g filter={ids.url('shadow')}>
                <path d="M98 286h144l14 14H84z" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                <path d="M132 246h76l12 40H120z" fill={ids.url('porcelain')} stroke="var(--clinical-edge)" />
                <rect x="153" y="210" width="34" height="65" rx="3" fill={ids.url('metal')} stroke="var(--clinical-edge)" />
                <path d="M242 94l15 11v127l-28 18h-13v-19l20-15V113z" fill={ids.url('porcelain')} stroke="var(--clinical-edge)" />
                <rect x="226" y="213" width="19" height="28" rx="4" fill={ids.url('metal')} />
                <circle cx="239" cy="226" r="7" fill="var(--clinical-white)" stroke="var(--clinical-edge)" />
                <path d="M235 226h8m-4-4v8" stroke="var(--clinical-teal)" />
                <ellipse cx="180" cy="168" rx="94" ry="100" fill={ids.url('metal')} stroke="var(--clinical-edge)" strokeWidth="2" />
                <ellipse cx="164" cy="156" rx="92" ry="100" fill={ids.url('porcelain')} stroke="var(--clinical-edge)" />
                <g style={{ filter: `brightness(${1 - brightness * 0.5}) contrast(${1 - contrast * 0.5}) saturate(${1 - saturation})` }}>
                <g filter={grayscale > 0 ? ids.url('opticalGrayscale') : undefined}>
                <g filter={blur > 0 ? ids.url('opticalBlur') : undefined}>
                <ellipse cx="164" cy="156" rx="77" ry="83" fill="var(--clinical-ink)" opacity="0.92" />
                <ellipse cx="164" cy="156" rx="70" ry="76" fill={ids.url('optic')} />
                <g transform="translate(164 156)" stroke="var(--clinical-white)" opacity="0.62">
                    {DIAL_TICKS.map(angle => <path key={angle} d="M0-85v5" transform={`rotate(${angle})`} />)}
                </g>
                <ellipse cx="164" cy="156" rx="58" ry="63" stroke="var(--clinical-white)" strokeOpacity="0.5" />
                <motion.ellipse cx="164" cy="156" rx="44" ry="48" stroke="var(--clinical-teal)" strokeWidth="1.2"
                    {...loopProps({ opacity: [0.34, 0.82, 0.34], scale: [1, 1.04, 1] }, { opacity: 0.3 + weight * 0.3, scale: 1 }, 5.8)}
                    style={{ transformOrigin: '164px 156px' }} />
                <g stroke="var(--clinical-white)" strokeOpacity="0.68">
                    <path d="M164 128v16m0 24v16m-27-28h15m24 0h15" />
                    <circle cx="164" cy="156" r="6" />
                </g>
                <path d="M121 111c18-26 49-24 65-8" stroke="var(--clinical-white)" strokeWidth="7" strokeLinecap="round" opacity="0.6" />
                <path d="M208 182c-7 18-18 28-36 32" stroke="var(--clinical-white)" strokeWidth="2" strokeLinecap="round" opacity="0.35" />
                </g>
                </g>
                </g>
                <path d="M109 226l78 16 35-18-77-16z" fill={ids.url('glass')} stroke="var(--clinical-teal)" strokeOpacity="0.32"
                    opacity={0.4 + blur * 0.5} transform={`translate(0 ${blur * -5})`} data-clinical-channel="blur" />
                <path d="M102 239l78 16 35-18-77-16z" fill="var(--clinical-ink)" stroke="var(--clinical-edge)"
                    opacity={0.08 + grayscale * 0.28} data-clinical-channel="grayscale" />
                <motion.path d="M116 294h104" stroke="var(--clinical-teal)" strokeWidth="2"
                    {...loopProps({ opacity: [0.2, 0.7, 0.2] }, { opacity: weight * 0.45 }, 4.6)} />
            </g>
        </ClinicalArtifactInstrument>
    );
}
