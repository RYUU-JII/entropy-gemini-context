import React from 'react';
import { motion } from 'framer-motion';
import { ARTIFACT_SVG_FILTER_REGIONS } from '@/themes/core/artifacts/scene/artifactSvgCoordinateSystem.js';
import SCPArtifactFrame from '../SCPArtifactFrame.jsx';
import { useSCPArtifactPresentation } from '../useSCPArtifactPresentation.js';

const FASTENERS = [[94, 294], [326, 294], [102, 350], [318, 350]];
const CALIBRATION_MARKS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export default function SCPInspectionArray({ artifactRenderContext = null, isEnabled = true }) {
  const a = useSCPArtifactPresentation({ artifactRenderContext, familyId: 'lens', isEnabled });
  const grayscale = a.childRatio('grayscale');
  const blur = a.childRatio('blur');
  const brightness = a.childRatio('brightness');
  const contrast = a.childRatio('contrast');
  const saturation = a.childRatio('saturation');
  return <SCPArtifactFrame presentation={a}>{({ ids, palette: p }) => <>
    <defs>
      <filter id={ids.opticalGrayscale} {...ARTIFACT_SVG_FILTER_REGIONS.tightObjectBlur}>
        <feColorMatrix type="saturate" values={1 - grayscale} />
      </filter>
      <filter id={ids.opticalBlur} {...ARTIFACT_SVG_FILTER_REGIONS.tightObjectBlur}>
        <feGaussianBlur stdDeviation={blur * 1.6} />
      </filter>
    </defs>
    <path d="M70 286 105 268h210l35 18v66l-24 20H94l-24-20Z" fill={`url(#${ids.metal})`} stroke={p.steelEdge} strokeWidth="2" />
    <path d="M70 286h280M94 352h232" fill="none" stroke={p.brushed} strokeWidth="1.5" />
    <rect x="94" y="301" width="232" height="36" rx="2" fill={p.recess} stroke={p.steelEdge} />
    {CALIBRATION_MARKS.map(i => <path key={i} d={`M${112 + i * 24} 308v${i % 2 ? 10 : 19}`} stroke={p.paperEdge} strokeWidth="1" />)}
    {FASTENERS.map(([x, y]) => <g key={`${x}-${y}`}><circle cx={x} cy={y} r="4" fill={p.recess} stroke={p.brushed} /><path d={`M${x - 2} ${y}h4`} stroke={p.muted} /></g>)}
    <path d="M166 289v-49h88v49" fill={`url(#${ids.metal})`} stroke={p.steelEdge} strokeWidth="2" />
    <path d="M178 252v29m64-29v29" stroke={p.brushed} strokeWidth="2" />
    <g transform="translate(210 161)">
      <path d="M-106-72-76-98H76l30 26V62L75 92H-75l-31-30Z" fill={`url(#${ids.metal})`} stroke={p.brushed} strokeWidth="2" />
      <path d="M-93-64-69-84H69l24 20" fill="none" stroke={p.ivory} strokeOpacity="0.36" />
      <circle r="74" fill={p.recess} stroke={`url(#${ids.edge})`} strokeWidth="12" />
      <g style={{ filter: `brightness(${1 - brightness * 0.5}) contrast(${1 - contrast * 0.5}) saturate(${1 - saturation})` }}>
      <g filter={grayscale > 0 ? `url(#${ids.opticalGrayscale})` : undefined}>
      <g filter={blur > 0 ? `url(#${ids.opticalBlur})` : undefined}>
      <circle r="58" fill={`url(#${ids.glass})`} stroke={p.steelEdge} strokeWidth="2" />
      <circle r="41" fill={`url(#${ids.well})`} stroke={p.paperEdge} strokeOpacity="0.44" />
      <path d="M-35-12 0-30 35-12 0 9Zm0 22 35 21 35-21" fill="none" stroke={p.amber} strokeOpacity="0.42" strokeWidth="2" />
      <motion.g {...a.motionProps({ rotate: [-3 * a.motionGain, 3 * a.motionGain, -3 * a.motionGain] }, { rotate: 0 }, 9)}>
        {[0, 60, 120, 180, 240, 300].map(angle => <path key={angle} transform={`rotate(${angle})`} d="M-7-67h14v8H-7Z" fill={p.ivory} fillOpacity="0.6" />)}
      </motion.g>
      <path d="M-49 0h28m42 0h28M0-49v28m0 42v28" stroke={a.accent} strokeOpacity={a.signalOpacity} strokeWidth="1.5" />
      <path d="M-22-15v-7h7m30 0h7v7m0 30v7h-7m-30 0h-7v-7" fill="none" stroke={p.ivory} strokeOpacity="0.7" />
      <motion.path d="M-45-25Q0-50 45-25" fill="none" stroke={p.ivory} strokeWidth="2"
        {...a.motionProps({ opacity: [0.18, 0.5, 0.18] }, { opacity: 0.18 }, 7)} />
      </g>
      </g>
      </g>
      <path data-scp-artifact-child="grayscale" d="M-52 31H52" stroke={p.ivory} strokeWidth="3" opacity={grayscale * 0.8} />
      <circle data-scp-artifact-child="blur" r="33" fill="none" stroke={a.accent} strokeWidth="5" opacity={blur * 0.5} filter={`url(#${ids.glow})`} />
      <circle r="3" fill={a.accent} opacity={a.signalOpacity} />
    </g>
    <path d="M96 365h228" stroke={p.amber} strokeWidth="3" strokeOpacity="0.56" />
  </>}</SCPArtifactFrame>;
}
