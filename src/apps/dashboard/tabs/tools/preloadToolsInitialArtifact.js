import { readArtifactDisclosureSnapshotResource } from '../../artifacts/artifactDisclosureSnapshotResource.js';
import { getToolsArtifactDefinition } from '@/themes/core/tools/artifacts.js';
import { getArtifactGalleryWidgetType } from '@/themes/core/tools/artifactGalleryRenderer.js';
import { preloadArtifactGalleryRuntime } from '@/themes/core/tools/artifactGalleryPreparation.js';
import { getThemeWidgetChunkState, preloadThemeWidgetChunk } from '@/themes/core/registry/index.js';
import { assertThemeWidgetPreloadAck } from '../../loading/themeWidgetPreloadContract.js';
import { readArtifactGalleryPosition, resolveArtifactGalleryEntryArtifactId } from './artifactGalleryPositionState.js';
import { getToolsSelectedArtifactControllerState, preloadToolsSelectedArtifactController } from './selectedArtifactControllerResource.js';
import { throwIfDashboardPreloadAborted } from '../../loading/dashboardPreloadAdmission.js';

// Called only by admitted Tools critical work, after the Main first frame or
// on navigation intent. Disclosure and module records are shared with render.
export async function preloadToolsInitialArtifact(themeId, { signal = null } = {}) {
  throwIfDashboardPreloadAborted(signal);
  const snapshot = await readArtifactDisclosureSnapshotResource();
  throwIfDashboardPreloadAborted(signal);
  const artifactId = resolveArtifactGalleryEntryArtifactId(snapshot, readArtifactGalleryPosition());
  if (!artifactId) return Object.freeze({ artifactId: '', status: 'empty' });
  const definition = getToolsArtifactDefinition(artifactId);
  if (!definition) throw new Error(`ARTIFACT_NAVIGATION_ID_INVALID:${artifactId}`);
  const widgetType = getArtifactGalleryWidgetType(themeId, definition.visualKey);
  const [controllerAck, widgetAck] = await Promise.all([
    preloadToolsSelectedArtifactController(artifactId),
    preloadThemeWidgetChunk(themeId, widgetType),
    preloadArtifactGalleryRuntime(themeId, definition.visualKey),
  ]);
  throwIfDashboardPreloadAborted(signal);
  if (controllerAck?.loaded !== true || getToolsSelectedArtifactControllerState(artifactId).status !== 'ready') {
    throw new Error(`ARTIFACT_CONTROLLER_PRELOAD_NOT_READY:${artifactId}`);
  }
  assertThemeWidgetPreloadAck({ ack: widgetAck,
    chunkState: getThemeWidgetChunkState(themeId, widgetType), themeId, widgetType });
  return Object.freeze({ artifactId, status: 'ready' });
}
