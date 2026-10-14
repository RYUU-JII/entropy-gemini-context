import { useCallback, useEffect, useRef, useState } from 'react';
import { requestEmbeddedMediaOriginPermissionStrict } from '../../../platform/security/capabilityGate.js';
import { getPopupMediaSupport } from './popupMediaSupportClient.js';

const EMPTY_STATE = Object.freeze({ status: 'unavailable', result: null, errorCode: null });

export function usePopupMediaSupport({
  tabId,
  querySupport = getPopupMediaSupport,
  requestPermission = requestEmbeddedMediaOriginPermissionStrict,
} = {}) {
  const [state, setState] = useState(EMPTY_STATE);
  const [permission, setPermission] = useState({ status: 'idle', origin: null, errorCode: null });
  const owner = useRef({ mounted: false, tabId: null, epoch: 0, request: null, permissionPending: false });

  const refresh = useCallback(() => {
    const lifetime = owner.current;
    if (!lifetime.mounted || lifetime.tabId !== tabId) return Promise.resolve(null);
    if (lifetime.request) return lifetime.request;
    const epoch = ++lifetime.epoch;
    setState((previous) => ({ ...previous, status: 'loading', errorCode: null }));
    const request = Promise.resolve().then(() => querySupport(tabId)).then((result) => {
      if (lifetime.mounted && lifetime.epoch === epoch) setState({ status: 'ready', result, errorCode: null });
      return result;
    }).catch((error) => {
      if (lifetime.mounted && lifetime.epoch === epoch) {
        setState({ status: 'failed', result: null, errorCode: error.message });
      }
      return null;
    }).finally(() => {
      if (lifetime.request === request) lifetime.request = null;
    });
    lifetime.request = request;
    return request;
  }, [tabId, querySupport]);

  useEffect(() => {
    const lifetime = { mounted: Number.isInteger(tabId) && tabId >= 0, tabId, epoch: 0, request: null, permissionPending: false };
    owner.current = lifetime;
    setState(EMPTY_STATE);
    setPermission({ status: 'idle', origin: null, errorCode: null });
    if (lifetime.mounted) void refresh();
    const stop = () => { lifetime.mounted = false; lifetime.epoch += 1; };
    globalThis.window?.addEventListener('pagehide', stop);
    return () => {
      stop();
      globalThis.window?.removeEventListener('pagehide', stop);
    };
  }, [tabId, refresh]);

  const requestOrigin = useCallback(async (origin) => {
    const lifetime = owner.current;
    if (!lifetime.mounted || lifetime.tabId !== tabId || lifetime.permissionPending) return false;
    if (state.status !== 'ready' || !state.result.requiredOrigins.includes(origin)) {
      setPermission({ status: 'failed', origin: null, errorCode: 'POPUP_MEDIA_PERMISSION_ORIGIN_NOT_REQUIRED' });
      return false;
    }
    lifetime.permissionPending = true;
    setPermission({ status: 'requesting', origin, errorCode: null });
    try {
      // Keep this call in the user's click stack; only its result is awaited.
      const granted = await requestPermission(origin);
      if (typeof granted !== 'boolean') throw new Error('POPUP_MEDIA_PERMISSION_RESULT_INVALID');
      if (!lifetime.mounted || owner.current !== lifetime) return granted;
      setPermission({ status: granted ? 'granted' : 'denied', origin, errorCode: null });
      lifetime.epoch += 1;
      lifetime.request = null;
      await refresh();
      return granted;
    } catch (error) {
      if (lifetime.mounted && owner.current === lifetime) {
        setPermission({ status: 'failed', origin, errorCode: error.message });
      }
      return false;
    } finally { lifetime.permissionPending = false; }
  }, [tabId, state, requestPermission, refresh]);

  return {
    ...state, permission, available: Number.isInteger(tabId) && tabId >= 0,
    refresh, requestOrigin,
  };
}
