import { createProtectedTabGroupService } from '../../../../domains/protection/background/runtime/ProtectedTabGroupService.js';
import { ProtectedTabGroupsRepository } from '../../../../platform/storage/runtime/ProtectedTabGroupsRepository.js';
import { createBackgroundKernelTabManagementBrowserPort } from './backgroundKernelTabManagementBrowserPort.js';

export function createBackgroundKernelTabManagementBindings({ settingsService, readProtectedTabInventory, gateInterventionSessionRepository, runProfileMutationAdmittedTask, recordDiagnostic }) {
  const service = createProtectedTabGroupService({
    browserPort: createBackgroundKernelTabManagementBrowserPort(),
    repository: new ProtectedTabGroupsRepository(),
    readSettings: async () => {
      await settingsService.ensureSettingsCache();
      return settingsService.getSettingsCache();
    },
    readProtectedTabInventory,
    readGateSession: tabId => gateInterventionSessionRepository.getSessionByTabId(tabId),
  });
  async function run(method, tabId) {
    try {
      return await runProfileMutationAdmittedTask({
        label: `tab_management:${method}`,
        task: () => service[method](tabId),
      });
    } catch (error) {
      const reason = error?.message || String(error);
      recordDiagnostic('tab_management_projection_failed', { source: 'tab_management', method, tabId, reason });
      console.warn('[TabManagement] native projection failed', method, reason);
      return { status: 'failed', reason };
    }
  }
  return {
    observeTab: tabId => run('observeTab', tabId),
    refresh: () => run('refresh'),
    organizeOpenTabs: () => run('organizeOpenTabs'),
    beforeGateNavigation: tabId => run('beforeGateNavigation', tabId),
  };
}
