import React from 'react';
import { motion } from 'framer-motion';
import SCPArtifactFrame from '../SCPArtifactFrame.jsx';
import { useSCPArtifactPresentation } from '../useSCPArtifactPresentation.js';

const LOUVERS = [264, 276, 288, 300, 312];

export default function SCPWarningBeacon({ artifactRenderContext = null, isEnabled = true }) {
  const a = useSCPArtifactPresentation({ artifactRenderContext, familyId: 'flare', isEnabled });
  const sentinelFlare = a.childRatio('sentinelFlare');
  return <SCPArtifactFrame presentation={a}>{({ ids, palette: p }) => <>
    <path d="M125 350 159 329h102l34 21v25H125Z" fill={`url(#${ids.metal})`} stroke={p.brushed} strokeWidth="2" />
    <path d="M133 353h154v9H133Z" fill={`url(#${ids.hazard})`} />
    <path d="M178 214h64v134h-64Z" fill={`url(#${ids.metal})`} stroke={p.steelEdge} strokeWidth="2" />
    <path d="M189 231h42v94h-42Z" fill={p.charcoal} stroke={p.brushed} />
    {LOUVERS.map(y => <path key={y} d={`M192 ${y}h36`} stroke={p.recess} strokeWidth="4" />)}
    <path d="M159 206h102v30H159Z" fill={`url(#${ids.edge})`} stroke={p.steelEdge} />
    <path d="M142 119q0-69 68-69t68 69v91H142Z" fill={`url(#${ids.glass})`} stroke={p.paperEdge} strokeWidth="2" />
    <path d="M153 119q0-56 57-56" fill="none" stroke={p.ivory} strokeWidth="3" strokeOpacity="0.32" />
    <path d="M163 111h94v79h-94Z" fill={p.recess} stroke={p.steelEdge} />
    <g data-scp-artifact-child="sentinelFlare" opacity={0.22 + sentinelFlare * 0.78}>
    <motion.g {...a.motionProps({ opacity: [0.18, a.signalOpacity, 0.18] }, { opacity: 0.18 + sentinelFlare * 0.24 }, 3.8)}>
      <path d="M172 124h76v51h-76Z" fill={p.amber} opacity="0.8" />
      <path d="M177 129h66v41h-66Z" fill={a.accent} opacity="0.85" />
      <path d="M181 132h58v35h-58Z" fill={a.accent} filter={`url(#${ids.glow})`} />
    </motion.g>
    </g>
    <path d="M177 118v64m16-64v64m17-64v64m17-64v64m16-64v64" stroke={p.ivory} strokeOpacity="0.22" />
    <path d="M153 202h114v12H153Z" fill={`url(#${ids.metal})`} stroke={p.brushed} />
    <path d="M134 217h24m104 0h24" stroke={p.brushed} strokeWidth="6" />
    <motion.g {...a.motionProps({ opacity: [0.04, 0.22 * a.motionGain, 0.04] }, { opacity: 0 }, 3.8)}>
      <path d="M121 123 89 109m27 40H80m41 26-32 14m210-66 32-14m-27 40h36m-41 26 32 14" stroke={p.amber} strokeWidth="2" />
    </motion.g>
    <path d="M151 372v9m118-9v9" stroke={p.steelEdge} strokeWidth="5" />
  </>}</SCPArtifactFrame>;
}
