import { buildProtectionRuntimeSnapshotMessage } from '../../contracts/protectionRuntimeSnapshotBridge.js';

function resolveProtectionSnapshotBrowserPort(browserPort) {
  if (typeof browserPort?.runtimeSendMessage !== 'function') {
    throw new Error('PROTECTION_RUNTIME_SNAPSHOT_BROWSER_PORT_REQUIRED');
  }
  return browserPort;
}

export function createProtectionRuntimeSnapshotEventEmitter({ browserPort } = {}) {
  const resolvedBrowserPort = resolveProtectionSnapshotBrowserPort(browserPort);

  async function emitProtectionRuntimeSnapshotUpdated(args = {}) {
    const result = await resolvedBrowserPort.runtimeSendMessage(
      buildProtectionRuntimeSnapshotMessage(args),
    );
    return result?.sent === true;
  }

  return {
    emitProtectionRuntimeSnapshotUpdated,
  };
}
