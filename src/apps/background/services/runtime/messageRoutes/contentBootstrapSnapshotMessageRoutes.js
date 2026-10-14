import { MESSAGE_TYPES } from '../../../../../platform/messaging/messageTypes.js';
import { isTrustedExtensionTabSender } from '../../../../../platform/security/senderTrust.js';
import { initializeTrustedLocalStorageAccess } from '../../../../../platform/storage/security/StorageTrustCapability.js';

function requireContentHostname(sender) {
  if (!isTrustedExtensionTabSender(sender) || !Number.isInteger(sender?.frameId) || sender.frameId < 0) {
    throw new Error('CONTENT_BOOTSTRAP_SNAPSHOT_UNTRUSTED_SENDER');
  }
  // sender.url identifies this frame. tab.url and request.hostname can name a
  // different host and must never grant access to another site's cached plan.
  let url;
  try {
    url = new URL(sender.url);
  } catch {
    throw new Error('CONTENT_BOOTSTRAP_SNAPSHOT_SENDER_URL_INVALID');
  }
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname) {
    throw new Error('CONTENT_BOOTSTRAP_SNAPSHOT_SENDER_URL_INVALID');
  }
  return url.hostname.toLowerCase();
}

export function createContentBootstrapSnapshotMessageRoutes({
  bootstrapSnapshotRepository,
  runtimeLanguageRepository,
  waitForStorageTrust = initializeTrustedLocalStorageAccess,
} = {}) {
  if (
    typeof bootstrapSnapshotRepository?.getRootVisualSnapshot !== 'function'
    || typeof bootstrapSnapshotRepository?.getFrictionSnapshot !== 'function'
    || typeof runtimeLanguageRepository?.get !== 'function'
    || typeof waitForStorageTrust !== 'function'
  ) {
    throw new Error('CONTENT_BOOTSTRAP_SNAPSHOT_OWNER_REQUIRED');
  }
  return {
    types: {
      [MESSAGE_TYPES.CONTENT_BOOTSTRAP_SNAPSHOT]: (message, sender, sendResponse) => {
        Promise.resolve().then(async () => {
          const hostname = requireContentHostname(sender);
          const { operation } = message;
          if (Object.keys(message).some((key) => !['type', 'operation'].includes(key))) {
            throw new Error('CONTENT_BOOTSTRAP_SNAPSHOT_REQUEST_INVALID');
          }
          if (!['root_visual', 'friction', 'language'].includes(operation)) {
            throw new Error('CONTENT_BOOTSTRAP_SNAPSHOT_OPERATION_INVALID');
          }
          await waitForStorageTrust();
          const options = { hostname, now: Date.now() };
          let snapshot;
          if (operation === 'root_visual') {
            snapshot = await bootstrapSnapshotRepository.getRootVisualSnapshot(options);
          } else if (operation === 'friction') {
            snapshot = await bootstrapSnapshotRepository.getFrictionSnapshot(options);
          } else if (operation === 'language') {
            snapshot = await runtimeLanguageRepository.get('en');
          }
          return {
            success: true,
            type: MESSAGE_TYPES.CONTENT_BOOTSTRAP_SNAPSHOT,
            operation,
            hostname,
            snapshot,
          };
        }).then(
          (result) => sendResponse?.(result),
          (error) => sendResponse?.({
            success: false,
            error: error?.code || error?.message || 'CONTENT_BOOTSTRAP_SNAPSHOT_READ_FAILED',
          }),
        );
        return true;
      },
    },
  };
}
