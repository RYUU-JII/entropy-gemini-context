export const BEHAVIOR_SIGNAL_TYPES = Object.freeze({
  VIDEO_SKIP: 'VIDEO_SKIP',
  EXCESSIVE_CLICK: 'EXCESSIVE_CLICK',
  PLAY_EFFECT: 'PLAY_EFFECT',
});

export const BEHAVIOR_JUDGE_RULES = Object.freeze({
  [BEHAVIOR_SIGNAL_TYPES.VIDEO_SKIP]: {
    limit: 5,
    windowMs: 60_000,
  },
  [BEHAVIOR_SIGNAL_TYPES.EXCESSIVE_CLICK]: {
    limit: Number.POSITIVE_INFINITY,
    windowMs: 30_000,
  },
});

function normalizeCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

function computeSeverity(count, limit) {
  if (!Number.isFinite(limit) || limit <= 0) {
    return { level: 'low', score: 0 };
  }
  const ratio = count / limit;
  let level = 'low';
  if (ratio >= 2) level = 'high';
  else if (ratio >= 1.5) level = 'medium';
  return { level, score: Math.round(ratio * 100) / 100 };
}

export class BehaviorJudge {
  constructor({ rules } = {}) {
    this._rules = rules || BEHAVIOR_JUDGE_RULES;
    this._queues = new Map();
  }

  recordVideoSkip({ ts, video } = {}) {
    return this._record(BEHAVIOR_SIGNAL_TYPES.VIDEO_SKIP, {
      count: 1,
      ts,
      context: { video },
    });
  }

  recordClick({ ts } = {}) {
    return this._record(BEHAVIOR_SIGNAL_TYPES.EXCESSIVE_CLICK, {
      count: 1,
      ts,
    });
  }

  reset() {
    this._queues.clear();
  }

  _record(key, { count, ts, context } = {}) {
    const rule = this._rules[key];
    if (!rule) return null;

    const now = Number.isFinite(ts) ? ts : Date.now();
    const windowMs = Math.max(0, Number(rule.windowMs) || 0);
    const limit = Number.isFinite(rule.limit) ? rule.limit : Number.POSITIVE_INFINITY;
    const queue = this._getQueue(key);

    const addCount = normalizeCount(count);
    for (let i = 0; i < addCount; i += 1) queue.push(now);
    if (windowMs > 0) this._prune(queue, now - windowMs);

    const stats = {
      count: queue.length,
      limit,
      windowMs,
      windowStartTs: windowMs > 0 ? now - windowMs : null,
      windowEndTs: now,
      ratio: limit > 0 && Number.isFinite(limit) ? queue.length / limit : 0,
    };

    const triggered =
      Number.isFinite(limit) && limit > 0 ? queue.length >= limit : false;
    return {
      type: key,
      isTriggered: triggered,
      severity: computeSeverity(queue.length, limit),
      stats,
      context: context || null,
    };
  }

  _getQueue(key) {
    if (this._queues.has(key)) return this._queues.get(key);
    const queue = [];
    this._queues.set(key, queue);
    return queue;
  }

  _prune(queue, cutoff) {
    while (queue.length && queue[0] < cutoff) {
      queue.shift();
    }
  }
}
