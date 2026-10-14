import { SETTINGS_SECURITY_KEYS } from '../../../domains/settings/config/settingsCommandContract.js';
import { isCanonicalPasscodeHash, verifyPasscodeStrict } from '../../../platform/security/passcode.js';
import { normalizeSecuritySettingsSnapshot } from '../../../platform/storage/security/SecuritySettingsQueryService.js';

const SECURITY_KEYS = Object.freeze(Object.values(SETTINGS_SECURITY_KEYS));

export function hasSecuritySettingsMutation(items) {
  return SECURITY_KEYS.some((key) => Object.hasOwn(items, key));
}

function reject(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

// Called inside the settings mutation lane, against the latest committed state.
// Passcode proof is transient request metadata; it never becomes a setting.
export async function assertSecuritySettingsMutationAuthorized({
  items,
  currentSettings,
  authorization = null,
}) {
  if (!hasSecuritySettingsMutation(items)) return;

  const current = normalizeSecuritySettingsSnapshot(currentSettings);
  const next = normalizeSecuritySettingsSnapshot({ ...current, ...items });
  if (next.masterPasscodeHash && !isCanonicalPasscodeHash(next.masterPasscodeHash)) {
    reject('PASSCODE_HASH_INVALID');
  }
  if (next.highSecurityMode && !next.masterPasscodeHash) {
    reject('HIGH_SECURITY_PASSCODE_REQUIRED');
  }
  if (next.highSecurityMode && !next.requirePasscodeForReset) {
    reject('HIGH_SECURITY_RESET_GUARD_REQUIRED');
  }

  const needsCurrentPasscode = current.masterPasscodeHash.length > 0 && (
    next.masterPasscodeHash !== current.masterPasscodeHash
    || (current.requirePasscodeForReset && !next.requirePasscodeForReset)
    || (current.highSecurityMode && !next.highSecurityMode)
  );
  if (!needsCurrentPasscode) return;
  if (
    authorization?.kind !== 'passcode'
    || typeof authorization.passcode !== 'string'
    || !authorization.passcode.trim()
  ) {
    reject('SECURITY_SETTINGS_AUTH_REQUIRED');
  }
  if (!await verifyPasscodeStrict(authorization.passcode, current.masterPasscodeHash)) {
    reject('SECURITY_SETTINGS_AUTH_FAILED');
  }
}
