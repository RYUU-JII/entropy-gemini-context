import React from 'react';
import { motion } from 'framer-motion';
import SCPArtifactFrame from '../SCPArtifactFrame.jsx';
import { useSCPArtifactPresentation } from '../useSCPArtifactPresentation.js';

const CONTACTS = [0, 1, 2, 3, 4, 5, 6, 7];
const SEAL_SCREWS = [[131, 114], [281, 114], [131, 248], [281, 248]];
const RETAINERS = [['historyCleanup', 158], ['bookmarkConceal', 206], ['tabEvaporation', 254]];

export default function SCPMemoryCartridge({ artifactRenderContext = null, isEnabled = true }) {
  const a = useSCPArtifactPresentation({ artifactRenderContext, familyId: 'echo', isEnabled });
  const retainers = RETAINERS.map(([childId, x]) => ({ childId, x, ratio: a.childRatio(childId) }));
  return <SCPArtifactFrame presentation={a}>{({ ids, palette: p }) => <>
    <path d="M79 306 112 282h196l33 24v52l-25 19H104l-25-19Z" fill={`url(#${ids.metal})`} stroke={p.brushed} strokeWidth="2" />
    <path d="M94 313h232v36H94Z" fill={p.recess} stroke={p.steelEdge} />
    <path d="M111 297h198v11H111Z" fill={`url(#${ids.hazard})`} />
    <path d="M111 306V102l20-29h145l20 29v204Z" fill={`url(#${ids.metal})`} stroke={p.brushed} strokeWidth="2" />
    <path d="M128 99h152v165H128Z" fill={`url(#${ids.paper})`} stroke={p.paperEdge} />
    <path d="M139 131h130v32H139Z" fill={p.ink} />
    <path d="M139 176h130m-130 10h92m-92 10h114m-114 10h81" stroke={p.ink} strokeOpacity="0.27" strokeWidth="2" />
    <path d="M155 225h102v22H155Z" fill={p.ink} />
    <path d="M146 82v8h22v-8m90 0v8h22v-8" fill="none" stroke={p.paperEdge} strokeWidth="2" />
    {SEAL_SCREWS.map(([x, y]) => <g key={`${x}-${y}`}><circle cx={x} cy={y} r="4" fill={p.steel} /><path d={`M${x - 2} ${y}h4`} stroke={p.ivory} /></g>)}
    <path d="M132 271h143v35H132Z" fill={p.recess} stroke={p.steelEdge} />
    {CONTACTS.map(i => <rect key={i} x={145 + i * 16} y="282" width="7" height="22" fill={p.amber} opacity="0.65" />)}
    <path d="M98 110h13v167H98Zm198 0h13v167h-13Z" fill={`url(#${ids.edge})`} />
    <path d="M88 322h23v19H88Zm221 0h23v19h-23Z" fill={p.steel} stroke={p.brushed} />
    {retainers.map(({ childId, x, ratio }) => <g key={childId} data-scp-artifact-child={childId} transform={`translate(0 ${ratio * -5})`}>
      <path d={`M${x - 12} 312h24v13h-24Z`} fill={`url(#${ids.edge})`} stroke={p.brushed} />
      <path d={`M${x - 6} 318h12`} stroke={p.ivory} strokeWidth="2" opacity={0.12 + ratio * 0.7} />
    </g>)}
    <motion.g {...a.motionProps({ opacity: [0.22, a.signalOpacity, 0.22] }, { opacity: 0.16 }, 8.4)}>
      <path d="M128 330h164" stroke={a.accent} strokeWidth="2" />
      <rect x="153" y="357" width="113" height="3" fill={a.accent} />
    </motion.g>
    <path d="M115 368h189" stroke={p.paperEdge} strokeOpacity="0.3" />
    <path d="M133 317v28m18-28v28m126-28v28m18-28v28" stroke={p.steelEdge} strokeWidth="2" />
    <path d="M177 64h55v9h-55Z" fill={p.charcoal} stroke={p.brushed} />
  </>}</SCPArtifactFrame>;
}
