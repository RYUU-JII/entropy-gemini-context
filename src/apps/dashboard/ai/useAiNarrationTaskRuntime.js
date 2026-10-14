import { useCallback, useEffect, useRef, useState } from 'react';

import {
  AI_AVAILABILITY_STATES,
  AI_PREPARATION_STATUS,
  AI_RESULT_STATUS,
} from '@/domains/ai/index.js';
import {
  EMPTY_AI_DOWNLOAD_PROGRESS,
  resolveAiDownloadProgress,
} from './aiNarrationProgress.js';
import { useAiCapability } from './useAiCapability.js';

export const AI_NARRATION_GENERATION_PHASES = Object.freeze({
  IDLE: 'idle',
  GENERATING: 'generating',
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
  ERROR: 'error',
});

export const AI_NARRATION_PREPARATION_PHASES = Object.freeze({
  IDLE: 'idle',
  PREPARING: 'preparing',
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
  ERROR: 'error',
});

const NOT_READY = Object.freeze({ ready: false, reasonCode: 'readiness_missing' });

function isCapabilityUnavailable(capability) {
  const state = capability?.state;
  return state === AI_AVAILABILITY_STATES.UNAVAILABLE
    || state === AI_AVAILABILITY_STATES.DISABLED
    || state === AI_AVAILABILITY_STATES.ERROR;
}

function isPreparationAvailability(availability) {
  const state = availability?.state;
  return state === AI_AVAILABILITY_STATES.DOWNLOADABLE
    || state === AI_AVAILABILITY_STATES.DOWNLOADING;
}

function createInitialGenerationState() {
  return {
    phase: AI_NARRATION_GENERATION_PHASES.IDLE,
    result: null,
    errorCode: '',
    errorMessage: '',
    availability: null,
    resultSignature: '',
    downloadProgress: EMPTY_AI_DOWNLOAD_PROGRESS,
  };
}

function createInitialPreparationState() {
  return {
    phase: AI_NARRATION_PREPARATION_PHASES.IDLE,
    errorCode: '',
    errorMessage: '',
    availability: null,
    downloadProgress: EMPTY_AI_DOWNLOAD_PROGRESS,
    preparedAt: 0,
  };
}

function resolveRuntimeErrorCode(error, fallback) {
  if (typeof error?.code === 'string' && error.code.trim()) {
    return error.code.trim();
  }
  if (typeof error?.name === 'string' && error.name.trim() && error.name !== 'Error') {
    return error.name.trim();
  }
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
}

function requirePreparedAt(result) {
  const preparedAt = Number(result?.metadata?.preparedAt);
  if (!Number.isFinite(preparedAt) || preparedAt < 0) {
    throw new Error('AI_PREPARATION_RESULT_INVALID');
  }
  return preparedAt;
}

export function useAiNarrationTaskRuntime({
  enabled = true,
  taskId,
  locale = 'en',
  readiness = NOT_READY,
  inputSignature = '',
  generateNarration,
  prepareNarration,
} = {}) {
  const abortControllerRef = useRef(null);
  const prepareAbortControllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const prepareRequestIdRef = useRef(0);
  const inputSignatureRef = useRef('');
  const normalizedReadiness = readiness && typeof readiness === 'object' ? readiness : NOT_READY;
  const capabilityState = useAiCapability({
    enabled: enabled && normalizedReadiness.ready,
    taskId,
    locale,
  });
  const refreshCapability = capabilityState.refresh;
  const [generationState, setGenerationState] = useState(createInitialGenerationState);
  const [preparationState, setPreparationState] = useState(createInitialPreparationState);

  useEffect(() => {
    inputSignatureRef.current = inputSignature;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setGenerationState(createInitialGenerationState());
  }, [inputSignature]);

  useEffect(() => () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (prepareAbortControllerRef.current) {
      prepareAbortControllerRef.current.abort();
      prepareAbortControllerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    if (!abortControllerRef.current) return;
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
    requestIdRef.current += 1;
    setGenerationState(createInitialGenerationState());
  }, []);

  const cancelPreparation = useCallback(() => {
    if (!prepareAbortControllerRef.current) return;
    prepareAbortControllerRef.current.abort();
    prepareAbortControllerRef.current = null;
    prepareRequestIdRef.current += 1;
    setPreparationState(createInitialPreparationState());
  }, []);

  const prepare = useCallback(async () => {
    if (!enabled || !normalizedReadiness.ready) return null;
    if (prepareAbortControllerRef.current) {
      prepareAbortControllerRef.current.abort();
    }

    const requestId = prepareRequestIdRef.current + 1;
    prepareRequestIdRef.current = requestId;
    const abortController = new AbortController();
    prepareAbortControllerRef.current = abortController;
    setPreparationState({
      ...createInitialPreparationState(),
      phase: AI_NARRATION_PREPARATION_PHASES.PREPARING,
    });

    const monitor = (monitorTarget) => {
      if (!monitorTarget || typeof monitorTarget.addEventListener !== 'function') return;
      monitorTarget.addEventListener('downloadprogress', (event) => {
        if (prepareRequestIdRef.current !== requestId) return;
        setPreparationState((current) => ({
          ...current,
          downloadProgress: resolveAiDownloadProgress(event),
        }));
      });
    };

    try {
      const result = await prepareNarration({
        locale,
        signal: abortController.signal,
        monitor,
      });
      if (prepareRequestIdRef.current !== requestId) return null;
      if (result?.status === AI_PREPARATION_STATUS.OK) {
        const preparedAt = requirePreparedAt(result);
        setPreparationState({
          ...createInitialPreparationState(),
          phase: AI_NARRATION_PREPARATION_PHASES.READY,
          preparedAt,
        });
        await refreshCapability();
        return result;
      }
      if (result?.status === AI_PREPARATION_STATUS.UNAVAILABLE) {
        setPreparationState({
          ...createInitialPreparationState(),
          phase: AI_NARRATION_PREPARATION_PHASES.UNAVAILABLE,
          availability: result.metadata?.availability || null,
          errorCode: result.metadata?.availability?.reasonCode || 'ai_unavailable',
        });
        await refreshCapability();
        return result;
      }
      if (result?.error?.code === 'AbortError') {
        setPreparationState(createInitialPreparationState());
        return result;
      }
      setPreparationState({
        ...createInitialPreparationState(),
        phase: AI_NARRATION_PREPARATION_PHASES.ERROR,
        errorCode: result?.error?.code || 'ai_preparation_failed',
        errorMessage: result?.error?.message || '',
      });
      await refreshCapability();
      return result;
    } catch (error) {
      if (prepareRequestIdRef.current !== requestId || abortController.signal.aborted) {
        setPreparationState(createInitialPreparationState());
        return null;
      }
      setPreparationState({
        ...createInitialPreparationState(),
        phase: AI_NARRATION_PREPARATION_PHASES.ERROR,
        errorCode: resolveRuntimeErrorCode(error, 'ai_preparation_failed'),
        errorMessage: error?.message || '',
      });
      await refreshCapability();
      return null;
    } finally {
      if (prepareAbortControllerRef.current === abortController) {
        prepareAbortControllerRef.current = null;
      }
    }
  }, [enabled, locale, normalizedReadiness.ready, prepareNarration, refreshCapability]);

  const generate = useCallback(async () => {
    if (!enabled || !normalizedReadiness.ready || !inputSignature) return null;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setGenerationState({
      ...createInitialGenerationState(),
      phase: AI_NARRATION_GENERATION_PHASES.GENERATING,
    });

    const monitor = (monitorTarget) => {
      if (!monitorTarget || typeof monitorTarget.addEventListener !== 'function') return;
      monitorTarget.addEventListener('downloadprogress', (event) => {
        if (requestIdRef.current !== requestId) return;
        setGenerationState((current) => ({
          ...current,
          downloadProgress: resolveAiDownloadProgress(event),
        }));
      });
    };

    try {
      const result = await generateNarration({
        locale,
        signal: abortController.signal,
        monitor,
      });
      if (requestIdRef.current !== requestId || inputSignatureRef.current !== inputSignature) {
        return null;
      }
      if (result?.status === AI_RESULT_STATUS.OK) {
        setGenerationState({
          ...createInitialGenerationState(),
          phase: AI_NARRATION_GENERATION_PHASES.READY,
          result: result.output,
          resultSignature: inputSignature,
        });
        return result;
      }
      if (result?.status === AI_RESULT_STATUS.UNAVAILABLE) {
        const availability = result.metadata?.availability || null;
        if (isPreparationAvailability(availability)) {
          setGenerationState(createInitialGenerationState());
          await refreshCapability();
          return result;
        }
        setGenerationState({
          ...createInitialGenerationState(),
          phase: AI_NARRATION_GENERATION_PHASES.UNAVAILABLE,
          availability,
          errorCode: availability?.reasonCode || 'ai_unavailable',
        });
        await refreshCapability();
        return result;
      }
      if (result?.error?.code === 'AbortError') {
        setGenerationState(createInitialGenerationState());
        return result;
      }
      setGenerationState({
        ...createInitialGenerationState(),
        phase: AI_NARRATION_GENERATION_PHASES.ERROR,
        errorCode: result?.error?.code || 'ai_generation_failed',
        errorMessage: result?.error?.message || '',
      });
      await refreshCapability();
      return result;
    } catch (error) {
      if (requestIdRef.current !== requestId || abortController.signal.aborted) {
        setGenerationState(createInitialGenerationState());
        return null;
      }
      setGenerationState({
        ...createInitialGenerationState(),
        phase: AI_NARRATION_GENERATION_PHASES.ERROR,
        errorCode: resolveRuntimeErrorCode(error, 'ai_generation_failed'),
        errorMessage: error?.message || '',
      });
      await refreshCapability();
      return null;
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, [enabled, generateNarration, inputSignature, locale, normalizedReadiness.ready, refreshCapability]);

  const checkingCapability = capabilityState.checking
    || capabilityState.capability?.reasonCode === 'not_checked';
  const capabilityUnavailable = !checkingCapability && isCapabilityUnavailable(capabilityState.capability);
  const capabilityReadyForGeneration = capabilityState.capability?.state === AI_AVAILABILITY_STATES.AVAILABLE;
  const canGenerate = enabled
    && normalizedReadiness.ready
    && !!inputSignature
    && generationState.phase !== AI_NARRATION_GENERATION_PHASES.GENERATING
    && preparationState.phase !== AI_NARRATION_PREPARATION_PHASES.PREPARING
    && !checkingCapability
    && !capabilityUnavailable
    && capabilityReadyForGeneration;
  const canPrepare = enabled
    && normalizedReadiness.ready
    && preparationState.phase !== AI_NARRATION_PREPARATION_PHASES.PREPARING
    && generationState.phase !== AI_NARRATION_GENERATION_PHASES.GENERATING
    && !checkingCapability
    && (capabilityState.capability?.state === AI_AVAILABILITY_STATES.DOWNLOADABLE
      || capabilityState.capability?.state === AI_AVAILABILITY_STATES.DOWNLOADING);

  return {
    capability: capabilityState.capability,
    checkingCapability,
    refreshCapability,
    readiness: normalizedReadiness,
    inputSignature,
    generation: generationState,
    preparation: preparationState,
    generate,
    prepare,
    cancel,
    cancelPreparation,
    canPrepare,
    canGenerate,
    phases: AI_NARRATION_GENERATION_PHASES,
    preparationPhases: AI_NARRATION_PREPARATION_PHASES,
  };
}
