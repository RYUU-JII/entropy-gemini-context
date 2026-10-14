import { createContentScriptOrchestrator } from '../../../../domains/tracking/background/ContentScriptOrchestrator.js';
import { createContentRuntimeDiagnostics } from '../../../../domains/tracking/background/ContentRuntimeDiagnostics.js';
import { createManagedContentScriptSync } from '../../../../domains/tracking/background/ManagedContentScriptSync.js';
import { createTabContentSessionRegistry } from '../../../../domains/tracking/background/TabContentSessionRegistry.js';
import { buildPrepaintVisualPlansFromRootVisualSnapshots } from '../../../../domains/protection/background/runtime/PrepaintVisualPlanCompiler.js';
import { createFrameMediaControlBroker } from '../../../../domains/protection/background/runtime/FrameMediaControlBroker.js';
import { getInterventionAdmissionService } from '../../../../domains/protection/background/runtime/InterventionAdmissionService.js';
import {
  permissionsContainsStrict,
  permissionsGetAllStrict,
  tabsSendMessage,
} from '../../../../platform/chrome/ChromeService.js';
import {
  MANAGED_CONTENT_SCRIPT_FILES,
  MANAGED_CONTENT_SCRIPT_ID,
  MEDIA_FRAME_CONTENT_SCRIPT,
  PREPAINT_VISUAL_CONTENT_SCRIPTS,
} from './backgroundKernelRuntimeConfig.js';

export function createBackgroundKernelContentScriptBindings({
  settingsService,
  settingsCache,
  bootstrapSnapshotRepository,
} = {}) {
  if (
    !bootstrapSnapshotRepository?.prepareCurrentCacheGeneration
    || !bootstrapSnapshotRepository?.listRootVisualSnapshots
  ) {
    throw new Error('PREPAINT_BOOTSTRAP_REPOSITORY_REQUIRED');
  }

  const contentScriptRegistrationSync = createManagedContentScriptSync({
    settingsService,
    settingsCache,
    managedContentScriptId: MANAGED_CONTENT_SCRIPT_ID,
    contentScriptFiles: MANAGED_CONTENT_SCRIPT_FILES,
    mediaFrameContentScript: MEDIA_FRAME_CONTENT_SCRIPT,
    prepaintVisualScripts: PREPAINT_VISUAL_CONTENT_SCRIPTS,
    hasScriptingPermission: permissionsContainsStrict,
    getGrantedPermissions: permissionsGetAllStrict,
    prepaintVisualPlanProvider: async ({ now } = {}) => {
      await bootstrapSnapshotRepository.prepareCurrentCacheGeneration();
      const snapshots = await bootstrapSnapshotRepository.listRootVisualSnapshots({ now });
      return buildPrepaintVisualPlansFromRootVisualSnapshots(snapshots, { now });
    },
  });
  const contentRuntimeDiagnostics = createContentRuntimeDiagnostics();
  const tabContentSessionRegistry = createTabContentSessionRegistry();
  const frameMediaControl = createFrameMediaControlBroker({
    readAdmission: () => getInterventionAdmissionService().snapshot(),
    readTopSession: tabId => tabContentSessionRegistry.get(tabId),
    hasPermission: permissionsContainsStrict,
    sendMessage: tabsSendMessage,
    onDiagnostic: (event, payload) => contentRuntimeDiagnostics.record(event, payload),
  });
  const contentScriptOrchestrator = createContentScriptOrchestrator({
    frameMediaControl,
    contentScriptRegistrationSync,
    contentRuntimeDiagnostics,
    tabContentSessionRegistry,
    contentScriptFiles: MANAGED_CONTENT_SCRIPT_FILES,
    mediaFrameContentScriptFiles: MEDIA_FRAME_CONTENT_SCRIPT.js,
  });

  return {
    contentScriptRegistrationSync,
    contentRuntimeDiagnostics,
    tabContentSessionRegistry,
    contentScriptOrchestrator,
  };
}
