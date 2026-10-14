import { useCallback, useEffect, useRef, useState } from 'react';
import { preloadDashboardTabIntent } from '@/apps/dashboard/loading/preloadDashboardTab.js';

export const GARDEN_POND_RESUME_DEADLINE_MS = 15000;

// Routes remain the sole committed mode. This owner holds only an uncommitted
// request and fences asynchronous preparation when a newer request takes over.
export function useGardenModeTransition({
  mode, enabled, pathwaysAvailable, locked, sceneCommitKey, onTabChange,
}) {
  const [request, setRequest] = useState(null);
  const [error, setError] = useState(null);
  const generationRef = useRef(0);
  const requestRef = useRef(null);
  const currentRef = useRef(null);
  currentRef.current = { mode, enabled, pathwaysAvailable, locked, sceneCommitKey, onTabChange };
  const cancel = useCallback(() => {
    generationRef.current += 1;
    requestRef.current = null;
    setRequest(null);
  }, []);
  useEffect(() => {
    if (!enabled || locked || request?.target === mode) cancel();
  }, [cancel, enabled, locked, mode, request?.target]);
  useEffect(() => () => { generationRef.current += 1; requestRef.current = null; }, []);

  const preparePondReturn = useCallback(() => {
    const current = currentRef.current;
    if (!current.enabled || current.locked || current.mode !== 'pathways') return;
    const existing = requestRef.current;
    if (existing?.target === 'pond' && existing.sceneCommitKey === current.sceneCommitKey) return;
    cancel();
    setError(null);
    const pending = {
      generation: generationRef.current,
      target: 'pond',
      phase: 'gesture',
      presentationReady: false,
      sceneCommitKey: current.sceneCommitKey,
    };
    requestRef.current = pending;
    setRequest(pending);
  }, [cancel]);

  const cancelPondPreparation = useCallback(() => {
    if (requestRef.current?.target === 'pond' && requestRef.current.phase === 'gesture') cancel();
  }, [cancel]);

  const requestMode = useCallback(async (target) => {
    if (target !== 'pond' && target !== 'pathways') throw new Error('GARDEN_MODE_REQUIRED');
    const current = currentRef.current;
    if (!current.enabled || current.locked || (target === 'pathways' && !current.pathwaysAvailable)) return;
    const prepared = requestRef.current;
    if (target === 'pond' && prepared?.target === 'pond'
      && prepared.generation === generationRef.current && prepared.sceneCommitKey === current.sceneCommitKey) {
      if (prepared.presentationReady) {
        current.onTabChange('main', null);
        cancel();
      } else if (prepared.phase !== 'commit') {
        const promoted = { ...prepared, phase: 'commit' };
        requestRef.current = promoted;
        setRequest(promoted);
      }
      return;
    }
    cancel();
    setError(null);
    if (target === current.mode) {
      if (target === 'pathways') current.onTabChange('sites', { view: 'ledger' });
      return;
    }
    const pending = {
      generation: generationRef.current, target, phase: 'commit', presentationReady: false,
      sceneCommitKey: current.sceneCommitKey,
    };
    requestRef.current = pending;
    setRequest(pending);
    if (target === 'pond') return; // Actual Pond owner receipt commits this request.
    try {
      await preloadDashboardTabIntent({ tabId: 'sites', themeId: 'zen' });
      const latest = currentRef.current;
      if (requestRef.current !== pending || generationRef.current !== pending.generation) return;
      if (!latest.enabled || latest.locked || !latest.pathwaysAvailable) { cancel(); return; }
      latest.onTabChange('sites', { view: 'ledger' });
      cancel();
    } catch (failure) {
      if (requestRef.current !== pending || generationRef.current !== pending.generation) return;
      setError({ target, cause: failure });
      cancel();
    }
  }, [cancel]);

  const acceptPondPresentation = useCallback((metadata) => {
    const pending = requestRef.current;
    const latest = currentRef.current;
    if (!pending || pending.target !== 'pond' || pending.generation !== generationRef.current
      || !latest.enabled || latest.locked || pending.sceneCommitKey !== latest.sceneCommitKey
      || metadata?.sceneCommitKey !== pending.sceneCommitKey) return;
    if (pending.phase === 'gesture') {
      if (!pending.presentationReady) {
        const prepared = { ...pending, presentationReady: true };
        requestRef.current = prepared;
        setRequest(prepared);
      }
      return;
    }
    latest.onTabChange('main', null);
    cancel();
  }, [cancel]);

  useEffect(() => {
    if (request?.target !== 'pond') return undefined;
    const generation = request.generation;
    const timer = setTimeout(() => {
      const pending = requestRef.current;
      if (pending?.generation !== generation || pending?.target !== 'pond') return;
      // This is a presentation deadline, not a limit on how long a user can
      // hold an already-prepared paper edge before releasing it.
      if (pending.presentationReady && pending.sceneCommitKey === currentRef.current.sceneCommitKey) return;
      setError({ target: 'pond', cause: new Error('GARDEN_POND_RESUME_TIMEOUT') });
      cancel();
    }, GARDEN_POND_RESUME_DEADLINE_MS);
    return () => clearTimeout(timer);
  }, [cancel, request?.generation, request?.target]);

  return {
    pendingMode: request?.target || null,
    error,
    requestMode,
    preparePondReturn,
    cancelPondPreparation,
    pondPresentationReady: enabled && !locked && request?.target === 'pond'
      && request.presentationReady === true && request.sceneCommitKey === sceneCommitKey,
    acceptPondPresentation,
    retry: () => { if (error) void requestMode(error.target); },
  };
}
