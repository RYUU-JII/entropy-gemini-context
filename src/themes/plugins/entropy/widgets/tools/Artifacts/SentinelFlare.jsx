import React from 'react';
import { motion } from 'framer-motion';
import EntropyArtifactFrame from '../EntropyArtifactFrame.jsx';
import { useEntropyArtifactPresentation } from '../useEntropyArtifactPresentation.js';

const VENTS = [0, 1, 2, 3, 4];

export default function SentinelFlare({ artifactRenderContext = null, isEnabled = true }) {
  const a = useEntropyArtifactPresentation({ artifactRenderContext, familyId: 'flare', isEnabled });
  const sentinelFlare = a.childRatio('sentinelFlare');
  return <EntropyArtifactFrame presentation={a}>{({ ids, palette: p }) => <>
    <path d="M111 367h198l19 20v13H92v-13Z" fill={`url(#${ids.hull})`} stroke={p.metalEdge} strokeWidth="2" />
    <path d="M105 394h210v6H105Z" fill={p.graphite} />
    <path d="M133 81h143l17 18v261l-17 17H133Z" fill={`url(#${ids.hull})`} stroke={p.metalEdge} strokeWidth="2" />
    <path d="M276 81l17 18v261l-17 17Z" fill={`url(#${ids.edge})`} />
    <path d="M143 99h123v213H143Z" fill={p.graphite} stroke={p.recess} strokeWidth="2" />
    <circle cx="204" cy="179" r="53" fill={`url(#${ids.metal})`} stroke={p.recess} strokeWidth="3" />
    <circle cx="204" cy="179" r="44" fill={p.recess} stroke={p.graphite} strokeWidth="4" />
    <circle cx="204" cy="179" r="36" fill={p.red} opacity="0.72" />
    <circle cx="204" cy="179" r="32" fill={`url(#${ids.optic})`} opacity="0.62" />
    <g data-entropy-artifact-child="sentinelFlare" opacity={0.22 + sentinelFlare * 0.78}>
      <motion.g {...a.motionProps({ opacity: [0.28, a.signalOpacity, 0.28] }, { opacity: a.signalOpacity }, 6.8)}>
        <circle cx="204" cy="179" r="26" fill={p.red} />
        <circle cx="204" cy="179" r="18" fill={a.accent} opacity="0.68" filter={`url(#${ids.glow})`} />
        <circle cx="204" cy="179" r="9" fill={p.red} />
      </motion.g>
    </g>
    <path d="M183 159q8-11 23-10" fill="none" stroke={p.white} strokeWidth="3" strokeOpacity="0.46" strokeLinecap="round" />
    <circle cx="204" cy="179" r="39" fill="none" stroke={p.white} strokeOpacity="0.16" />
    <rect x="154" y="258" width="101" height="34" rx="1" fill={p.recess} stroke={p.metalEdge} />
    {VENTS.map(i => <path key={i} d={`M163 ${265 + i * 5}h82`} stroke={p.metalEdge} strokeWidth="2" />)}
    <path d="M147 320h115" stroke={p.metalEdge} />
    <rect x="174" y="337" width="63" height="15" rx="2" fill={`url(#${ids.metal})`} stroke={p.graphite} />
    <path d="M183 345h45" stroke={p.recess} strokeWidth="2" />
    <circle cx="148" cy="112" r="2" fill={p.metal} /><circle cx="261" cy="112" r="2" fill={p.metal} />
    <path d="M149 370h20m76 0h20" stroke={p.orange} strokeWidth="2" opacity="0.78" />
  </>}</EntropyArtifactFrame>;
}
