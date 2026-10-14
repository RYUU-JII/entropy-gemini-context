import { useCallback, useEffect, useState } from 'react';

import { AI_AVAILABILITY_STATES } from '@/domains/ai/index.js';
import { getDashboardAiCapability } from './dashboardAiClient.js';

const INITIAL_CAPABILITY = Object.freeze({
  providerId: '',
  state: AI_AVAILABILITY_STATES.UNAVAILABLE,
  reasonCode: 'not_checked',
  details: null,
  canCreateSession: false,
  requiresUserActivation: false,
});

function createCapabilityCheckError(error) {
  return Object.freeze({
    providerId: '',
    state: AI_AVAILABILITY_STATES.ERROR,
    reasonCode: 'capability_check_failed',
    details: Object.freeze({
      name: error?.name || '',
      message: error?.message || '',
    }),
    canCreateSession: false,
    requiresUserActivation: false,
  });
}

export function useAiCapability({
  enabled = true,
  taskId,
  locale = 'en',
} = {}) {
  const [capability, setCapability] = useState(INITIAL_CAPABILITY);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setCapability(INITIAL_CAPABILITY);
      return INITIAL_CAPABILITY;
    }
    setChecking(true);
    try {
      const nextCapability = await getDashboardAiCapability({ taskId, locale });
      setCapability(nextCapability);
      return nextCapability;
    } catch (error) {
      const nextCapability = createCapabilityCheckError(error);
      setCapability(nextCapability);
      return nextCapability;
    } finally {
      setChecking(false);
    }
  }, [enabled, locale, taskId]);

  useEffect(() => {
    let cancelled = false;
    if (!enabled) {
      setCapability(INITIAL_CAPABILITY);
      return () => {
        cancelled = true;
      };
    }
    setChecking(true);
    getDashboardAiCapability({ taskId, locale })
      .then((nextCapability) => {
        if (!cancelled) setCapability(nextCapability);
      })
      .catch((error) => {
        if (!cancelled) setCapability(createCapabilityCheckError(error));
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, locale, taskId]);

  return {
    capability,
    checking,
    refresh,
  };
}
