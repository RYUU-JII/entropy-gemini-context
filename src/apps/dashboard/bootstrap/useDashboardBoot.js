import { useEffect, useState } from 'react';
import {
  ensureBootSequenceStarted,
  getBootSnapshot,
  subscribeBootState,
} from './bootManager.js';

export function useDashboardBoot({
  initializePreference,
  initializeProtocol,
  initializeCLSE,
  initializeAnalysis,
} = {}) {
  const [bootState, setBootState] = useState(() => getBootSnapshot());

  useEffect(() => {
    const unsubscribe = subscribeBootState(setBootState);
    void ensureBootSequenceStarted({
      initializePreference,
      initializeProtocol,
      initializeCLSE,
      initializeAnalysis,
    });
    return unsubscribe;
  }, [
    initializePreference,
    initializeProtocol,
    initializeCLSE,
    initializeAnalysis,
  ]);

  return bootState;
}
