import React from 'react';
import { motion } from 'framer-motion';
import SCPArtifactFrame from '../SCPArtifactFrame.jsx';
import { useSCPArtifactPresentation } from '../useSCPArtifactPresentation.js';

const IRIS_BLADES = [0, 45, 90, 135, 180, 225, 270, 315];
const BOLTS = [[100, 95], [320, 95], [100, 329], [320, 329]];

export default function SCPBlastAirlock({ artifactRenderContext = null, isEnabled = true }) {
  const a = useSCPArtifactPresentation({ artifactRenderContext, familyId: 'gate', isEnabled });
  const entryCheckpoint = a.childRatio('entryCheckpoint');
  const returnGuard = a.childRatio('returnGuard');
  return <SCPArtifactFrame presentation={a}>{({ ids, palette: p }) => <>
    <path d="M78 79 95 58h230l17 21v263l-20 26H98l-20-26Z" fill={`url(#${ids.metal})`} stroke={p.brushed} strokeWidth="3" />
    <path d="M94 83h232v257H94Z" fill={p.recess} stroke={p.steelEdge} strokeWidth="3" />
    <path d="M82 113h10v195H82Zm246 0h10v195h-10Z" fill={`url(#${ids.hazard})`} />
    <path d="M105 65h210v10H105Zm0 282h210v10H105Z" fill={`url(#${ids.edge})`} />
    <circle cx="210" cy="211" r="104" fill={`url(#${ids.metal})`} stroke={p.ivory} strokeOpacity="0.42" strokeWidth="3" />
    <circle cx="210" cy="211" r="90" fill={p.recess} stroke={p.brushed} strokeWidth="5" />
    <g transform="translate(210 211)">
      <motion.g {...a.motionProps({ rotate: [-1.2 * a.motionGain, 1.2 * a.motionGain, -1.2 * a.motionGain] }, { rotate: 0 }, 11)}>
        {IRIS_BLADES.map(angle => <g key={angle} transform={`rotate(${angle})`}>
          <path d="M0 0 34-80Q71-54 80-22L24 12Z" fill={`url(#${ids.metal})`} stroke={p.steelEdge} strokeWidth="1.5" />
          <path d="M9-4 38-64" stroke={p.ivory} strokeOpacity="0.25" />
        </g>)}
      </motion.g>
      <path d="M0-21 18-10v20L0 21-18 10v-20Z" fill={p.recess} stroke={p.amber} strokeWidth="2" />
      <path d="M-8 0H8M0-8V8" stroke={a.accent} strokeOpacity={a.signalOpacity} />
      <circle r="95" fill="none" stroke={a.accent} strokeOpacity={0.12 + a.visualWeight * 0.28} strokeWidth="1" strokeDasharray="2 16" />
    </g>
    {BOLTS.map(([x, y]) => <g key={`${x}-${y}`}><circle cx={x} cy={y} r="6" fill={p.recess} stroke={p.brushed} /><path d={`M${x - 3} ${y}h6`} stroke={p.paperEdge} /></g>)}
    <path d="M146 363v13h128v-13" fill={p.charcoal} stroke={p.steelEdge} />
    <g data-scp-artifact-child="entryCheckpoint" transform={`translate(0 ${entryCheckpoint * 6})`}>
      <path d="M180 87h60v12h-60Z" fill={`url(#${ids.edge})`} stroke={p.brushed} />
      <path d="M191 93h38" stroke={p.ivory} strokeWidth="2" opacity={0.14 + entryCheckpoint * 0.7} />
    </g>
    <g data-scp-artifact-child="returnGuard" transform={`translate(0 ${returnGuard * -6})`}>
      <path d="M180 310h60v12h-60Z" fill={`url(#${ids.edge})`} stroke={p.brushed} />
      <path d="M191 316h38" stroke={p.ivory} strokeWidth="2" opacity={0.14 + returnGuard * 0.7} />
    </g>
    <path d="M155 63v12m22-12v12m22-12v12m22-12v12m22-12v12m22-12v12" stroke={p.recess} strokeWidth="2" />
    <motion.path d="M183 335h54" stroke={p.amber} strokeWidth="3"
      {...a.motionProps({ opacity: [0.35, 0.85, 0.35] }, { opacity: 0.25 }, 4.6)} />
  </>}</SCPArtifactFrame>;
}
