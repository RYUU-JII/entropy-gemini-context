import React from 'react';
import { motion } from 'framer-motion';
import SCPArtifactFrame from '../SCPArtifactFrame.jsx';
import { useSCPArtifactPresentation } from '../useSCPArtifactPresentation.js';

const TEETH = [0, 1, 2, 3, 4];

export default function SCPRestraintClamp({ artifactRenderContext = null, isEnabled = true }) {
  const a = useSCPArtifactPresentation({ artifactRenderContext, familyId: 'brake', isEnabled });
  const clickPause = a.childRatio('clickPause');
  const scrollFriction = a.childRatio('scrollFriction');
  const inputVisualBrake = a.childRatio('inputVisualBrake');
  const skipFriction = a.childRatio('skipFriction');
  return <SCPArtifactFrame presentation={a}>{({ ids, palette: p }) => <>
    <path d="M72 318 104 299h212l32 19v38l-28 17H100l-28-17Z" fill={`url(#${ids.metal})`} stroke={p.brushed} strokeWidth="2" />
    <path d="M89 335h242M104 357h211" stroke={p.ivory} strokeOpacity="0.22" />
    <path d="M168 286h84v39h-84Z" fill={p.recess} stroke={p.steelEdge} />
    <rect x="197" y="78" width="26" height="245" fill={`url(#${ids.edge})`} stroke={p.brushed} />
    <path d="M197 81h26m-26 22h26m-26 22h26m-26 22h26m-26 22h26m-26 22h26m-26 22h26m-26 22h26m-26 22h26m-26 22h26" stroke={p.recess} strokeWidth="5" />
    <rect x="158" y="198" width="104" height="65" rx="2" fill={`url(#${ids.metal})`} stroke={p.brushed} strokeWidth="2" />
    <rect x="183" y="214" width="54" height="34" fill={p.recess} stroke={p.steelEdge} />
    <g data-scp-artifact-child="inputVisualBrake" transform={`translate(0 ${inputVisualBrake * -5})`}>
      <path d="M195 231h30" stroke={p.ivory} strokeWidth="3" opacity={0.14 + inputVisualBrake * 0.72} />
    </g>
    <g data-scp-artifact-child="clickPause" transform={`translate(${clickPause * 8} 0)`}>
    <motion.g {...a.motionProps({ x: [0, 2 * a.motionGain, 0] }, { x: 0 }, 4.8)}>
      <path d="M71 116h76l26 33v139h-39V178H92Z" fill={`url(#${ids.metal})`} stroke={p.brushed} strokeWidth="2" />
      <path d="M92 129h47l21 30v112h-14V170l-15-23H99Z" fill={p.charcoal} stroke={p.steelEdge} />
      {TEETH.map(i => <rect key={i} x="163" y={163 + i * 23} width="20" height="10" fill={p.ivory} stroke={p.paperEdge} />)}
    </motion.g>
    </g>
    <g transform={`translate(${clickPause * -8} 0)`}>
    <motion.g {...a.motionProps({ x: [0, -2 * a.motionGain, 0] }, { x: 0 }, 4.8)}>
      <path d="M349 116h-76l-26 33v139h39V178h42Z" fill={`url(#${ids.metal})`} stroke={p.brushed} strokeWidth="2" />
      <path d="M328 129h-47l-21 30v112h14V170l15-23h32Z" fill={p.charcoal} stroke={p.steelEdge} />
      {TEETH.map(i => <rect key={i} x="237" y={163 + i * 23} width="20" height="10" fill={p.ivory} stroke={p.paperEdge} />)}
    </motion.g>
    </g>
    <g data-scp-artifact-child="scrollFriction" transform={`translate(0 ${scrollFriction * -9})`}>
      <path d="M188 274h44v13h-44Z" fill={`url(#${ids.edge})`} stroke={p.brushed} />
      <path d="M194 276v8m8-8v8m8-8v8m8-8v8m8-8v8" stroke={p.ivory} opacity={0.12 + scrollFriction * 0.6} />
    </g>
    <path data-scp-artifact-child="skipFriction" d="M103 109V88h69m145 21V88h-69" fill="none" stroke={p.amber} strokeWidth={2 + skipFriction} opacity={0.25 + skipFriction * 0.75} />
    <rect x="123" y="305" width="174" height="9" fill={`url(#${ids.hazard})`} />
    <circle cx="94" cy="332" r="4" fill={p.recess} stroke={p.brushed} />
    <circle cx="326" cy="332" r="4" fill={p.recess} stroke={p.brushed} />
  </>}</SCPArtifactFrame>;
}
