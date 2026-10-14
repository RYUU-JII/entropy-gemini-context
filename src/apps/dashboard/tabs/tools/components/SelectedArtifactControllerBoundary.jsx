import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { getThemeWidgetChunkState, preloadThemeWidgetChunk } from '@/themes/core/registry/index.js';
import { getToolsArtifactDefinition } from '@/themes/core/tools/artifacts.js';
import { getArtifactGalleryWidgetType } from '@/themes/core/tools/artifactGalleryRenderer.js';
import { preloadArtifactGalleryRuntime } from '@/themes/core/tools/artifactGalleryPreparation.js';
import { recordDashboardTabEntryStage } from '@dashboard-tab-entry-telemetry';

import {
  getToolsSelectedArtifactControllerState,
  preloadToolsSelectedArtifactController,
  retryToolsSelectedArtifactController,
} from '../selectedArtifactControllerResource.js';

function SelectedArtifactControllerSnapshot({ controller, onChange }) {
  useLayoutEffect(() => {
    onChange(controller);
    // Suspense also disconnects layout effects when hiding a prepared tree.
    // Clearing the parent here would remove the card, reveal this tree, then
    // publish it again and suspend in a loop. Admission/id checks own expiry.
  }, [controller, onChange]);
  return null;
}

// Controller admission must not insert an ancestor above the workspace. Keep
// its hooks in a sibling and publish the selected projection before paint.
const SelectedArtifactControllerHost = React.memo(function SelectedArtifactControllerHost({
  Controller,
  isActive,
  onChange,
  presentation,
}) {
  return (
    <Controller isActive={isActive} presentation={presentation}>
      {(controller) => (
        <SelectedArtifactControllerSnapshot controller={controller} onChange={onChange} />
      )}
    </Controller>
  );
});

export default function SelectedArtifactControllerBoundary({
  artifactId,
  children,
  isActive = true,
  presentation,
}) {
  const { t: tTools } = useAppTranslation('tools');
  const mountedRef = useRef(false);
  const loadRevisionRef = useRef(0);
  const [loadState, setLoadState] = useState(() => (
    getToolsSelectedArtifactControllerState(artifactId)
  ));
  const [selectedController, setSelectedController] = useState(null);
  const themeId = presentation?.themeId;
  const visualKey = artifactId ? getToolsArtifactDefinition(artifactId)?.visualKey : null;
  const widgetType = artifactId ? getArtifactGalleryWidgetType(themeId, visualKey) : null;
  const widgetReady = !artifactId || getThemeWidgetChunkState(themeId, widgetType)?.status === 'ready';
  const prepareSelection = useCallback((retryController = false) => Promise.all([
    retryController ? retryToolsSelectedArtifactController(artifactId) : preloadToolsSelectedArtifactController(artifactId),
    preloadThemeWidgetChunk(themeId, widgetType),
    preloadArtifactGalleryRuntime(themeId, visualKey),
  ]).then(([controllerAck, widgetAck]) => {
    if (controllerAck?.loaded !== true || getToolsSelectedArtifactControllerState(artifactId).status !== 'ready') {
      throw new Error(`ARTIFACT_CONTROLLER_PRELOAD_NOT_READY:${artifactId}`);
    }
    if (widgetAck?.loaded !== true || getThemeWidgetChunkState(themeId, widgetType)?.status !== 'ready') {
      throw new Error(`ARTIFACT_WIDGET_PRELOAD_NOT_READY:${widgetType}`);
    }
  }), [artifactId, themeId, widgetType, visualKey]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadRevisionRef.current += 1;
    };
  }, []);

  useEffect(() => {
    const loadRevision = loadRevisionRef.current + 1;
    loadRevisionRef.current = loadRevision;
    const nextState = getToolsSelectedArtifactControllerState(artifactId);
    setLoadState(nextState);
    if (!isActive || !nextState.required || (nextState.status === 'ready' && widgetReady)) {
      return () => {
        if (loadRevisionRef.current === loadRevision) loadRevisionRef.current += 1;
      };
    }
    void prepareSelection()
      .then(() => {
        if (mountedRef.current && loadRevisionRef.current === loadRevision) {
          setLoadState(getToolsSelectedArtifactControllerState(artifactId));
        }
      })
      .catch((error) => {
        if (mountedRef.current && loadRevisionRef.current === loadRevision) {
          setLoadState({ ...getToolsSelectedArtifactControllerState(artifactId), status: 'error', error });
        }
      });
    return () => {
      if (loadRevisionRef.current === loadRevision) loadRevisionRef.current += 1;
    };
  }, [artifactId, isActive, prepareSelection, widgetReady]);

  const retry = useCallback(() => {
    const loadRevision = loadRevisionRef.current + 1;
    loadRevisionRef.current = loadRevision;
    setLoadState({
      ...getToolsSelectedArtifactControllerState(artifactId),
      status: 'loading',
      error: null,
    });
    void prepareSelection(true)
      .then(() => {
        if (mountedRef.current && loadRevisionRef.current === loadRevision) {
          setLoadState(getToolsSelectedArtifactControllerState(artifactId));
        }
      })
      .catch((error) => {
        if (mountedRef.current && loadRevisionRef.current === loadRevision) {
          setLoadState({ ...getToolsSelectedArtifactControllerState(artifactId), status: 'error', error });
        }
      });
  }, [artifactId, prepareSelection]);

  if (typeof children !== 'function') {
    throw new Error('TOOLS_SELECTED_ARTIFACT_CONTROLLER_RENDER_REQUIRED');
  }

  const currentLoadState = loadState.artifactId === artifactId
    ? loadState
    : getToolsSelectedArtifactControllerState(artifactId);
  useEffect(() => {
    if (!isActive || currentLoadState.status !== 'error') return undefined;
    let current = true;
    queueMicrotask(() => {
      if (current) recordDashboardTabEntryStage('tools', 'readiness:error', {
        artifactId, surfaceId: 'tools-selected-artifact-controller',
        message: currentLoadState.error?.message,
      });
    });
    return () => { current = false; };
  }, [artifactId, isActive, currentLoadState.status, currentLoadState.error]);
  const Controller = currentLoadState.required
    && currentLoadState.status === 'ready'
    && widgetReady
    && typeof currentLoadState.Controller === 'function'
    ? currentLoadState.Controller
    : null;
  if (isActive && currentLoadState.required && currentLoadState.status === 'error') {
    return (
      <section
        role="alert"
        className="flex h-full min-h-0 w-full items-center justify-center rounded-[10px] border border-danger/30 bg-surface px-6 py-5 text-sm font-semibold text-danger"
      >
        <div className="max-w-lg text-center">
          <p>{tTools('artifact_altar.navigation.load_failed')}</p>
          <p className="mt-2 break-all text-[10px] text-on-surface-muted">
            {currentLoadState.error?.message || 'TOOLS_SELECTED_ARTIFACT_CONTROLLER_LOAD_FAILED'}
          </p>
          <button
            type="button"
            className="mt-3 rounded-[8px] border border-danger/30 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em]"
            onClick={retry}
          >
            {tTools('artifact_altar.navigation.retry')}
          </button>
        </div>
      </section>
    );
  }
  return (
    <>
      {Controller ? (
        <SelectedArtifactControllerHost
          key={artifactId}
          Controller={Controller}
          isActive={isActive}
          presentation={presentation}
          onChange={setSelectedController}
        />
      ) : null}
      {children(Controller && selectedController?.artifactId === artifactId ? selectedController : null)}
    </>
  );
}
