import React from 'react';

import ArtifactRenderer from '../../dashboard/tabs/tools/components/ArtifactRenderer.jsx';
import {
  buildArtifactActivityState,
  buildArtifactPresentationState,
} from '../../../themes/core/tools/artifactPresentation.js';
import { getArtifactColorTokens } from '../../../themes/core/tools/artifactColorSystem.js';
import { preloadThemeWidgetChunk } from '../../../themes/core/registry/index.js';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import '../../dashboard/tailwind.css';
import './zenTomeIshiScene.css';

const TOMEISHI_ACTIVITY = buildArtifactActivityState({
  artifactId: 'brake',
  runtimeState: 'engaged',
  isRuntimeActive: true,
  configuredActive: true,
});

const TOMEISHI_PRESENTATION = buildArtifactPresentationState({
  artifactId: 'brake',
  visualKey: 'brake',
  artifactActivity: TOMEISHI_ACTIVITY,
});

const TOMEISHI_COLORS = getArtifactColorTokens('zen', 'brake').artifact;

async function prepareZenTomeIshiScene() {
  await preloadThemeWidgetChunk('zen', 'Artifact_Brake');
}

function ZenTomeIshiScene({ signalReady }) {
  React.useEffect(() => {
    signalReady?.();
  }, [signalReady]);

  return (
    <main className="visual-tomeishi-page">
      <section
        className="visual-tomeishi-scene"
        data-visual-capture="tomeishi-scene"
        aria-label="Zen TomeIshi visual scene"
      >
        <div className="visual-tomeishi-scene__wash" aria-hidden="true" />
        <div
          className="visual-tomeishi-scene__artifact"
          data-visual-capture="tomeishi-artifact"
        >
          <ArtifactRenderer
            artifactActivity={TOMEISHI_ACTIVITY}
            artifactPresentation={TOMEISHI_PRESENTATION}
            color={TOMEISHI_COLORS.color}
            forcePreviewActive
            isActive
            mode="stable"
            onReady={signalReady}
            systemMode="zen"
            visualActivityWeight={1}
            visualKey="brake"
          />
        </div>
      </section>
    </main>
  );
}

export default defineVisualSceneImplementation({
  Component: ZenTomeIshiScene,
  prepare: prepareZenTomeIshiScene,
});
