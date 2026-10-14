const DISABLED_ERROR = Object.freeze({
  code: 'ZEN_EXPERIMENTAL_WORKER_RUNTIME_DISABLED',
  message: 'Zen experimental worker runtime is disabled in this build profile.',
});

self.addEventListener('message', (event) => {
  const message = event?.data && typeof event.data === 'object' ? event.data : {};
  const id = Object.prototype.hasOwnProperty.call(message, 'id') ? message.id : null;
  if (message.type === 'PING') {
    self.postMessage({ id, type: 'READY' });
    return;
  }
  self.postMessage({
    id,
    type: 'ERROR',
    error: DISABLED_ERROR,
  });
});
