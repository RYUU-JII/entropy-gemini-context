import React from 'react';
import { motion } from 'framer-motion';
import EntropyArtifactFrame from '../EntropyArtifactFrame.jsx';
import { useEntropyArtifactPresentation } from '../useEntropyArtifactPresentation.js';

const CASSETTES = [['socialMetrics', 113], ['timeSignals', 185], ['shortformBlock', 257]];

export default function ScrimEngine({ artifactRenderContext = null, isEnabled = true }) {
  const a = useEntropyArtifactPresentation({ artifactRenderContext, familyId: 'veil', isEnabled });
  const cassettes = CASSETTES.map(([childId, x]) => ({ childId, x, ratio: a.childRatio(childId) }));
  return <EntropyArtifactFrame presentation={a}>{({ ids, palette: p }) => <>
    <path d="M89 338h242l14 26v35H75v-35Z" fill={`url(#${ids.hull})`} stroke={p.metalEdge} strokeWidth="2" />
    <path d="M84 384h252v15H84Z" fill={p.graphite} />
    <path d="M91 102h238v227H91Z" fill={`url(#${ids.hull})`} stroke={p.metalEdge} strokeWidth="2" />
    <path d="M83 118h13v194H83Zm241 0h13v194h-13Z" fill={`url(#${ids.edge})`} />
    <rect x="104" y="121" width="212" height="185" rx="2" fill={p.graphite} stroke={p.recess} strokeWidth="3" />
    <rect x="114" y="132" width="192" height="164" fill={`url(#${ids.glass})`} />
    {cassettes.map(({ childId, x, ratio }) => <g key={childId} data-entropy-artifact-child={childId}>
      <rect x={x} y="146" width="50" height="132" fill={`url(#${ids.mesh})`} stroke={p.metalEdge} />
      <rect x={x - 3} y="133" width="56" height="17" rx="2" fill={`url(#${ids.metal})`} stroke={p.recess} />
      <g transform={`translate(0 ${ratio * 18})`}>
        <path d={`M${x + 2} 154h46v94h-46Z`} fill={p.recess} opacity={0.42 + ratio * 0.52} />
        <path d={`M${x + 8} 161h34m-34 7h34`} stroke={p.metal} strokeOpacity="0.42" />
      </g>
      <path d={`M${x + 18} 141h14`} stroke={a.accent} strokeWidth="2" opacity={0.12 + ratio * 0.72} />
      <path d={`M${x + 24} 280v9`} stroke={p.orange} strokeWidth="2" />
    </g>)}
    <path d="M104 121h212M110 304h200" stroke={p.white} strokeOpacity="0.62" />
    <rect x="103" y="318" width="214" height="7" fill={`url(#${ids.metal})`} />
    <path d="M107 112h12m182 0h12M107 316h12m182 0h12" stroke={p.graphite} strokeWidth="2" />
    <rect x="119" y="350" width="182" height="23" rx="2" fill={p.graphite} />
    <path d="M132 357h90m-90 8h90" stroke={p.metal} />
    <motion.path d="M256 361h27" stroke={a.accent} strokeWidth="3"
      {...a.motionProps({ opacity: [0.2, a.signalOpacity, 0.2] }, { opacity: a.signalOpacity }, 9)} />
    <path d="M111 90h198v12H111Z" fill={`url(#${ids.edge})`} stroke={p.metalEdge} />
    <path d="M122 92v8m14-8v8m14-8v8m14-8v8m14-8v8m14-8v8m14-8v8m14-8v8m14-8v8m14-8v8m14-8v8m14-8v8m14-8v8" stroke={p.metal} />
  </>}</EntropyArtifactFrame>;
}
