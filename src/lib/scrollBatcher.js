function normalizeDelay(value) {
  if (Number.isFinite(value)) return Math.max(0, value);
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function createScrollBatcher({ delayMs = 0, onScroll } = {}) {
  let delay = normalizeDelay(delayMs);
  let queue = [];
  let timerId = null;
  let rafId = null;

  const clearScheduled = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const scheduleQueue = () => {
    if (queue.length <= 0 || timerId !== null || rafId !== null) return;
    const waitMs = Math.max(0, queue[0].releaseTime - Date.now());
    timerId = setTimeout(() => {
      timerId = null;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        processQueue();
      });
    }, waitMs);
  };

  const processQueue = () => {
    const now = Date.now();
    let readyX = 0;
    let readyY = 0;

    let splitIdx = 0;
    while (splitIdx < queue.length && queue[splitIdx].releaseTime <= now) {
      readyX += queue[splitIdx].x;
      readyY += queue[splitIdx].y;
      splitIdx++;
    }

    if (splitIdx > 0) queue = queue.slice(splitIdx);

    if (readyX !== 0 || readyY !== 0) {
      if (typeof onScroll === 'function') onScroll(readyX, readyY);
    }

    scheduleQueue();
  };

  const enqueue = (deltaX, deltaY) => {
    const dx = Number.isFinite(deltaX) ? deltaX : 0;
    const dy = Number.isFinite(deltaY) ? deltaY : 0;
    if (dx === 0 && dy === 0) return;
    if (delay <= 0) {
      if (typeof onScroll === 'function') onScroll(dx, dy);
      return;
    }

    const queuedAt = Date.now();
    queue.push({
      x: dx,
      y: dy,
      queuedAt,
      releaseTime: queuedAt + delay,
    });

    scheduleQueue();
  };

  const setDelayMs = (nextDelay) => {
    delay = normalizeDelay(nextDelay);
    if (queue.length <= 0) return;
    queue = queue.map((entry) => ({
      ...entry,
      releaseTime: delay <= 0 ? Date.now() : entry.queuedAt + delay,
    }));
    clearScheduled();
    scheduleQueue();
  };

  const cancel = () => {
    clearScheduled();
    queue = [];
  };

  return {
    enqueue,
    cancel,
    setDelayMs,
  };
}
