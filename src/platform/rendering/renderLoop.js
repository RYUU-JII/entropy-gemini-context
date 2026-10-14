const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function runRenderLoop({
  enabled = true,
  simHz = 60,
  targetFps = 60,
  maxCatchUpSteps = 30,
  maxElapsedMs = 250,
  frameScheduler = 'auto',
  pausedFrameIntervalMs = null,
  metricsLabel = '',
  metricsSampleIntervalMs = null,
  isPaused = null,
  pauseWhenDocumentHidden = false,
  respectReducedMotion = false,
  renderReducedMotionFrame = true,
  startupFrameWatchdogMs = null,
  isStartupFramePending = null,
  onStartupFrameSchedulerFallback = null,
  onPause = null,
  onSimStep = null,
  onRender = null,
  onMetrics = null,
}) {
  const startupFrameWatchdogRequested = (
    startupFrameWatchdogMs !== null
    || isStartupFramePending !== null
    || onStartupFrameSchedulerFallback !== null
  );
  if (startupFrameWatchdogRequested) {
    if (
      typeof startupFrameWatchdogMs !== 'number'
      || !Number.isFinite(startupFrameWatchdogMs)
      || startupFrameWatchdogMs <= 0
    ) {
      throw new Error('RENDER_LOOP_STARTUP_FRAME_WATCHDOG_MS_INVALID');
    }
    if (typeof isStartupFramePending !== 'function') {
      throw new Error('RENDER_LOOP_STARTUP_FRAME_PENDING_PREDICATE_REQUIRED');
    }
    if (
      onStartupFrameSchedulerFallback !== null
      && typeof onStartupFrameSchedulerFallback !== 'function'
    ) {
      throw new Error('RENDER_LOOP_STARTUP_FRAME_FALLBACK_CALLBACK_INVALID');
    }
  }

  if (!enabled) {
    onPause?.();
    return () => {};
  }

  const safeSimHz = Math.max(1, Number(simHz) || 60);
  const safeTargetFps = Math.max(1, Number(targetFps) || 60);
  const safeMaxCatchUpSteps = Math.max(1, Math.floor(Number(maxCatchUpSteps) || 30));
  const safeMaxElapsedMs = Math.max(1, Number(maxElapsedMs) || 250);

  const simStepMs = 1000 / safeSimHz;
  const simStepSec = simStepMs / 1000;
  const renderIntervalMs = 1000 / safeTargetFps;
  // Timestamps may be rounded to 0.1ms. Carry early admission as signed
  // phase error so a near-boundary frame is neither dropped nor counted twice.
  const renderClockToleranceMs = Math.min(0.1, renderIntervalMs * 0.01);
  const safePausedFrameIntervalMs = Number.isFinite(Number(pausedFrameIntervalMs))
    && Number(pausedFrameIntervalMs) > 0
    ? Math.max(16, Math.round(Number(pausedFrameIntervalMs)))
    : null;
  const safeMetricsSampleIntervalMs = Number.isFinite(Number(metricsSampleIntervalMs))
    && Number(metricsSampleIntervalMs) > 0
    ? Math.max(250, Math.round(Number(metricsSampleIntervalMs)))
    : null;
  const shouldCollectMetrics = typeof onMetrics === 'function' && safeMetricsSampleIntervalMs !== null;
  const maxAccumulatedMs = safeMaxCatchUpSteps * simStepMs;
  const nowMs = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now()
  );
  const hasRaf = (
    typeof requestAnimationFrame === 'function'
    && typeof cancelAnimationFrame === 'function'
  );
  const useTimeoutScheduler = frameScheduler === 'timeout' || (frameScheduler !== 'raf' && !hasRaf);
  const safeStartupFrameWatchdogMs = startupFrameWatchdogRequested
    ? Math.max(1, Math.round(startupFrameWatchdogMs))
    : null;
  const canRaceStartupFrameScheduler = (
    startupFrameWatchdogRequested
    && frameScheduler === 'auto'
    && hasRaf
  );
  const documentTarget = typeof document !== 'undefined' ? document : null;
  const reducedMotionQuery = (
    respectReducedMotion
    && typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
  )
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  let activeSchedule = null;
  let nextScheduleToken = 0;
  let lastFrameAt = null;
  let simAccumulatorMs = 0;
  let renderAccumulatorMs = 0;
  let renderElapsedMs = 0;
  let simTimeMs = 0;
  let disposed = false;
  let simErrorLogged = false;
  let renderErrorLogged = false;
  let metricsErrorLogged = false;
  let startupFallbackErrorLogged = false;
  let metricsWindowStartedAt = 0;
  let metricsLastSampleAt = 0;
  let metricsFrameCount = 0;
  let metricsRenderCount = 0;
  let metricsSimStepCount = 0;
  let metricsElapsedTotalMs = 0;
  let metricsMaxElapsedMs = 0;
  let reducedMotionFramePending = Boolean(
    renderReducedMotionFrame && reducedMotionQuery?.matches,
  );

  const resetAccumulators = () => {
    lastFrameAt = null;
    simAccumulatorMs = 0;
    renderAccumulatorMs = 0;
    renderElapsedMs = 0;
  };

  const resetMetricsWindow = (timestamp) => {
    metricsWindowStartedAt = timestamp;
    metricsLastSampleAt = timestamp;
    metricsFrameCount = 0;
    metricsRenderCount = 0;
    metricsSimStepCount = 0;
    metricsElapsedTotalMs = 0;
    metricsMaxElapsedMs = 0;
  };

  const emitMetricsSample = (timestamp) => {
    if (!shouldCollectMetrics) return;
    if (!metricsWindowStartedAt) {
      resetMetricsWindow(timestamp);
      return;
    }
    if (timestamp - metricsLastSampleAt < safeMetricsSampleIntervalMs) return;

    const durationMs = Math.max(1, timestamp - metricsWindowStartedAt);
    const averageFrameDeltaMs = metricsFrameCount > 0
      ? metricsElapsedTotalMs / metricsFrameCount
      : 0;
    try {
      onMetrics({
        label: metricsLabel,
        durationMs,
        frameCount: metricsFrameCount,
        renderCount: metricsRenderCount,
        simStepCount: metricsSimStepCount,
        averageFrameDeltaMs,
        maxFrameDeltaMs: metricsMaxElapsedMs,
        targetFps: safeTargetFps,
        simHz: safeSimHz,
      });
    } catch (error) {
      if (!metricsErrorLogged) {
        metricsErrorLogged = true;
        console.error('[runRenderLoop] onMetrics error:', error);
      }
    }
    resetMetricsWindow(timestamp);
  };

  const cancelSchedule = (schedule) => {
    if (!schedule || schedule.settled) return;
    schedule.settled = true;
    if (schedule.rafId !== null) {
      cancelAnimationFrame(schedule.rafId);
      schedule.rafId = null;
    }
    if (schedule.timeoutId !== null) {
      clearTimeout(schedule.timeoutId);
      schedule.timeoutId = null;
    }
  };

  const settleSchedule = (schedule, source, timestamp) => {
    if (
      disposed
      || schedule.settled
      || activeSchedule !== schedule
    ) {
      return;
    }
    schedule.settled = true;
    if (source !== 'raf' && schedule.rafId !== null) {
      cancelAnimationFrame(schedule.rafId);
    }
    if (source !== 'timeout' && schedule.timeoutId !== null) {
      clearTimeout(schedule.timeoutId);
    }
    schedule.rafId = null;
    schedule.timeoutId = null;
    activeSchedule = null;
    if (source === 'startup_timeout' && onStartupFrameSchedulerFallback) {
      try {
        onStartupFrameSchedulerFallback({
          watchdogMs: safeStartupFrameWatchdogMs,
        });
      } catch (error) {
        if (!startupFallbackErrorLogged) {
          startupFallbackErrorLogged = true;
          console.error('[runRenderLoop] startup scheduler fallback diagnostic error:', error);
        }
      }
    }
    schedule.callback(timestamp);
  };

  const createSchedule = (callback) => {
    nextScheduleToken += 1;
    const schedule = {
      token: nextScheduleToken,
      callback,
      rafId: null,
      timeoutId: null,
      settled: false,
    };
    activeSchedule = schedule;
    return schedule;
  };

  const scheduleNextFrame = (callback, delayMs = null) => {
    const schedule = createSchedule(callback);
    if (Number.isFinite(delayMs) && delayMs > 0) {
      schedule.timeoutId = setTimeout(() => {
        settleSchedule(schedule, 'timeout', nowMs());
      }, Math.max(1, Math.round(delayMs)));
      return schedule.token;
    }
    if (useTimeoutScheduler) {
      schedule.timeoutId = setTimeout(() => {
        settleSchedule(schedule, 'timeout', nowMs());
      }, Math.max(1, Math.round(renderIntervalMs)));
      return schedule.token;
    }
    if (canRaceStartupFrameScheduler && isStartupFramePending() === true) {
      schedule.rafId = requestAnimationFrame((timestamp) => {
        settleSchedule(schedule, 'raf', timestamp);
      });
      if (!schedule.settled) {
        schedule.timeoutId = setTimeout(() => {
          schedule.timeoutId = null;
          if (isStartupFramePending() !== true) return;
          settleSchedule(schedule, 'startup_timeout', nowMs());
        }, safeStartupFrameWatchdogMs);
      }
      return schedule.token;
    }
    schedule.rafId = requestAnimationFrame((timestamp) => {
      settleSchedule(schedule, 'raf', timestamp);
    });
    return schedule.token;
  };

  const cancelNextFrame = () => {
    if (!activeSchedule) return;
    cancelSchedule(activeSchedule);
    activeSchedule = null;
  };

  const isDocumentHidden = () => Boolean(
    pauseWhenDocumentHidden && documentTarget?.hidden,
  );

  const isReducedMotionPaused = () => Boolean(
    reducedMotionQuery?.matches && !reducedMotionFramePending,
  );

  const scheduleLifecycleResume = () => {
    if (disposed || activeSchedule || isDocumentHidden()) return;
    if (reducedMotionQuery?.matches) {
      if (!renderReducedMotionFrame) return;
      reducedMotionFramePending = true;
    }
    resetAccumulators();
    scheduleNextFrame(frame);
  };

  const handleVisibilityChange = () => {
    if (isDocumentHidden()) {
      cancelNextFrame();
      resetAccumulators();
      onPause?.();
      return;
    }
    scheduleLifecycleResume();
  };

  const handleReducedMotionChange = () => {
    cancelNextFrame();
    resetAccumulators();
    onPause?.();
    scheduleLifecycleResume();
  };

  const frame = (ts) => {
    if (disposed) return;
    if (isDocumentHidden() || isReducedMotionPaused()) {
      resetAccumulators();
      onPause?.();
      return;
    }
    if (typeof isPaused === 'function' && isPaused()) {
      resetAccumulators();
      onPause?.();
      if (!disposed) {
        scheduleNextFrame(frame, safePausedFrameIntervalMs);
      }
      return;
    }

    const firstFrame = lastFrameAt === null;
    const elapsed = firstFrame
      ? simStepMs
      : clamp(ts - lastFrameAt, 0, safeMaxElapsedMs);
    lastFrameAt = ts;
    simAccumulatorMs += elapsed;
    if (!firstFrame) renderAccumulatorMs += elapsed;
    renderElapsedMs += elapsed;
    if (shouldCollectMetrics) {
      if (!metricsWindowStartedAt) {
        resetMetricsWindow(ts);
      }
      metricsFrameCount += 1;
      metricsElapsedTotalMs += elapsed;
      metricsMaxElapsedMs = Math.max(metricsMaxElapsedMs, elapsed);
    }

    if (simAccumulatorMs > maxAccumulatedMs) {
      simAccumulatorMs = maxAccumulatedMs;
    }

    let simSteps = Math.floor(simAccumulatorMs / simStepMs);
    if (simSteps > safeMaxCatchUpSteps) {
      simSteps = safeMaxCatchUpSteps;
    }

    for (let i = 0; i < simSteps; i += 1) {
      simTimeMs += simStepMs;
      if (shouldCollectMetrics) {
        metricsSimStepCount += 1;
      }
      try {
        onSimStep?.({
          simStepMs,
          simStepSec,
          simTimeMs,
          elapsedMs: elapsed,
        });
      } catch (error) {
        if (!simErrorLogged) {
          simErrorLogged = true;
          console.error('[runRenderLoop] onSimStep error:', error);
        }
      }
      simAccumulatorMs -= simStepMs;
    }

    if (firstFrame || renderAccumulatorMs + renderClockToleranceMs >= renderIntervalMs) {
      if (!firstFrame) {
        const dueIntervals = Math.floor(
          (renderAccumulatorMs + renderClockToleranceMs) / renderIntervalMs,
        );
        renderAccumulatorMs -= dueIntervals * renderIntervalMs;
      }
      const elapsedSinceRenderMs = renderElapsedMs;
      renderElapsedMs = 0;
      if (shouldCollectMetrics) {
        metricsRenderCount += 1;
      }
      try {
        onRender?.({
          elapsedMs: elapsedSinceRenderMs,
          alpha: simAccumulatorMs / simStepMs,
          simTimeMs,
        });
      } catch (error) {
        if (!renderErrorLogged) {
          renderErrorLogged = true;
          console.error('[runRenderLoop] onRender error:', error);
        }
      }
    }

    emitMetricsSample(ts);
    if (reducedMotionQuery?.matches) {
      reducedMotionFramePending = false;
      onPause?.();
    } else if (!disposed) {
      scheduleNextFrame(frame);
    }
  };

  if (pauseWhenDocumentHidden && documentTarget) {
    documentTarget.addEventListener('visibilitychange', handleVisibilityChange);
  }
  if (reducedMotionQuery) {
    if (typeof reducedMotionQuery.addEventListener === 'function') {
      reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
    } else if (typeof reducedMotionQuery.addListener === 'function') {
      reducedMotionQuery.addListener(handleReducedMotionChange);
    }
  }

  const wake = () => {
    if (disposed || isDocumentHidden() || isReducedMotionPaused()) return;
    if (typeof isPaused === 'function' && isPaused()) return;
    cancelNextFrame();
    resetAccumulators();
    scheduleNextFrame(frame);
  };

  if (!isDocumentHidden() && !isReducedMotionPaused()) {
    scheduleNextFrame(frame);
  }

  const stop = () => {
    disposed = true;
    cancelNextFrame();
    if (pauseWhenDocumentHidden && documentTarget) {
      documentTarget.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    if (reducedMotionQuery) {
      if (typeof reducedMotionQuery.removeEventListener === 'function') {
        reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
      } else if (typeof reducedMotionQuery.removeListener === 'function') {
        reducedMotionQuery.removeListener(handleReducedMotionChange);
      }
    }
    onPause?.();
  };

  stop.wake = wake;
  stop.stop = stop;
  return stop;
}
