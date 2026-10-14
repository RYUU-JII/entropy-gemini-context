import React from 'react';
import { motion } from 'framer-motion';
import EntropyArtifactFrame from '../EntropyArtifactFrame.jsx';
import { useEntropyArtifactPresentation } from '../useEntropyArtifactPresentation.js';

const COLLARS = [124, 141, 158, 175];

export default function InertialDamper({ artifactRenderContext = null, isEnabled = true }) {
  const a = useEntropyArtifactPresentation({ artifactRenderContext, familyId: 'brake', isEnabled });
  const clickPause = a.childRatio('clickPause');
  const scrollFriction = a.childRatio('scrollFriction');
  const inputVisualBrake = a.childRatio('inputVisualBrake');
  const pistonRest = scrollFriction * 7;
  const skipFriction = a.childRatio('skipFriction');
  const needleRest = Math.max(clickPause, skipFriction) * 21;
  return <EntropyArtifactFrame presentation={a}>{({ ids, palette: p }) => <>
    <path d="M103 362h214l20 19v18H83v-18Z" fill={`url(#${ids.hull})`} stroke={p.metalEdge} strokeWidth="2" />
    <path d="M98 391h224v8H98Z" fill={p.graphite} />
    <path d="M135 336h150v34H135Z" fill={`url(#${ids.edge})`} stroke={p.graphite} />
    <rect x="142" y="86" width="136" height="262" rx="8" fill={`url(#${ids.hull})`} stroke={p.metalEdge} strokeWidth="2" />
    <rect x="151" y="99" width="118" height="235" rx="4" fill={p.graphite} />
    <rect x="170" y="122" width="80" height="195" rx="3" fill={`url(#${ids.glass})`} stroke={p.metalEdge} />
    <path d="M176 207h68v102h-68Z" fill={p.amber} opacity="0.12" />
    <path d="M180 134v168m5-168v168" stroke={p.white} strokeOpacity="0.32" />
    <rect x="205" y="56" width="14" height="121" fill={`url(#${ids.metal})`} stroke={p.metalEdge} />
    <path d="M181 51h62v12h-62Z" fill={`url(#${ids.hull})`} stroke={p.metalEdge} />
    {COLLARS.map(y => <path key={y} d={`M197 ${y}h30v8h-30Z`} fill={`url(#${ids.metal})`} stroke={p.graphite} />)}
    <g data-entropy-artifact-child="scrollFriction" transform={`translate(0 ${pistonRest})`}>
      <motion.g {...a.motionProps({ y: [0, 3 * a.motionGain, 0] }, { y: 0 }, 8.5)}>
        <rect x="188" y="192" width="44" height="17" rx="2" fill={`url(#${ids.metal})`} stroke={p.white} strokeOpacity="0.5" />
        <path d="M190 198h40m-40 5h40" stroke={p.graphite} />
      </motion.g>
    </g>
    <path d="M129 127h-22v164q0 34 30 34h7m131-12h29V132q0-25-28-25" fill="none" stroke={p.graphite} strokeWidth="13" />
    <path d="M129 127h-22v164q0 34 30 34h7m131-12h29V132q0-25-28-25" fill="none" stroke={p.metal} strokeWidth="6" />
    <circle cx="110" cy="245" r="25" fill={`url(#${ids.hull})`} stroke={p.metalEdge} strokeWidth="2" />
    <circle cx="110" cy="245" r="18" fill={p.graphite} stroke={p.metal} />
    <path d="M98 237l3 2m7-7v4m9 1-3 2m6 7h-4" stroke={p.white} strokeOpacity="0.55" />
    <g data-entropy-artifact-child="clickPause" transform={`rotate(${needleRest} 110 245)`}>
      <motion.path d="M110 245l9-10" stroke={a.accent} strokeWidth="2"
        style={{ transformOrigin: '110px 245px' }}
        {...a.motionProps({ rotate: [-2 * a.motionGain, 2 * a.motionGain, -2 * a.motionGain] }, { rotate: 0 }, 8.5)} />
    </g>
    <circle cx="110" cy="245" r="3" fill={p.metal} />
    <g data-entropy-artifact-child="inputVisualBrake" opacity={0.18 + inputVisualBrake * 0.72}>
      <path d="M155 318h12m87 0h12" stroke={a.accent} strokeWidth="3" />
    </g>
    <path d="M173 353h75" stroke={p.recess} strokeWidth="3" />
    <path d="M119 378h28m124 0h28" stroke={p.orange} strokeWidth="2" opacity="0.8" />
  </>}</EntropyArtifactFrame>;
}
