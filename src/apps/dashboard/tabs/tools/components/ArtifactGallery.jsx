import React, { useMemo } from 'react';

import ArtifactGalleryView from './ArtifactGalleryView.jsx';
import { buildArtifactGallerySelection } from './artifactGallerySelection.js';
import { resolveArtifactGallerySceneRuntime } from './sceneRuntime.js';
import { useArtifactGalleryController } from './useArtifactGalleryController.js';
import { CoolingCurveSettingsActivityProvider } from './CoolingCurveSettingsActivityContext.jsx';

function ArtifactGallery({ isEnabled = true, ...props }) {
  const controller = useArtifactGalleryController({ ...props, isEnabled });
  const sceneRuntime = useMemo(
    () => resolveArtifactGallerySceneRuntime(controller.sceneRuntimeInput),
    [controller.sceneRuntimeInput],
  );
  const rendererPropsBase = controller.selectionBase?.rendererPropsBase;
  const canvasPropsBase = controller.selectionBase?.canvasPropsBase;
  const groundPolicyBase = controller.selectionBase?.groundPolicyBase;
  const rendererProps = useMemo(() => rendererPropsBase ? ({
    ...rendererPropsBase,
    groundProjection: sceneRuntime?.ground?.rippleProjection,
  }) : null, [rendererPropsBase, sceneRuntime?.ground?.rippleProjection]);
  const canvasProps = useMemo(() => canvasPropsBase ? ({
    ...canvasPropsBase,
    runtime: sceneRuntime,
    groundPolicy: { ...groundPolicyBase, anchor: sceneRuntime?.anchors?.groundCenter?.screen },
    ringState: controller.ringState,
  }) : null, [canvasPropsBase, groundPolicyBase, sceneRuntime, controller.ringState]);
  const selection = useMemo(
    () => buildArtifactGallerySelection(controller.selectionBase, sceneRuntime, { rendererProps, canvasProps }),
    [controller.selectionBase, sceneRuntime, rendererProps, canvasProps],
  );

  const view = (
    <ArtifactGalleryView
      controller={{
        ...controller,
        selection,
      }}
      className={props.className || ''}
    />
  );
  return <CoolingCurveSettingsActivityProvider isActive={isEnabled}>{view}</CoolingCurveSettingsActivityProvider>;
}

export default React.memo(ArtifactGallery);
