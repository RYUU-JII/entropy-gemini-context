import React from 'react';
import { motion } from 'framer-motion';
import EntropyArtifactFrame from '../EntropyArtifactFrame.jsx';
import { useEntropyArtifactPresentation } from '../useEntropyArtifactPresentation.js';

const CARTRIDGES = [['historyCleanup', 103], ['bookmarkConceal', 175], ['tabEvaporation', 247]];

export default function Lethe({ artifactRenderContext = null, isEnabled = true }) {
  const a = useEntropyArtifactPresentation({ artifactRenderContext, familyId: 'echo', isEnabled });
  const cartridges = CARTRIDGES.map(([childId, x]) => ({ childId, x, ratio: a.childRatio(childId) }));
  return <EntropyArtifactFrame presentation={a}>{({ ids, palette: p }) => <>
    <path d="M80 147h246l24 22v217l-24 14H80l-14-14V165Z" fill={`url(#${ids.hull})`} stroke={p.metalEdge} strokeWidth="2" />
    <path d="M326 147l24 22v217l-24 14Z" fill={`url(#${ids.edge})`} />
    <path d="M80 147l20-18h223l3 18Z" fill={`url(#${ids.hull})`} stroke={p.metalEdge} />
    <rect x="87" y="173" width="230" height="171" rx="2" fill={p.graphite} stroke={p.recess} strokeWidth="3" />
    {cartridges.map(({ childId, x, ratio }) => <g key={childId} data-entropy-artifact-child={childId}>
      <rect x={x} y="187" width="53" height="144" rx="2" fill={`url(#${ids.metal})`} stroke={p.recess} strokeWidth="2" />
      <rect x={x + 6} y="199" width="41" height="111" rx="1" fill={p.graphite} />
      <path d={`M${x + 14} 210v54m8-54v54m8-54v54`} stroke={p.metalEdge} strokeWidth="2" />
      <rect x={x + 15} y="282" width="24" height="10" rx="1" fill={p.plastic} opacity="0.76" />
      <path d={`M${x + 20} 285v4m5-4v4m5-4v4`} stroke={p.graphite} />
      <g transform={`translate(0 ${ratio * -5})`}>
        <path d={`M${x + 9} 315v-11h35v11h-7v-4h-21v4Z`} fill={p.red} stroke={p.graphite} />
        <path d={`M${x + 19} 321h15`} stroke={a.accent} strokeWidth="2" opacity={0.12 + ratio * 0.7} />
      </g>
    </g>)}
    <path d="M92 170h220M87 344h230" stroke={p.white} strokeOpacity="0.64" />
    <rect x="89" y="354" width="226" height="29" rx="2" fill={p.graphite} />
    <path d="M105 361h108m-108 7h108m-108 7h108" stroke={p.metalEdge} strokeWidth="2" />
    <motion.path d="M272 368h24" stroke={a.accent} strokeWidth="3"
      {...a.motionProps({ opacity: [0.18, a.signalOpacity, 0.18] }, { opacity: a.signalOpacity }, 10.5)} />
    <path d="M110 143h52v-22h-11v12h-30v-12h-11m136 22h52v-22h-11v12h-30v-12h-11" fill={`url(#${ids.metal})`} stroke={p.metalEdge} />
    <path d="M78 386h243v14H78Z" fill={p.graphite} />
    <path d="M74 180v145m268-145v145" stroke={p.white} strokeOpacity="0.32" />
    <path d="M94 156h13m193 0h13" stroke={p.orange} strokeWidth="2" opacity="0.82" />
  </>}</EntropyArtifactFrame>;
}
