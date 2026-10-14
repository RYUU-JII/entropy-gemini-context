export const SECURITY_VAULT_SESSION_INVALIDATED_EVENT = 'entropy:security-vault-session-invalidated';

export function isChangedVaultSessionFailure(code) {
  return code === 'SECURITY_VAULT_PASSPHRASE_CHANGED_SESSION_COMMIT_FAILED'
    || code === 'SECURITY_VAULT_PASSPHRASE_CHANGED_SESSION_CLEAR_FAILED'
    || code === 'SECURITY_VAULT_PASSPHRASE_REMOVAL_COMMIT_FAILED';
}

export function publishVaultSessionFailure(code) {
  if (isChangedVaultSessionFailure(code)) {
    window.dispatchEvent(new CustomEvent(SECURITY_VAULT_SESSION_INVALIDATED_EVENT, { detail: code }));
  }
}
