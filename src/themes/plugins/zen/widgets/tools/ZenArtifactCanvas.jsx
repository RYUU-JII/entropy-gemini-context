import React from 'react';

import { requireZenAmbientPresentation } from '../../api/environment.js';
import ZenKaresansuiGround, {
  resolveZenKaresansuiPalette,
} from './ZenKaresansuiGround.jsx';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export default function ZenArtifactCanvas({
  ambientPresentation,
  runtime,
  artifactTheme = null,
  isArtifactActive = true,
  renderArtifact,
}) {
  const ambient = requireZenAmbientPresentation(ambientPresentation);
  const palette = resolveZenKaresansuiPalette(ambient);
  const sceneTint = artifactTheme?.scene?.tint || palette.edge;
  const sceneVignetteOpacity = clamp(artifactTheme?.scene?.vignetteOpacity, 0, 0.14);
  const lightX = clamp(ambient.lightPosition?.x, 0, 100);
  const lightY = clamp(ambient.lightPosition?.y, 0, 100);

  return (
    <>
      <div
        className="absolute inset-0 z-0"
        data-zen-artifact-atmosphere={ambient.phase}
        style={{
          background: [
            `radial-gradient(ellipse at ${lightX}% ${Math.max(0, lightY - 8)}%, ${palette.sheen} 0%, transparent 45%)`,
            `linear-gradient(180deg, ${palette.atmosphereTop} 0%, ${palette.atmosphereHorizon} 56%, ${palette.sandRear} 100%)`,
          ].join(', '),
          transition: 'background-color 1600ms ease, color 1600ms ease',
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 z-[1] pointer-events-none"
        data-zen-artifact-atmosphere-layer="plaster-depth"
        style={{
          backgroundImage: [
            'linear-gradient(101deg, transparent 0%, rgba(255,255,255,0.16) 42%, transparent 70%)',
            `radial-gradient(ellipse at 50% 48%, transparent 34%, ${palette.edge} 128%)`,
          ].join(', '),
          mixBlendMode: 'multiply',
          opacity: 0.16 + (ambient.lowSun * 0.05),
        }}
      />

      <div
        className="absolute inset-0 z-10 pointer-events-none"
        data-artifact-canvas-space="flat-2d"
        data-zen-artifact-light-source="canonical-solar-environment"
      >
        <div className="absolute inset-0">
          <ZenKaresansuiGround
            ambientPresentation={ambient}
            isActive={isArtifactActive}
            runtime={runtime}
          />

          <div
            aria-hidden="true"
            className="absolute inset-0 z-[1]"
            data-zen-artifact-scene-vignette="selected-artifact"
            style={{
              opacity: sceneVignetteOpacity,
              background: `radial-gradient(ellipse at 50% 52%, transparent 26%, ${sceneTint} 108%)`,
              mixBlendMode: 'multiply',
            }}
          />

          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-[42%] z-[2] h-[24%]"
            data-zen-artifact-atmosphere-layer="horizon-breath"
            style={{
              background: `linear-gradient(180deg, transparent 0%, ${palette.atmosphereHorizon} 52%, transparent 100%)`,
              opacity: 0.18,
            }}
          />

          {renderArtifact?.()}
        </div>
      </div>
    </>
  );
}
