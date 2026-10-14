import React from 'react';
import { motion } from 'framer-motion';
import SCPArtifactFrame from '../SCPArtifactFrame.jsx';
import { useSCPArtifactPresentation } from '../useSCPArtifactPresentation.js';

const DOCUMENT_LINES = [126, 151, 176, 201, 226, 251, 276];

export default function SCPRedactedDossier({ artifactRenderContext = null, isEnabled = true }) {
  const a = useSCPArtifactPresentation({ artifactRenderContext, familyId: 'veil', isEnabled });
  const social = a.childRatio('socialMetrics');
  const time = a.childRatio('timeSignals');
  const intent = a.childRatio('shortformBlock');
  return <SCPArtifactFrame presentation={a}>{({ ids, palette: p }) => <>
    <path d="M91 59h202l36 33v257l-14 16H92l-16-15V76Z" fill={p.recess} stroke={p.steelEdge} strokeWidth="2" />
    <path d="M92 56h209v289H92Z" fill={`url(#${ids.paper})`} stroke={p.paperEdge} strokeWidth="2" />
    <path d="M301 56v26h24" fill={p.paperEdge} />
    <path d="M302 83v260H95" fill="none" stroke={p.ink} strokeOpacity="0.22" strokeWidth="3" />
    <rect x="116" y="80" width="162" height="25" fill={p.ink} />
    <path d="M118 114h158M118 318h158" stroke={p.ink} strokeOpacity="0.4" />
    {DOCUMENT_LINES.map((y, i) => <g key={y}>
      <path d={`M118 ${y}h${i % 3 === 0 ? 139 : 157}`} stroke={p.ink} strokeOpacity="0.25" strokeWidth="2" />
      <rect x={i % 2 ? 126 : 116} y={y - 7} width={i % 3 === 0 ? 129 : 145} height="12" fill={p.ink}
        opacity={0.16 + (i < 3 ? social : time) * 0.84} />
    </g>)}
    <path d="M69 313h270v22l-16 22H86l-17-22Z" fill={`url(#${ids.metal})`} stroke={p.brushed} strokeWidth="2" />
    <rect x="81" y="318" width="246" height="9" fill={`url(#${ids.hazard})`} />
    <path d="M178 47h65v40h-12V61h-41v26h-12Z" fill={`url(#${ids.edge})`} stroke={p.steelEdge} />
    <motion.g {...a.motionProps({ y: [0, 3 * a.motionGain, 0] }, { y: 0 }, 8)}>
      <rect x="277" y="96" width="34" height="196" fill={`url(#${ids.metal})`} stroke={p.brushed} />
      <path d="M285 108h18m-18 172h18" stroke={p.paperEdge} />
      <rect x="288" y="123" width="13" height="144" fill={p.recess} />
      <motion.rect x="290" y="132" width="9" height="26" fill={a.accent}
        {...a.motionProps({ y: [0, 96 * a.motionGain, 0], opacity: [0.3, a.signalOpacity, 0.3] }, { y: 0, opacity: 0.18 }, 10)} />
    </motion.g>
    <path data-scp-artifact-child="socialMetrics" d="M112 144h162" stroke={a.accent} strokeWidth="1.5" opacity={social * 0.7} />
    <path data-scp-artifact-child="timeSignals" d="M112 218h162" stroke={a.accent} strokeWidth="1.5" opacity={time * 0.7} />
    <path data-scp-artifact-child="shortformBlock" d="M84 347h236" stroke={p.amber} strokeWidth="3"
      opacity={0.18 + intent * 0.72} transform={`translate(0 ${intent * -4})`} />
    <path d="M113 359v13m24-13v13m151-13v13m24-13v13" stroke={p.steelEdge} strokeWidth="3" />
  </>}</SCPArtifactFrame>;
}
