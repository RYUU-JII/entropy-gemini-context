import { MESSAGE_ACTIONS } from '../../../../../platform/messaging/messageTypes.js';
import { requireSecurityVaultStatus } from '../../../../../platform/security/securityVaultStatusContract.js';
import {
  isTrustedDashboardPageSender,
  isTrustedExtensionPageSender,
  resolveSenderPageUrl,
} from '../../../../../platform/security/senderTrust.js';

export const SECURITY_VAULT_ACTIONS = Object.freeze([
  MESSAGE_ACTIONS.GET_SECURITY_VAULT_STATUS,
  MESSAGE_ACTIONS.SETUP_SECURITY_VAULT,
  MESSAGE_ACTIONS.UNLOCK_SECURITY_VAULT,
  MESSAGE_ACTIONS.CHANGE_SECURITY_VAULT_PASSPHRASE,
  MESSAGE_ACTIONS.REMOVE_SECURITY_VAULT_PASSPHRASE,
  MESSAGE_ACTIONS.SEPARATE_SECURITY_VAULT_PROTECTION_KEYS,
]);

function isVaultStatusReader(sender) {
  if (isTrustedDashboardPageSender(sender)) return true;
  if (!isTrustedExtensionPageSender(sender)) return false;
  try {
    return new URL(resolveSenderPageUrl(sender)).pathname === '/src/pages/popup.html';
  } catch {
    return false;
  }
}

export function createSecurityVaultMessageRoutes({ repository, resumeBootstrap } = {}) {
  for (const method of ['ensureLocalVault', 'getVaultStatus', 'setupVault', 'unlockVault', 'changeVaultPassphrase', 'removeVaultPassphrase', 'separateVaultProtectionKeys']) {
    if (typeof repository?.[method] !== 'function') throw new Error('SECURITY_VAULT_MESSAGE_OWNER_REQUIRED');
  }
  if (typeof resumeBootstrap !== 'function') throw new Error('SECURITY_VAULT_BOOTSTRAP_OWNER_REQUIRED');

  const handle = (action) => (request, sender, sendResponse) => {
    const isRead = action === MESSAGE_ACTIONS.GET_SECURITY_VAULT_STATUS;
    if (!(isRead ? isVaultStatusReader(sender) : isTrustedDashboardPageSender(sender))) {
      sendResponse?.({ success: false, error: 'SECURITY_VAULT_UNAUTHORIZED_SENDER' });
      return false;
    }
    const fields = isRead ? ['action']
      : action === MESSAGE_ACTIONS.CHANGE_SECURITY_VAULT_PASSPHRASE
        ? ['action', 'currentPassphrase', 'newPassphrase']
        : action === MESSAGE_ACTIONS.REMOVE_SECURITY_VAULT_PASSPHRASE
          ? ['action', 'currentPassphrase'] : ['action', 'passphrase'];
    if (Object.keys(request).length !== fields.length
      || Object.keys(request).some((key) => !fields.includes(key))
      || fields.some((key) => typeof request[key] !== 'string')) {
      sendResponse?.({ success: false, error: 'SECURITY_VAULT_REQUEST_INVALID' });
      return false;
    }
    Promise.resolve().then(async () => {
      if (isRead) {
        await repository.ensureLocalVault();
      } else if (action === MESSAGE_ACTIONS.SETUP_SECURITY_VAULT) {
        await repository.setupVault({ passphrase: request.passphrase });
      } else if (action === MESSAGE_ACTIONS.UNLOCK_SECURITY_VAULT) {
        await repository.unlockVault({ passphrase: request.passphrase });
      } else if (action === MESSAGE_ACTIONS.CHANGE_SECURITY_VAULT_PASSPHRASE) {
        await repository.changeVaultPassphrase({
          currentPassphrase: request.currentPassphrase,
          newPassphrase: request.newPassphrase,
        });
      } else if (action === MESSAGE_ACTIONS.REMOVE_SECURITY_VAULT_PASSPHRASE) {
        await repository.removeVaultPassphrase({ currentPassphrase: request.currentPassphrase });
      } else if (action === MESSAGE_ACTIONS.SEPARATE_SECURITY_VAULT_PROTECTION_KEYS) {
        await repository.separateVaultProtectionKeys({ passphrase: request.passphrase });
      }
      const status = requireSecurityVaultStatus(await repository.getVaultStatus());
      if (status.protectionReady === true) resumeBootstrap();
      return { success: true, status };
    }).then(sendResponse, (error) => sendResponse?.({
      success: false, error: error?.code || error?.message || 'SECURITY_VAULT_OPERATION_FAILED',
    }));
    return true;
  };
  return { actions: Object.fromEntries(SECURITY_VAULT_ACTIONS.map((action) => [action, handle(action)])) };
}
