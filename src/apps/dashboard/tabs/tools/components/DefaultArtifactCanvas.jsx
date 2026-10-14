import React from 'react';

import PedestalRing from './PedestalRing.jsx';

export default function DefaultArtifactCanvas({
  runtime,
  themeId,
  artifactTheme,
  groundPolicy,
  ringState,
  isArtifactActive = true,
  renderArtifact,
}) {
  void runtime;

  return (
    <>
      <div
        className="absolute inset-0 z-0"
        style={{ background: 'radial-gradient(circle at center, var(--color-surface) 0%, var(--color-surface-sunken) 100%)' }}
      />

      <div
        className="absolute inset-0 z-10 pointer-events-none"
        data-artifact-canvas-space="flat-2d"
      >
        <div className="absolute inset-0">
          {groundPolicy?.enabled !== false ? (
            <PedestalRing
              color={artifactTheme.artifact.color}
              glowColor={artifactTheme.artifact.glow}
              mode={artifactTheme.artifact.mode}
              isVisible={!!ringState?.isVisible}
              pulseKey={ringState?.pulseToken || 0}
              themeId={themeId}
              policy={groundPolicy}
              isVolatile={false}
              isActive={isArtifactActive}
            />
          ) : null}

          {renderArtifact?.()}
        </div>
      </div>
    </>
  );
}
