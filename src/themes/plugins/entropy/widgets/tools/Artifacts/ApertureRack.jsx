import React from 'react';
import { motion } from 'framer-motion';
import EntropyArtifactFrame from '../EntropyArtifactFrame.jsx';
import { useEntropyArtifactPresentation } from '../useEntropyArtifactPresentation.js';

const TICKS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const FASTENERS = [[107, 100], [313, 100], [107, 282], [313, 282]];

export default function ApertureRack({ artifactRenderContext = null, isEnabled = true }) {
  const a = useEntropyArtifactPresentation({ artifactRenderContext, familyId: 'lens', isEnabled });
  const grayscale = a.childRatio('grayscale');
  const blur = a.childRatio('blur');
  const brightness = a.childRatio('brightness');
  const contrast = a.childRatio('contrast');
  const saturation = a.childRatio('saturation');
  return <EntropyArtifactFrame presentation={a}>{({ ids, palette: p }) => <>
    <path d="M97 349h226l20 24v26H77v-26Z" fill={`url(#${ids.hull})`} stroke={p.metalEdge} strokeWidth="2" />
    <path d="M80 382h260v17H80Z" fill={p.graphite} />
    <path d="M172 294h76v68h-76Z" fill={`url(#${ids.metal})`} stroke={p.metalEdge} />
    <path d="M180 302v48m60-48v48" stroke={p.white} strokeOpacity="0.55" />
    <path d="M106 79h208l23 24v174l-25 29H108l-25-29V103Z" fill={`url(#${ids.hull})`} stroke={p.metalEdge} strokeWidth="2" />
    <path d="M110 92h200l13 14v165l-17 20H114l-17-20V106Z" fill={p.graphite} stroke={p.white} strokeOpacity="0.5" />
    <circle cx="210" cy="190" r="81" fill={`url(#${ids.metal})`} stroke={p.recess} strokeWidth="2" />
    <circle cx="210" cy="190" r="67" fill={`url(#${ids.optic})`} stroke={p.metalEdge} strokeWidth="5" />
    <g transform="translate(210 190)" style={{ filter: `brightness(${1 - brightness * 0.5}) contrast(${1 - contrast * 0.5}) saturate(${1 - saturation})` }}>
      {TICKS.map(angle => <path key={angle} transform={`rotate(${angle})`} d="M0-73v5" stroke={p.white} strokeOpacity="0.64" />)}
      <motion.g {...a.motionProps({ rotate: [-1.4 * a.motionGain, 1.4 * a.motionGain, -1.4 * a.motionGain] }, { rotate: 0 }, 12)}>
        <path d="M-42-28-8-50 33-36 49 5 23 42-21 45-49 11Z" fill={p.graphite} stroke={p.metalEdge} />
        <path d="M-8-50 7-10 33-36M49 5 7-10 23 42M-21 45 7-10-49 11M-42-28 7-10" fill="none" stroke={p.metal} strokeOpacity="0.6" />
      </motion.g>
      <circle r="28" fill={`url(#${ids.glass})`} stroke={p.metal} />
      <path d="M-17 0h10m14 0h10M0-17v10m0 14v10" stroke={p.white} strokeOpacity="0.66" />
      <circle r="3" fill={a.accent} opacity={a.signalOpacity} />
      <path data-entropy-artifact-child="grayscale" d="M-23 21h46" stroke={p.white} strokeWidth="2" opacity={grayscale * 0.65} />
      <circle data-entropy-artifact-child="blur" r="23" fill="none" stroke={p.white} strokeWidth="3" opacity={blur * 0.42} filter={`url(#${ids.glow})`} />
    </g>
    {FASTENERS.map(([x, y]) => <g key={`${x}-${y}`}><circle cx={x} cy={y} r="3.5" fill={p.metalEdge} /><path d={`M${x - 2} ${y}h4`} stroke={p.white} /></g>)}
    <rect x="118" y="314" width="184" height="21" rx="2" fill={p.graphite} stroke={p.metalEdge} />
    <path d="M131 321h103m-103 7h103" stroke={p.metal} strokeWidth="1" />
    <motion.path d="M264 323h20" stroke={a.accent} strokeWidth="3"
      {...a.motionProps({ opacity: [0.24, a.signalOpacity, 0.24] }, { opacity: a.signalOpacity }, 8)} />
    <path d="M110 356h16m168 0h16" stroke={p.orange} strokeWidth="2" opacity="0.8" />
  </>}</EntropyArtifactFrame>;
}
