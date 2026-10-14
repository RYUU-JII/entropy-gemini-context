import '../../platform/chrome/dev/reactRefreshPreamble.js';
import React from 'react';
import { createRoot } from 'react-dom/client';

import { initializeDocumentThemeProjection } from '../../themes/core/documentThemeProjection.js';
import VisualHarnessApp, { VisualHarnessErrorSurface } from './VisualHarnessApp.jsx';
import { installVisualHarnessRuntime } from './visualHarnessRuntime.js';
import './visualHarness.css';

function getRootElement() {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('[VisualHarness] #root is missing from the harness document.');
  }
  return root;
}

function readRequestedSceneId() {
  const url = new URL(window.location.href);
  const sceneId = url.searchParams.get('scene');
  return typeof sceneId === 'string' ? sceneId.trim() : '';
}

function applySceneDocument(sceneManifest) {
  document.documentElement.lang = sceneManifest.locale;
  document.documentElement.dataset.visualHarness = '1';
  document.documentElement.dataset.visualHarnessStatus = 'preparing';
  document.documentElement.dataset.visualSceneId = sceneManifest.id;
  document.documentElement.dataset.visualSceneKind = sceneManifest.kind;
  document.body.dataset.visualSceneId = sceneManifest.id;
  document.title = `${sceneManifest.title} · Entropy Visual Harness`;

  if (sceneManifest.themeId) {
    initializeDocumentThemeProjection(sceneManifest.themeId);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

export async function bootVisualHarness(loadScene) {
  const requestedSceneId = readRequestedSceneId();
  const runtime = installVisualHarnessRuntime(requestedSceneId);
  const root = createRoot(getRootElement());

  window.addEventListener('error', (event) => {
    runtime.markError(event.error || new Error(event.message));
  });
  window.addEventListener('unhandledrejection', (event) => {
    runtime.markError(event.reason || new Error('Unhandled promise rejection.'));
  });

  try {
    const scene = await loadScene(requestedSceneId);
    runtime.publishScene(scene.manifest);
    applySceneDocument(scene.manifest);
    if (scene.prepare) {
      await scene.prepare({ manifest: scene.manifest });
    }
    runtime.markRendering();
    root.render(<VisualHarnessApp runtime={runtime} scene={scene} />);
  } catch (error) {
    runtime.markError(error);
    root.render(<VisualHarnessErrorSurface error={error} />);
  }
}
