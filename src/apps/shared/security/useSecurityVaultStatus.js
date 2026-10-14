import { useCallback, useEffect, useRef, useState } from 'react';
import { readSecurityVaultStatus } from './securityVaultClient.js';
import { isChangedVaultSessionFailure, SECURITY_VAULT_SESSION_INVALIDATED_EVENT } from './securityVaultStatusEvents.js';

export function useSecurityVaultStatus() {
  const [status, setStatus] = useState({ state: 'checking', mode: null });
  const [error, setError] = useState(null);
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const observedRevision = ++revision.current;
    try {
      const next = await readSecurityVaultStatus();
      if (observedRevision === revision.current) {
        setStatus(next);
        setError(null);
      }
      return next;
    } catch (failure) {
      if (observedRevision === revision.current) {
        setError(failure);
        setStatus({ state: 'failed', mode: null });
      }
      throw failure;
    }
  }, []);
  const publish = useCallback((next) => {
    revision.current += 1;
    setStatus(next);
    setError(null);
  }, []);
  useEffect(() => {
    const revalidate = () => { void refresh().catch(() => {}); };
    const invalidateSession = (event) => {
      if (!isChangedVaultSessionFailure(event.detail)) return;
      revision.current += 1;
      setStatus(current => current.mode === 'passphrase'
        ? { ...current, state: 'locked', protectionReady: current.lockScope === 'logs', reason: event.detail }
        : { state: 'checking', mode: null });
      revalidate();
    };
    revalidate();
    window.addEventListener('focus', revalidate);
    window.addEventListener(SECURITY_VAULT_SESSION_INVALIDATED_EVENT, invalidateSession);
    return () => {
      revision.current += 1;
      window.removeEventListener('focus', revalidate);
      window.removeEventListener(SECURITY_VAULT_SESSION_INVALIDATED_EVENT, invalidateSession);
    };
  }, [refresh, publish]);
  return { status, error, refresh, publish };
}
