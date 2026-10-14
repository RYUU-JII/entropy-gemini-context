import { verifyPasscodeStrict } from '../../../../platform/security/passcode.js';
import { isTrustedExtensionPageSender } from '../../../../platform/security/senderTrust.js';
import { MESSAGE_ACTIONS } from '../../../../platform/messaging/messageTypes.js';
import {
  DEFAULT_SECURITY_SETTINGS,
  deriveDestructiveActionAuthPolicy,
  readDestructiveActionAuthPolicy as readDefaultDestructiveActionAuthPolicy,
} from '../../../../platform/storage/security/SecuritySettingsQueryService.js';

const DESTRUCTIVE_RUNTIME_ACTIONS = new Set([
  MESSAGE_ACTIONS.DEBUG_RESET_STATS,
  MESSAGE_ACTIONS.RESET_ANALYTICS_DATA,
  MESSAGE_ACTIONS.RESET_APP_DATA,
  MESSAGE_ACTIONS.CLEANUP_BLOCKED_HISTORY,
  MESSAGE_ACTIONS.EXPORT_STORAGE_SNAPSHOT,
  MESSAGE_ACTIONS.IMPORT_STORAGE_SNAPSHOT,
  MESSAGE_ACTIONS.RUN_STORAGE_SUPPORT_ACTION,
]);

function resolveDestructiveActionPasscode(request) {
  const auth = request?.authorization;
  if (auth && typeof auth === 'object' && typeof auth.passcode === 'string') {
    return auth.passcode;
  }
  if (typeof request?.passcode === 'string') {
    return request.passcode;
  }
  return '';
}

export function createDestructiveActionPolicy({
  readDestructiveActionAuthPolicy = readDefaultDestructiveActionAuthPolicy,
  readSecuritySnapshot = null,
} = {}) {
  const authorizeDestructiveRuntimeAction = async ({
    action,
    request,
    sender,
    readSecuritySnapshot: overrideReadSecuritySnapshot,
  }) => {
    if (!DESTRUCTIVE_RUNTIME_ACTIONS.has(action)) {
      return { authorized: true, error: null };
    }

    if (!isTrustedExtensionPageSender(sender)) {
      return { authorized: false, error: 'UNAUTHORIZED_RUNTIME_SENDER' };
    }

    const authPolicy = typeof overrideReadSecuritySnapshot === 'function'
      ? deriveDestructiveActionAuthPolicy(await overrideReadSecuritySnapshot(DEFAULT_SECURITY_SETTINGS))
      : typeof readSecuritySnapshot === 'function'
        ? deriveDestructiveActionAuthPolicy(await readSecuritySnapshot(DEFAULT_SECURITY_SETTINGS))
        : await readDestructiveActionAuthPolicy();
    if (authPolicy?.blockedByMissingHighSecurityPasscode) {
      return { authorized: false, error: 'HIGH_SECURITY_PASSCODE_REQUIRED' };
    }
    const transfersSecrets = (
      action === MESSAGE_ACTIONS.EXPORT_STORAGE_SNAPSHOT
      || action === MESSAGE_ACTIONS.IMPORT_STORAGE_SNAPSHOT
    );
    const requiresCurrentPasscode = authPolicy?.requirePasscode || transfersSecrets;
    if (!requiresCurrentPasscode || !authPolicy?.masterPasscodeHash) {
      return { authorized: true, error: null };
    }

    const passcode = resolveDestructiveActionPasscode(request);
    if (!String(passcode || '').trim()) {
      return { authorized: false, error: 'RESET_AUTH_REQUIRED' };
    }
    let verified = false;
    try {
      verified = await verifyPasscodeStrict(passcode, authPolicy.masterPasscodeHash);
    } catch (error) {
      if (error?.code === 'PASSCODE_HASH_INVALID' || error?.message === 'PASSCODE_HASH_INVALID') {
        return { authorized: false, error: 'RESET_AUTH_HASH_INVALID' };
      }
      throw error;
    }
    if (!verified) {
      return { authorized: false, error: 'RESET_AUTH_FAILED' };
    }

    return { authorized: true, error: null };
  };

  return {
    authorizeDestructiveRuntimeAction,
  };
}
