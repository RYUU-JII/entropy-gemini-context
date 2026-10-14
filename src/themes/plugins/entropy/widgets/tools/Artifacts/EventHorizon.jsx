import React from 'react';
import { motion } from 'framer-motion';
import EntropyArtifactFrame from '../EntropyArtifactFrame.jsx';
import { useEntropyArtifactPresentation } from '../useEntropyArtifactPresentation.js';

const FASTENERS = [0, 45, 90, 135, 180, 225, 270, 315];
const SECTORS = [0, 60, 120, 180, 240, 300];

export default function EventHorizon({ artifactRenderContext = null, isEnabled = true }) {
  const a = useEntropyArtifactPresentation({ artifactRenderContext, familyId: 'gate', isEnabled });
  const entryCheckpoint = a.childRatio('entryCheckpoint');
  const returnGuard = a.childRatio('returnGuard');
  return <EntropyArtifactFrame presentation={a}>{({ ids, palette: p }) => <>
    <path d="M113 348h194l24 32v20H89v-20Z" fill={`url(#${ids.hull})`} stroke={p.metalEdge} strokeWidth="2" />
    <path d="M106 390h208v10H106Z" fill={p.graphite} />
    <circle cx="210" cy="212" r="133" fill={`url(#${ids.hull})`} stroke={p.metalEdge} strokeWidth="3" />
    <circle cx="210" cy="212" r="115" fill={`url(#${ids.metal})`} stroke={p.graphite} strokeWidth="2" />
    <circle cx="210" cy="212" r="100" fill={p.graphite} stroke={p.recess} strokeWidth="3" />
    <g transform="translate(210 212)">
      <circle r="92" fill={`url(#${ids.edge})`} stroke={p.metalEdge} strokeWidth="3" />
      {SECTORS.map(angle => <g key={angle} transform={`rotate(${angle})`}>
        <path d="M0 0 0-91Q52-92 79-46L18 10Z" fill={`url(#${ids.metal})`} stroke={p.graphite} strokeWidth="1.5" />
        <path d="M7-25 7-81" stroke={p.white} strokeOpacity="0.34" />
      </g>)}
      <circle r="25" fill={p.graphite} stroke={p.metal} strokeWidth="4" />
      <motion.g {...a.motionProps({ rotate: [-1.5 * a.motionGain, 1.5 * a.motionGain, -1.5 * a.motionGain] }, { rotate: 0 }, 11)}>
        <path d="M-17 0h34M0-17v34" stroke={p.metal} strokeWidth="4" />
        <circle r="7" fill={p.recess} stroke={p.metalEdge} />
      </motion.g>
      {FASTENERS.map(angle => <g key={angle} transform={`rotate(${angle})`}>
        <circle cy="-123" r="4" fill={p.graphite} /><path d="M-2-123h4" stroke={p.metal} />
      </g>)}
    </g>
    <g data-entropy-artifact-child="entryCheckpoint" transform={`translate(${entryCheckpoint * 8} 0)`}>
      <rect x="95" y="199" width="37" height="26" rx="2" fill={`url(#${ids.hull})`} stroke={p.graphite} />
      <path d="M104 205h20m-20 14h20" stroke={a.accent} strokeWidth="2" opacity={0.12 + entryCheckpoint * 0.7} />
    </g>
    <g data-entropy-artifact-child="returnGuard" transform={`translate(${returnGuard * -8} 0)`}>
      <rect x="288" y="199" width="37" height="26" rx="2" fill={`url(#${ids.hull})`} stroke={p.graphite} />
      <path d="M297 205h20m-20 14h20" stroke={a.accent} strokeWidth="2" opacity={0.12 + returnGuard * 0.7} />
    </g>
    <rect x="180" y="359" width="60" height="20" rx="2" fill={p.graphite} />
    <motion.path d="M197 369h26" stroke={a.accent} strokeWidth="3"
      {...a.motionProps({ opacity: [0.2, a.signalOpacity, 0.2] }, { opacity: a.signalOpacity }, 8)} />
    <path d="M119 374h27m128 0h27" stroke={p.orange} strokeWidth="2" opacity="0.8" />
  </>}</EntropyArtifactFrame>;
}
