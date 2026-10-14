import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  requireProgressionUnlockSnapshot,
} from '../../../domains/progression/policy/progressionUnlockPolicy.js';
import { claimBonsaiFirstBloom } from './bonsaiFirstBloomClient.js';
import { usePrefersReducedMotion } from '../../../ui-kit/hooks/usePrefersReducedMotion.js';
import {
  ZEN_BONSAI_FIRST_BLOOM_DURATION_MS,
  ZEN_BONSAI_FIRST_BLOOM_FULL_MASK,
  requireZenBonsaiFirstBloomRegionId,
} from '@/themes/plugins/zen/api/bonsaiFirstBloom.js';
import {
  isDashboardPresentationForeground,
  useDashboardPresentationAdmission,
} from '../presentation/DashboardPresentationAdmission.jsx';

export const BONSAI_FIRST_BLOOM_DURATION_MS = ZEN_BONSAI_FIRST_BLOOM_DURATION_MS;

function describeClaimError(error) {
  const code = typeof error?.code === 'string' && error.code
    ? error.code
    : error instanceof Error && error.message ? error.message : 'BONSAI_FIRST_BLOOM_CLAIM_FAILED';
  return Object.freeze({ code, retryable: true });
}

// This hook owns only the click-driven presentation lifetime. Canonical release
// and its once-only claim remain with progression; elapsed time stays in the
// existing renderer's active clock.
export function useBonsaiFirstBloom({
  unlockProgress = null,
  ready = false,
  sceneCommitKey = null,
} = {}) {
  const admission = useDashboardPresentationAdmission();
  const snapshot = unlockProgress === null
    ? null : requireProgressionUnlockSnapshot(unlockProgress);
  const candidate = snapshot !== null
    && snapshot.debugOverrideActive === false
    && snapshot.bonsaiRelease.fullFormReady;
  const eventId = candidate && typeof sceneCommitKey === 'string' && sceneCommitKey
    ? `${sceneCommitKey}:bonsai-first-bloom` : null;
  const reducedMotion = usePrefersReducedMotion();
  const [session, setSession] = useState(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const contextRef = useRef({ eventId, generation: 0 });
  if (contextRef.current.eventId !== eventId) {
    contextRef.current = { eventId, generation: contextRef.current.generation + 1 };
  }
  const mountedRef = useRef(false);
  const requestRef = useRef(null);
  const inputsRef = useRef(null);
  const admitted = ready === true && admission.contextualPresentationAllowed;
  inputsRef.current = { eventId, admitted, reducedMotion, eligible: snapshot?.bonsaiFirstBloom.eligible === true };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current = null;
    };
  }, []);

  const handleActivate = useCallback(async (regionId) => {
    const bit = 1 << requireZenBonsaiFirstBloomRegionId(regionId);
    const inputs = inputsRef.current;
    const currentSession = sessionRef.current?.eventId === inputs.eventId
      ? sessionRef.current : null;
    if (!inputs.eventId || inputs.admitted !== true || !isDashboardPresentationForeground()
      || requestRef.current !== null
      || ['claiming', 'complete'].includes(currentSession?.phase)) return false;
    if (currentSession?.phase === 'playing') {
      if ((currentSession.activatedMask & bit) !== 0) return false;
      const next = { ...currentSession, activatedMask: currentSession.activatedMask | bit };
      sessionRef.current = next;
      setSession(next);
      return true;
    }
    if (!inputs.eligible) return false;

    const request = { ...contextRef.current };
    requestRef.current = request;
    const claiming = { eventId: inputs.eventId, phase: 'claiming', activatedMask: 0, error: null };
    sessionRef.current = claiming;
    setSession(claiming);
    const stillCurrent = () => mountedRef.current
      && requestRef.current === request
      && contextRef.current.eventId === request.eventId
      && contextRef.current.generation === request.generation;
    try {
      const result = await claimBonsaiFirstBloom();
      if (!stillCurrent()) return false;
      if (result?.opened !== true || typeof result.newlyOpened !== 'boolean') {
        throw new Error('BONSAI_FIRST_BLOOM_CLAIM_ACK_INVALID');
      }
      const next = { eventId: request.eventId,
        phase: result.newlyOpened ? 'playing' : 'complete',
        activatedMask: result.newlyOpened ? bit : ZEN_BONSAI_FIRST_BLOOM_FULL_MASK, error: null };
      sessionRef.current = next;
      setSession(next);
      return result.newlyOpened;
    } catch (error) {
      if (!stillCurrent()) return false;
      const next = { eventId: request.eventId, phase: 'pending', activatedMask: 0, error: describeClaimError(error) };
      sessionRef.current = next;
      setSession(next);
      return false;
    } finally {
      if (requestRef.current === request) requestRef.current = null;
    }
  }, []);

  const handlePlaybackComplete = useCallback((metadata = null) => {
    const current = sessionRef.current;
    if (!mountedRef.current || !current || current.phase !== 'playing'
      || metadata?.eventId !== current.eventId
      || inputsRef.current.eventId !== current.eventId
      || metadata.completedMask !== ZEN_BONSAI_FIRST_BLOOM_FULL_MASK) return false;
    if (metadata.reason !== 'tree_identity_changed'
      && (metadata.reason !== 'finished'
        || current.activatedMask !== ZEN_BONSAI_FIRST_BLOOM_FULL_MASK)) return false;
    const next = { ...current, phase: 'complete' };
    sessionRef.current = next;
    setSession(next);
    return true;
  }, []);

  const current = session?.eventId === eventId ? session : null;
  // A refresh can publish the claimed receipt before its claim Promise settles.
  // Keep the closed pose until that request tells us whether this tab won.
  const ownsPresentation = current?.phase === 'claiming' || current?.phase === 'playing';
  const pending = eventId !== null && current?.phase !== 'complete'
    && (snapshot.bonsaiFirstBloom.eligible || ownsPresentation);
  const playing = pending && current?.phase === 'playing';
  const activatedMask = playing ? current.activatedMask : 0;
  const rendererPresentation = useMemo(() => pending ? Object.freeze({
    eventId,
    phase: playing ? 'playing' : 'pending',
    active: admitted,
    durationMs: BONSAI_FIRST_BLOOM_DURATION_MS,
    activatedMask,
    reducedMotion,
  }) : null, [activatedMask, admitted, eventId, pending, playing, reducedMotion]);
  const promptProps = useMemo(() => Object.freeze({
    visible: pending && admitted,
    disabled: current?.phase === 'claiming',
    activatedMask,
    error: current?.error ?? null,
    onActivate: handleActivate,
  }), [activatedMask, admitted, current?.error, current?.phase, handleActivate, pending]);

  return { rendererPresentation, promptProps, handlePlaybackComplete, suppressGrowthReveal: candidate };
}
