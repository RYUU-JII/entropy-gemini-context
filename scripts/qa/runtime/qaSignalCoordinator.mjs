export function createQaSignalCoordinator({
  processRef = process,
} = {}) {
  const controller = new AbortController();
  let receivedSignal = null;
  const handlers = new Map();
  ['SIGINT', 'SIGTERM'].forEach((signalName) => {
    const handler = () => {
      if (receivedSignal) return;
      receivedSignal = signalName;
      controller.abort(new Error(`QA_RUN_ABORTED:${signalName}`));
    };
    handlers.set(signalName, handler);
    processRef.once(signalName, handler);
  });
  return Object.freeze({
    signal: controller.signal,
    get receivedSignal() {
      return receivedSignal;
    },
    dispose() {
      handlers.forEach((handler, signalName) => {
        processRef.removeListener(signalName, handler);
      });
    },
  });
}
