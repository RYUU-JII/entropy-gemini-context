const createDefaultChannelState = () => ({
  running: false,
  scheduled: false,
  pending: null,
});

export const createZenPondControlChannelCoalescer = ({
  enqueueTask = null,
  isActive = () => true,
  onTaskSuccess = null,
  onTaskError = null,
} = {}) => {
  if (typeof enqueueTask !== 'function') {
    throw new Error('ZEN_POND_COALESCER_ENQUEUE_REQUIRED');
  }

  const channels = new Map();

  const resolveChannel = (key) => {
    const channelKey = typeof key === 'string' && key.trim() ? key.trim() : 'default';
    if (!channels.has(channelKey)) {
      channels.set(channelKey, createDefaultChannelState());
    }
    return {
      key: channelKey,
      state: channels.get(channelKey),
    };
  };

  const scheduleNext = (channelKey, channelState) => {
    if (!channelState.pending || channelState.running || channelState.scheduled || !isActive()) {
      return;
    }

    const taskDescriptor = channelState.pending;
    channelState.pending = null;
    channelState.scheduled = true;

    const queueMeta = {
      id: `zen_pond_channel_${channelKey}_${Date.now()}`,
      priority: taskDescriptor.priority,
    };

    void enqueueTask(queueMeta, async () => {
      channelState.scheduled = false;
      if (!isActive()) return;
      channelState.running = true;
      try {
        const result = await taskDescriptor.run();
        if (typeof onTaskSuccess === 'function') {
          onTaskSuccess({
            channelKey,
            descriptor: taskDescriptor,
            result,
          });
        }
      } catch (error) {
        if (typeof onTaskError === 'function') {
          onTaskError(error, {
            channelKey,
            descriptor: taskDescriptor,
          });
        }
      } finally {
        channelState.running = false;
        if (channelState.pending && isActive()) {
          scheduleNext(channelKey, channelState);
        }
      }
    }).catch((error) => {
      channelState.scheduled = false;
      channelState.running = false;
      if (typeof onTaskError === 'function') {
        onTaskError(error, {
          channelKey,
          descriptor: taskDescriptor,
        });
      }
      if (channelState.pending && isActive()) {
        scheduleNext(channelKey, channelState);
      }
    });
  };

  const pushLatest = ({ channelKey, priority = null, run = null, label = null } = {}) => {
    if (typeof run !== 'function') return false;
    const { key, state } = resolveChannel(channelKey);
    state.pending = {
      run,
      priority,
      label: typeof label === 'string' ? label : null,
      enqueuedAt: Date.now(),
    };
    scheduleNext(key, state);
    return true;
  };

  const clear = () => {
    channels.clear();
  };

  return Object.freeze({
    pushLatest,
    clear,
  });
};
