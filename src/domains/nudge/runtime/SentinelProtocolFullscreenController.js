// Optional browser presentation is separate from protocol authority. A denied
// fullscreen request is diagnosed; the reserved starter still commits in the
// settled window. No crack/game clock runs while the viewport is preparing.
export function createSentinelProtocolFullscreenController({
  documentRef,
  windowRef,
  resizeCanvas,
  setPreparing,
  reportFailure,
}) {
  let generation = 0;
  let ownedElement = null;
  let pendingRequest = null;
  let observation = { status: 'idle', activationAtRequest: null, error: null };
  const cancelWaits = new Set();

  function boundedWait(start) {
    return new Promise((resolve, reject) => {
      let cleanup = () => {};
      let settled = false;
      const cancel = () => {
        if (settled) return;
        settled = true;
        cleanup();
        cancelWaits.delete(cancel);
        reject(new Error('sentinel_fullscreen_preparation_cancelled'));
      };
      const finish = (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        cancelWaits.delete(cancel);
        resolve(value);
      };
      cancelWaits.add(cancel);
      cleanup = start(finish);
    });
  }

  function request({ retry = false } = {}) {
    if (documentRef.fullscreenElement === documentRef.documentElement) {
      observation = { ...observation, status: 'active' };
      return pendingRequest?.promise || Promise.resolve();
    }
    if (pendingRequest && (pendingRequest.inFlight || !retry)) return pendingRequest.promise;
    // runRequest invokes the platform API synchronously, while the initiating
    // pointer/key gesture still owns transient user activation. Preparation
    // later awaits this SAME request instead of racing the worker reservation.
    const requestState = { generation, inFlight: true, promise: null };
    pendingRequest = requestState;
    observation = {
      status: 'requesting',
      activationAtRequest: windowRef.navigator?.userActivation?.isActive ?? null,
      focusAtRequest: typeof documentRef.hasFocus === 'function' ? documentRef.hasFocus() : null,
      visibilityAtRequest: documentRef.visibilityState,
      error: null,
    };
    requestState.promise = runRequest(requestState).finally(() => { requestState.inFlight = false; });
    return requestState.promise;
  }

  async function runRequest(requestState) {
    function diagnose(phase, error) {
      if (generation === requestState.generation) observation = { ...observation, status: phase, error: `${error.name}: ${error.message}` };
      reportFailure(phase, error);
    }
    if (documentRef.fullscreenEnabled === false) {
      diagnose('fullscreen_policy_denied', new Error('Document fullscreen policy is disabled'));
      return;
    }
    if (typeof documentRef.documentElement.requestFullscreen !== 'function') {
      diagnose('fullscreen_unavailable', new Error('Fullscreen API unavailable'));
      return;
    }
    const current = requestState.generation;
    const element = documentRef.documentElement;
    let requestPromise;
    try {
      requestPromise = element.requestFullscreen({ navigationUI: 'hide' });
    } catch (error) {
      diagnose('fullscreen_request', error);
      return;
    }
    const settled = await boundedWait((finish) => {
      const timer = windowRef.setTimeout(() => {
        diagnose('fullscreen_timeout', new Error('Fullscreen did not settle within 1200ms'));
        finish(false);
      }, 1200);
      Promise.resolve(requestPromise).then(() => {
        if (documentRef.fullscreenElement === element) {
          if (generation === current) {
            ownedElement = element;
            observation = { ...observation, status: 'active', error: null };
          } else if (!ownedElement && (!pendingRequest || pendingRequest === requestState)) {
            // A stopped session may complete its browser request late. Release
            // only that orphan; never reset the next session's waits or owner.
            exitElement(element);
          }
        } else if (generation === current) {
          diagnose('fullscreen_not_entered', new Error('Request settled without a fullscreen element'));
        }
        finish(true);
      }, (error) => {
        diagnose('fullscreen_request', error);
        finish(true);
      });
      return () => windowRef.clearTimeout(timer);
    });
    if (settled === false) {
      exit();
      throw new Error('sentinel_fullscreen_request_timeout');
    }
  }

  async function prepare({ enabled = true } = {}) {
    const current = generation;
    setPreparing(true);
    try {
      if (enabled) await request();
      else observation = { ...observation, status: 'disabled_by_config' };
      if (current !== generation) throw new Error('sentinel_fullscreen_preparation_cancelled');
      const stable = await boundedWait((finish) => {
        let quietTimer;
        let frameId = null;
        let previousBounds = null;
        const sampleFrame = () => {
          frameId = null;
          const width = windowRef.innerWidth;
          const height = windowRef.innerHeight;
          if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            reportFailure('fullscreen_viewport_invalid', new Error('Viewport dimensions must be positive and finite'));
            finish('invalid');
            return;
          }
          if (previousBounds && previousBounds.width === width && previousBounds.height === height) {
            finish(true);
            return;
          }
          previousBounds = { width, height };
          frameId = windowRef.requestAnimationFrame(sampleFrame);
        };
        const schedule = () => {
          windowRef.clearTimeout(quietTimer);
          if (frameId !== null) windowRef.cancelAnimationFrame(frameId);
          frameId = null;
          previousBounds = null;
          quietTimer = windowRef.setTimeout(() => {
            frameId = windowRef.requestAnimationFrame(sampleFrame);
          }, 100);
        };
        windowRef.addEventListener('resize', schedule);
        // Settle browser geometry, then observe two equal paint-frame bounds.
        // A fixed delay alone could commit during the fullscreen transition.
        schedule();
        const deadline = windowRef.setTimeout(() => {
          reportFailure('fullscreen_resize_timeout', new Error('Viewport remained unstable'));
          finish(false);
        }, 800);
        return () => {
          windowRef.clearTimeout(quietTimer);
          windowRef.clearTimeout(deadline);
          if (frameId !== null) windowRef.cancelAnimationFrame(frameId);
          windowRef.removeEventListener('resize', schedule);
        };
      });
      if (stable === 'invalid') throw new Error('sentinel_fullscreen_viewport_invalid');
      if (stable === false) throw new Error('sentinel_fullscreen_resize_timeout');
      if (current !== generation) throw new Error('sentinel_fullscreen_preparation_cancelled');
      // Publish the new worker bounds before the reserved starter commit.
      resizeCanvas();
    } finally {
      if (current === generation) setPreparing(false);
    }
  }

  function exit() {
    generation += 1;
    for (const cancel of [...cancelWaits]) cancel();
    setPreparing(false);
    pendingRequest = null;
    const element = ownedElement;
    ownedElement = null;
    exitElement(element);
  }

  function exitElement(element) {
    if (!element || documentRef.fullscreenElement !== element) return;
    try {
      Promise.resolve(documentRef.exitFullscreen()).catch((error) => reportFailure('fullscreen_exit', error));
    } catch (error) {
      reportFailure('fullscreen_exit', error);
    }
  }

  return {
    prepare, request, exit,
    getSnapshot: () => ({
      ...observation,
      active: documentRef.fullscreenElement !== null && documentRef.fullscreenElement !== undefined,
      owned: ownedElement !== null && documentRef.fullscreenElement === ownedElement,
      enabled: documentRef.fullscreenEnabled ?? null,
      pending: pendingRequest?.inFlight === true,
    }),
  };
}
