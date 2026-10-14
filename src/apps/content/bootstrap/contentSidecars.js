import { setRuntimeLanguage } from '../../../domains/settings/i18n/runtimeLanguageState.js';
import { readContentRuntimeLanguage } from '../../../platform/storage/bootstrap/contentLoaderRootVisualReader.js';
import { runtimeOnMessageAddListener, runtimeOnMessageRemoveListener } from '../../../platform/chrome/ChromeService.js';
import { isTrustedExtensionBackgroundSender } from '../../../platform/security/senderTrust.js';
import { MESSAGE_TYPES } from '../../../platform/messaging/messageTypes.js';

export function createContentBootstrapSidecars({
  getEpoch,
  bumpEpoch,
} = {}) {
  let runtimeLanguageUnsubscribe = null;
  let faviconCaptureModulePromise = null;
  let ceremonyHostModulePromise = null;

  function getFaviconCaptureModule() {
    faviconCaptureModulePromise ||= import('../faviconCapture.js');
    return faviconCaptureModulePromise;
  }

  function getCeremonyHostModule() {
    ceremonyHostModulePromise ||= import('../../../platform/ceremony/ContentCeremonyHostBridge.js');
    return ceremonyHostModulePromise;
  }

  function createContentSidecarError(code, details = {}) {
    const error = new Error(code);
    error.name = 'ContentBootstrapSidecarError';
    error.code = code;
    error.details = Object.freeze({ ...details });
    return error;
  }

  function assertEpochCurrent(epoch, phase) {
    if (epoch === getEpoch?.()) return;
    throw createContentSidecarError('CONTENT_BOOTSTRAP_SIDECAR_EPOCH_STALE', {
      phase,
      expectedEpoch: epoch,
      actualEpoch: getEpoch?.(),
    });
  }

  async function hydrateRuntimeLanguageFromStorage(epoch) {
    if (typeof runtimeLanguageUnsubscribe === 'function') return;
    let readSequence = 0;
    const refreshLanguage = async () => {
      const sequence = ++readSequence;
      const language = await readContentRuntimeLanguage();
      assertEpochCurrent(epoch, 'runtime_language_hydration');
      if (sequence !== readSequence) return;
      setRuntimeLanguage(language);
    };
    const listener = (message, sender) => {
      if (message?.type !== MESSAGE_TYPES.PROTECTION_UPDATE || !isTrustedExtensionBackgroundSender(sender)) return false;
      void refreshLanguage().catch(error => {
        if (epoch !== getEpoch?.()) return;
        console.error('[i18n] Content runtime language refresh failed.', error);
      });
      return false;
    };
    if (!runtimeOnMessageAddListener(listener)) throw new Error('CONTENT_RUNTIME_LANGUAGE_LISTENER_UNAVAILABLE');
    const unsubscribe = () => runtimeOnMessageRemoveListener(listener);
    runtimeLanguageUnsubscribe = unsubscribe;
    try {
      await refreshLanguage();
    } catch (error) {
      unsubscribe();
      if (runtimeLanguageUnsubscribe === unsubscribe) runtimeLanguageUnsubscribe = null;
      throw error;
    }
  }

  function teardownRuntimeLanguageHydration() {
    bumpEpoch?.();
    if (typeof runtimeLanguageUnsubscribe === 'function') {
      runtimeLanguageUnsubscribe();
    }
    runtimeLanguageUnsubscribe = null;
  }

  async function bootstrapFaviconCapture(epoch) {
    const module = await getFaviconCaptureModule();
    assertEpochCurrent(epoch, 'favicon_capture');
    module?.initFaviconCapture?.();
  }

  async function bootstrapCeremonyHost(epoch) {
    const module = await getCeremonyHostModule();
    assertEpochCurrent(epoch, 'ceremony_host');
    module?.installContentCeremonyHost?.();
  }

  async function start(epoch) {
    await Promise.all([
      hydrateRuntimeLanguageFromStorage(epoch),
      bootstrapFaviconCapture(epoch),
      bootstrapCeremonyHost(epoch),
    ]);
  }

  async function teardown() {
    const operations = [() => teardownRuntimeLanguageHydration()];
    if (faviconCaptureModulePromise) {
      operations.push(() => faviconCaptureModulePromise
        .then((module) => module.teardownFaviconCapture()));
    }
    if (ceremonyHostModulePromise) {
      operations.push(() => ceremonyHostModulePromise
        .then((module) => module.teardownContentCeremonyHost()));
    }
    const results = await Promise.allSettled(operations.map(async (run) => run()));
    const failures = results.filter((result) => result.status === 'rejected').map((result) => result.reason);
    if (failures.length > 0) throw new AggregateError(failures, 'CONTENT_SIDECAR_CLEANUP_FAILED');
  }

  return {
    start,
    teardown,
  };
}
