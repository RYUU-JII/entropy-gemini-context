import { SETTINGS_SECURITY_KEYS } from '../../../domains/settings/config/settingsCommandContract.js';
import { createPlatformSettingsQueryService } from '../settings/SettingsQueryService.js';

export const MASTER_PASSCODE_KEY = SETTINGS_SECURITY_KEYS.MASTER_PASSCODE;
export const RESET_GUARD_KEY = SETTINGS_SECURITY_KEYS.RESET_GUARD;
export const HIGH_SECURITY_MODE_KEY = SETTINGS_SECURITY_KEYS.HIGH_SECURITY_MODE;

export const DEFAULT_SECURITY_SETTINGS = Object.freeze({
  [MASTER_PASSCODE_KEY]: '',
  [RESET_GUARD_KEY]: true,
  [HIGH_SECURITY_MODE_KEY]: false,
});

export const SECURITY_SETTINGS_ERROR_CODES = Object.freeze({
  SNAPSHOT_INVALID: 'SECURITY_SETTINGS_SNAPSHOT_INVALID',
});

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function describeSecurityValueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function createSecuritySettingsSnapshotError(extra = {}) {
  const error = new Error(SECURITY_SETTINGS_ERROR_CODES.SNAPSHOT_INVALID);
  error.code = SECURITY_SETTINGS_ERROR_CODES.SNAPSHOT_INVALID;
  Object.assign(error, extra);
  return error;
}

function requireSecuritySnapshotObject(snapshot) {
  if (isPlainObject(snapshot)) return snapshot;
  throw createSecuritySettingsSnapshotError({
    key: null,
    valueType: describeSecurityValueType(snapshot),
  });
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function readSecurityString(source, key, fallback) {
  if (!hasOwn(source, key)) return fallback;
  const value = source[key];
  if (typeof value === 'string') return value;
  throw createSecuritySettingsSnapshotError({
    key,
    valueType: describeSecurityValueType(value),
    expectedType: 'string',
  });
}

function readSecurityBoolean(source, key, fallback) {
  if (!hasOwn(source, key)) return fallback;
  const value = source[key];
  if (typeof value === 'boolean') return value;
  throw createSecuritySettingsSnapshotError({
    key,
    valueType: describeSecurityValueType(value),
    expectedType: 'boolean',
  });
}

export function normalizeSecuritySettingsSnapshot(snapshot = {}) {
  const resolved = requireSecuritySnapshotObject(snapshot);
  const masterPasscodeHash = readSecurityString(
    resolved,
    MASTER_PASSCODE_KEY,
    DEFAULT_SECURITY_SETTINGS[MASTER_PASSCODE_KEY],
  );
  const requirePasscodeForReset = readSecurityBoolean(
    resolved,
    RESET_GUARD_KEY,
    DEFAULT_SECURITY_SETTINGS[RESET_GUARD_KEY],
  );
  const highSecurityMode = readSecurityBoolean(
    resolved,
    HIGH_SECURITY_MODE_KEY,
    DEFAULT_SECURITY_SETTINGS[HIGH_SECURITY_MODE_KEY],
  );

  return {
    masterPasscodeHash,
    requirePasscodeForReset,
    highSecurityMode,
  };
}

export function deriveDestructiveActionAuthPolicy(snapshot = {}) {
  const security = normalizeSecuritySettingsSnapshot(snapshot);
  const masterPasscodeHash = security.masterPasscodeHash.trim();

  return {
    highSecurityMode: security.highSecurityMode,
    masterPasscodeHash,
    passcodeConfigured: masterPasscodeHash.length > 0,
    requirePasscodeForReset: security.requirePasscodeForReset,
    requirePasscode: (security.highSecurityMode || security.requirePasscodeForReset) && masterPasscodeHash.length > 0,
    blockedByMissingHighSecurityPasscode: security.highSecurityMode && masterPasscodeHash.length === 0,
  };
}

export class SecuritySettingsQueryService {
  constructor({
    settingsQueryService = createPlatformSettingsQueryService(),
  } = {}) {
    this.settingsQueryService = settingsQueryService;
  }

  static getInstance() {
    if (!SecuritySettingsQueryService.instance) {
      SecuritySettingsQueryService.instance = new SecuritySettingsQueryService();
    }
    return SecuritySettingsQueryService.instance;
  }

  async readSecuritySettings() {
    const snapshot = await this.settingsQueryService.readSnapshot(DEFAULT_SECURITY_SETTINGS);
    return normalizeSecuritySettingsSnapshot(snapshot);
  }

  async readDestructiveActionAuthPolicy() {
    const security = await this.readSecuritySettings();
    return deriveDestructiveActionAuthPolicy(security);
  }
}

export async function readSecuritySettings() {
  return SecuritySettingsQueryService.getInstance().readSecuritySettings();
}

export async function readDestructiveActionAuthPolicy() {
  return SecuritySettingsQueryService.getInstance().readDestructiveActionAuthPolicy();
}

export default SecuritySettingsQueryService;
