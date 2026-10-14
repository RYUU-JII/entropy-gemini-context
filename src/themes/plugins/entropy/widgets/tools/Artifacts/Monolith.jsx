import React from 'react';
import { motion } from 'framer-motion';
import EntropyArtifactFrame from '../EntropyArtifactFrame.jsx';
import { useEntropyArtifactPresentation } from '../useEntropyArtifactPresentation.js';

const INTERLOCKS = [['intentThreshold', 125], ['textRhythm', 207], ['detourSpreadGuard', 248]];

export default function Monolith({ artifactRenderContext = null, isEnabled = true }) {
  const a = useEntropyArtifactPresentation({ artifactRenderContext, familyId: 'barrier', isEnabled });
  const interlocks = INTERLOCKS.map(([childId, y]) => ({ childId, y, ratio: a.childRatio(childId) }));
  return <EntropyArtifactFrame presentation={a}>{({ ids, palette: p }) => <>
    <path d="M123 371h174l23 15v14H100v-14Z" fill={`url(#${ids.hull})`} stroke={p.metalEdge} strokeWidth="2" />
    <path d="M105 393h210v7H105Z" fill={p.graphite} />
    <path d="M144 76h108v299H144Z" fill={`url(#${ids.monolith})`} stroke={p.graphite} strokeWidth="1" />
    <path d="M252 76l16-10v299l-16 10Z" fill={p.graphite} stroke={p.recess} />
    <path d="M144 76l16-10h108l-16 10Z" fill={p.graphite} stroke={p.metalEdge} strokeOpacity="0.42" />
    <path d="M145 78v296" stroke={p.white} strokeOpacity="0.075" />
    <path d="M140 375h132v8H140Z" fill={p.recess} />
    <path d="M284 103h23v186h-23Z" fill={`url(#${ids.metal})`} stroke={p.metalEdge} />
    {interlocks.map(({ childId, y, ratio }) => <g key={childId} data-entropy-artifact-child={childId}>
      <rect x="288" y={y - 10} width="15" height="22" rx="1" fill={p.graphite} />
      <path d={`M${288 - ratio * 6} ${y - 5}h7v12h-7Z`} fill={p.metal} stroke={p.metalEdge} />
      <path d={`M296 ${y - 4}v10`} stroke={a.accent} strokeWidth="2" opacity={0.12 + ratio * 0.72} />
    </g>)}
    <path d="M287 289v72h-10" fill="none" stroke={p.graphite} strokeWidth="5" />
    <rect x="115" y="382" width="23" height="6" rx="1" fill={p.graphite} />
    <motion.path d="M118 385h17" stroke={a.accent} strokeWidth="2"
      {...a.motionProps({ opacity: [0.2, a.signalOpacity, 0.2] }, { opacity: a.signalOpacity }, 12)} />
    <path d="M154 391h82" stroke={p.metalEdge} />
  </>}</EntropyArtifactFrame>;
}
