import { addExtensionListener } from '../../../../platform/extension/extensionApiCall.js';
import { reportRuntimeDiagnostic } from '../../../../platform/diagnostics/runtimeDiagnosticConsole.js';
import { createBrowserEventFailureFields } from './backgroundBrowserEventFailureFields.js';

export function addObservedBackgroundBrowserListener(event, listener, label) {
  if (typeof listener !== 'function') return addExtensionListener(event, listener);
  return addExtensionListener(event, function observedBrowserEventListener(...args) {
    try {
      const result = listener.apply(this, args);
      if (result && typeof result.then === 'function') {
        void Promise.resolve(result).catch((error) => reportRuntimeDiagnostic({
          scope: 'BackgroundBrowserEventBindings', severity: 'error',
          event: 'listener_rejected',
          code: 'BACKGROUND_BROWSER_EVENT_LISTENER_REJECTED',
          error,
          fields: createBrowserEventFailureFields(label, error),
        }));
      }
      return result;
    } catch (error) {
      reportRuntimeDiagnostic({
        scope: 'BackgroundBrowserEventBindings', severity: 'error',
        event: 'listener_thrown',
        code: 'BACKGROUND_BROWSER_EVENT_LISTENER_THROWN',
        error,
        fields: createBrowserEventFailureFields(label, error),
      });
      throw error;
    }
  });
}
