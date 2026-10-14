import React from 'react';
import { motion } from 'framer-motion';
import SCPArtifactFrame from '../SCPArtifactFrame.jsx';
import { useSCPArtifactPresentation } from '../useSCPArtifactPresentation.js';

const LOCKS = [['intentThreshold', 121], ['textRhythm', 245], ['detourSpreadGuard', 307]];

export default function SCPContainmentCapsule({ artifactRenderContext = null, isEnabled = true }) {
  const a = useSCPArtifactPresentation({ artifactRenderContext, familyId: 'barrier', isEnabled });
  const locks = LOCKS.map(([childId, y]) => ({ childId, y, ratio: a.childRatio(childId) }));
  return <SCPArtifactFrame presentation={a}>{({ ids, palette: p }) => <>
    <path d="M110 337 146 318h128l36 19v31H110Z" fill={`url(#${ids.metal})`} stroke={p.brushed} strokeWidth="2" />
    <path d="M92 365h236v13H92Z" fill={p.charcoal} stroke={p.steelEdge} />
    <path d="M128 79 154 52h112l26 27v255l-25 20H153l-25-20Z" fill={`url(#${ids.metal})`} stroke={p.brushed} strokeWidth="2" />
    <path d="M143 85 161 66h98l18 19v245l-18 13h-98l-18-13Z" fill={p.recess} stroke={p.steelEdge} strokeWidth="2" />
    <path d="M158 99h104v213H158Z" fill={`url(#${ids.glass})`} stroke={p.paperEdge} strokeOpacity="0.4" />
    <path d="M166 111h9v190h-9Z" fill={p.ivory} opacity="0.14" />
    <path d="M187 136h46l9 147h-64Z" fill={`url(#${ids.metal})`} stroke={p.brushed} strokeWidth="2" />
    <path d="M191 146h38l4 62h-46Z" fill={p.charcoal} />
    <path d="M198 223h24v42h-24Z" fill={p.recess} stroke={p.steelEdge} />
    <motion.path d="M204 156v108" stroke={a.accent} strokeWidth="2"
      {...a.motionProps({ opacity: [0.2, a.signalOpacity, 0.2] }, { opacity: 0.18 }, 7.5)} />
    <path d="M175 284h70v17h-70Z" fill={`url(#${ids.edge})`} />
    <rect x="132" y="88" width="8" height="233" fill={`url(#${ids.hazard})`} />
    <rect x="280" y="88" width="8" height="233" fill={`url(#${ids.hazard})`} />
    {locks.map(({ childId, y, ratio }) => <g key={childId} data-scp-artifact-child={childId}>
      <path d={`M120 ${y - 9}h29v18h-29Zm151 0h29v18h-29Z`} fill={p.steel} stroke={p.brushed} />
      <path d={`M125 ${y}h18m134 0h18`} stroke={p.ivory} strokeOpacity="0.5" />
      <path d={`M${140 + ratio * 6} ${y - 5}v10M${280 - ratio * 6} ${y + 5}v-10`} stroke={p.ivory} strokeWidth="3" opacity={0.18 + ratio * 0.72} />
    </g>)}
    <path d="M146 67h128M146 337h128" stroke={p.ivory} strokeOpacity="0.45" />
    <motion.g {...a.motionProps({ opacity: [0.25, 0.72, 0.25] }, { opacity: 0.18 }, 6)}>
      <rect x="177" y="57" width="15" height="4" fill={a.accent} />
      <rect x="202" y="57" width="15" height="4" fill={a.accent} />
      <rect x="227" y="57" width="15" height="4" fill={a.accent} />
    </motion.g>
    <path d="M126 354h168" stroke={p.amber} strokeWidth="3" opacity="0.5" />
  </>}</SCPArtifactFrame>;
}
