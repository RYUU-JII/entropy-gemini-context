import { withDynamicImportRecovery } from '@/platform/extension/dynamicImportRecovery.js';

import {
  DASHBOARD_TAB_ASYNC_BOUNDARY_IDS,
  isDashboardTabAsyncBoundaryAllowed,
} from '../loadingPolicy.js';

const SELECTED_ARTIFACT_CONTROLLER_BOUNDARY_ID =
  DASHBOARD_TAB_ASYNC_BOUNDARY_IDS.TOOLS_SELECTED_ARTIFACT_CONTROLLER;

if (!isDashboardTabAsyncBoundaryAllowed('tools', SELECTED_ARTIFACT_CONTROLLER_BOUNDARY_ID)) {
  throw new Error(
    `DASHBOARD_TAB_ASYNC_BOUNDARY_UNDECLARED:tools:${SELECTED_ARTIFACT_CONTROLLER_BOUNDARY_ID}`,
  );
}

const loadEchoArtifactController = withDynamicImportRecovery(
  () => import('./selectedControllers/SelectedEchoArtifactController.jsx'),
  { boundaryId: 'dashboard-tools-selected-echo-controller' },
);

const SELECTED_ARTIFACT_CONTROLLER_LOADERS = Object.freeze({
  lens: withDynamicImportRecovery(() => import('./selectedControllers/SelectedLensArtifactController.jsx'), { boundaryId: 'dashboard-tools-selected-lens-controller' }),
  veil: withDynamicImportRecovery(() => import('./selectedControllers/SelectedVeilArtifactController.jsx'), { boundaryId: 'dashboard-tools-selected-veil-controller' }),
  brake: withDynamicImportRecovery(() => import('./selectedControllers/SelectedBrakeArtifactController.jsx'), { boundaryId: 'dashboard-tools-selected-brake-controller' }),
  barrier: withDynamicImportRecovery(() => import('./selectedControllers/SelectedBarrierArtifactController.jsx'), { boundaryId: 'dashboard-tools-selected-barrier-controller' }),
  gate: withDynamicImportRecovery(() => import('./selectedControllers/SelectedGateArtifactController.jsx'), { boundaryId: 'dashboard-tools-selected-gate-controller' }),
  flare: withDynamicImportRecovery(() => import('./selectedControllers/SelectedFlareArtifactController.jsx'), { boundaryId: 'dashboard-tools-selected-flare-controller' }),
  echo: loadEchoArtifactController,
});

function normalizeArtifactId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function requireControllerLoaders(loaders) {
  if (!loaders || typeof loaders !== 'object' || Array.isArray(loaders)) {
    throw new Error('TOOLS_SELECTED_ARTIFACT_CONTROLLER_LOADERS_REQUIRED');
  }
  const entries = Object.entries(loaders);
  const normalizedLoaders = {};
  entries.forEach(([artifactId, loader]) => {
    const normalizedArtifactId = normalizeArtifactId(artifactId);
    if (!normalizedArtifactId || normalizedArtifactId !== artifactId) {
      throw new Error('TOOLS_SELECTED_ARTIFACT_CONTROLLER_ID_INVALID');
    }
    if (typeof loader !== 'function') {
      throw new Error(`TOOLS_SELECTED_ARTIFACT_CONTROLLER_LOADER_INVALID:${artifactId}`);
    }
    normalizedLoaders[artifactId] = loader;
  });
  return Object.freeze(normalizedLoaders);
}

function validateControllerModule(artifactId, module) {
  if (typeof module?.default !== 'function') {
    throw new Error(`TOOLS_SELECTED_ARTIFACT_CONTROLLER_EXPORT_INVALID:${artifactId}`);
  }
  return module.default;
}

function createToolsSelectedArtifactControllerResource(loaders) {
  const controllerLoaders = requireControllerLoaders(loaders);
  const controllerRecords = new Map();

  function getControllerLoader(artifactId) {
    return controllerLoaders[normalizeArtifactId(artifactId)] || null;
  }

  function startControllerLoad(artifactId, loader) {
    const record = {
      status: 'loading',
      Controller: null,
      error: null,
      promise: null,
    };
    controllerRecords.set(artifactId, record);
    record.promise = Promise.resolve()
      .then(() => loader())
      .then((module) => {
        const Controller = validateControllerModule(artifactId, module);
        if (controllerRecords.get(artifactId) !== record) {
          return Object.freeze({ artifactId, loaded: true, stale: true });
        }
        record.status = 'ready';
        record.Controller = Controller;
        record.error = null;
        return Object.freeze({ artifactId, loaded: true, stale: false });
      })
      .catch((error) => {
        const normalizedError = error instanceof Error ? error : new Error(String(error));
        if (controllerRecords.get(artifactId) === record) {
          record.status = 'error';
          record.Controller = null;
          record.error = normalizedError;
        }
        throw normalizedError;
      });
    return record.promise;
  }

  function getState(artifactId) {
    const normalizedArtifactId = normalizeArtifactId(artifactId);
    const loader = getControllerLoader(normalizedArtifactId);
    if (!loader) {
      return Object.freeze({
        artifactId: normalizedArtifactId,
        required: false,
        status: 'ready',
        Controller: null,
        error: null,
      });
    }
    const record = controllerRecords.get(normalizedArtifactId);
    return Object.freeze({
      artifactId: normalizedArtifactId,
      required: true,
      status: record?.status || 'idle',
      Controller: record?.Controller || null,
      error: record?.error || null,
    });
  }

  function preload(artifactId) {
    const normalizedArtifactId = normalizeArtifactId(artifactId);
    const loader = getControllerLoader(normalizedArtifactId);
    if (!loader) {
      return Promise.resolve(Object.freeze({
        artifactId: normalizedArtifactId,
        loaded: true,
        required: false,
      }));
    }
    const record = controllerRecords.get(normalizedArtifactId);
    if (record?.status === 'ready') {
      return Promise.resolve(Object.freeze({
        artifactId: normalizedArtifactId,
        loaded: true,
        required: true,
      }));
    }
    if (record?.status === 'loading' && record.promise) {
      return record.promise;
    }
    if (record?.status === 'error' && record.error) {
      return Promise.reject(record.error);
    }
    return startControllerLoad(normalizedArtifactId, loader);
  }

  function retry(artifactId) {
    const normalizedArtifactId = normalizeArtifactId(artifactId);
    const loader = getControllerLoader(normalizedArtifactId);
    if (!loader) return preload(normalizedArtifactId);
    return startControllerLoad(normalizedArtifactId, loader);
  }

  return Object.freeze({
    getState,
    isReady: (artifactId) => getState(artifactId).status === 'ready',
    preload,
    retry,
  });
}

const selectedArtifactControllerResource = createToolsSelectedArtifactControllerResource(
  SELECTED_ARTIFACT_CONTROLLER_LOADERS,
);

export function getToolsSelectedArtifactControllerState(artifactId) {
  return selectedArtifactControllerResource.getState(artifactId);
}

export function isToolsSelectedArtifactControllerReady(artifactId) {
  return selectedArtifactControllerResource.isReady(artifactId);
}

export function preloadToolsSelectedArtifactController(artifactId) {
  return selectedArtifactControllerResource.preload(artifactId);
}

export function retryToolsSelectedArtifactController(artifactId) {
  return selectedArtifactControllerResource.retry(artifactId);
}

export function createToolsSelectedArtifactControllerResourceForTests(loaders) {
  if (import.meta.env?.MODE !== 'test') {
    throw new Error('TOOLS_SELECTED_ARTIFACT_CONTROLLER_TEST_RESOURCE_FORBIDDEN');
  }
  return createToolsSelectedArtifactControllerResource(loaders);
}
