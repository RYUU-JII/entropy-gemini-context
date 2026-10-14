import React, { useId } from 'react';

// The same measured polygons own visible planes and pond/petal occlusion.
// The depth strip is paint-only: exposed water remains interactive beneath it.
export default function ZenHomeGardenPlanes({ aperture }) {
  const id = useId();
  const shadowId = `${id}-contact`;
  const edgeFadeId = `${id}-edge-fade`;
  const edgeMaskId = `${id}-edge-mask`;
  const { top, bottom, shadowEnd } = aperture.rearEdge;
  return (
    <div className="zen-home-garden-occlusion" aria-hidden="true">
      <svg className="zen-home-garden-depth" width="100%" height="100%"
        viewBox={`0 0 ${aperture.surfaceSize.width} ${aperture.surfaceSize.height}`}
        preserveAspectRatio="none" focusable="false">
        <defs>
          <linearGradient id={shadowId} gradientUnits="userSpaceOnUse"
            x1={top.x} y1={top.y} x2={shadowEnd.x} y2={shadowEnd.y}>
            <stop offset="0" stopColor="#22372b" stopOpacity="0.28" />
            <stop offset="0.28" stopColor="#22372b" stopOpacity="0.12" />
            <stop offset="1" stopColor="#22372b" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={edgeFadeId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="white" stopOpacity="0" />
            <stop offset="0.25" stopColor="white" stopOpacity="0.08" />
            <stop offset="0.58" stopColor="white" stopOpacity="0.45" />
            <stop offset="1" stopColor="white" stopOpacity="0.9" />
          </linearGradient>
          <mask id={edgeMaskId} maskUnits="userSpaceOnUse" x="0" y="0"
            width={aperture.surfaceSize.width} height={aperture.surfaceSize.height}>
            <rect width="100%" height="100%" fill={`url(#${edgeFadeId})`} />
          </mask>
        </defs>
        <polygon points={aperture.rearPlanePoints} fill="var(--zen-ambient-garden-sky-top)" />
        <g mask={`url(#${edgeMaskId})`}>
          <polygon points={aperture.rearShadowPoints} fill={`url(#${shadowId})`} />
          <line x1={top.x} y1={top.y} x2={bottom.x} y2={bottom.y}
            stroke="var(--zen-home-plane-rim)" strokeWidth="1.2" />
        </g>
      </svg>
      <div style={{ clipPath: aperture.rearClipPath }} />
      <div style={{ clipPath: aperture.foregroundClipPath }} />
    </div>
  );
}
