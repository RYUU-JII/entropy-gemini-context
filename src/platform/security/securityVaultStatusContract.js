const STATES = new Set(['setup_required', 'incompatible', 'locked', 'unlocked']);
const FIELDS = ['state', 'version', 'mode', 'lockScope', 'protectionReady'];

export function requireSecurityVaultStatus(value) {
  const invalid = () => {
    const error = new Error('SECURITY_VAULT_STATUS_INVALID');
    error.code = error.message;
    throw error;
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const fields = Object.keys(value);
  if (FIELDS.some(key => !Object.hasOwn(value, key))
    || fields.some(key => !FIELDS.includes(key) && key !== 'reason')
    || !STATES.has(value.state) || value.version !== 1) invalid();
  const unavailable = value.state === 'setup_required' || value.state === 'incompatible';
  const valid = unavailable
    ? value.mode === null && value.lockScope === null && value.protectionReady === false
    : value.mode === 'local'
      ? value.state === 'unlocked' && value.lockScope === null && value.protectionReady === true
      : value.mode === 'passphrase' && (
        (value.lockScope === 'logs' && value.protectionReady === true)
        || (value.lockScope === 'profile' && value.protectionReady === (value.state === 'unlocked'))
      );
  if (!valid) invalid();
  if (Object.hasOwn(value, 'reason') && (typeof value.reason !== 'string'
    || value.reason.length > 160 || !/^SECURITY_[A-Z0-9_]+$/u.test(value.reason)
    || !['locked', 'incompatible'].includes(value.state))) invalid();
  return { state: value.state, version: 1, mode: value.mode, lockScope: value.lockScope,
    protectionReady: value.protectionReady, ...(Object.hasOwn(value, 'reason') ? { reason: value.reason } : {}) };
}
