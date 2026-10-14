// The host owns what a frame means; this controller owns only RAF lifecycle
// and delta calculation so render scheduling cannot leak into session state.
export function createSentinelProtocolFrameLoop({ onFrame, onError }) {
  let rafId = null;
  let lastTs = null;

  function stop() {
    if (!rafId) return;
    cancelAnimationFrame(rafId);
    rafId = null;
    lastTs = null;
  }

  function frame(ts) {
    try {
      const previousTs = lastTs === null ? ts : lastTs;
      const frameMs = Math.max(0, ts - previousTs);
      lastTs = ts;
      if (onFrame({ ts, frameMs, dt: Math.min(0.05, frameMs / 1000) }) === false) {
        rafId = null;
        lastTs = null;
        return;
      }
      rafId = requestAnimationFrame(frame);
    } catch (error) {
      stop();
      onError(error);
    }
  }

  return {
    start() {
      stop();
      lastTs = null;
      rafId = requestAnimationFrame(frame);
    },
    stop,
    isRunning: () => rafId !== null,
  };
}
