// Serialized into one exact disposable extension worker by faviconQaProtocol.
// Every intercepted call delegates to native fetch with its original receiver,
// arguments and Response. Only delivery of that Response can be held.
export function installFaviconQaResponseDeliveryFixture({ key, extensionId, pageUrl, localCacheUrl,
  maxHoldMs = 1500 }, scope = globalThis) {
  const fail = code => { throw new Error(`QA_FAVICON_RESPONSE_DELIVERY_${code}`); };
  const workerUrl = `chrome-extension://${extensionId}/service-worker-loader.js`;
  const page = new URL(pageUrl);
  if (scope.chrome?.runtime?.id !== extensionId || scope.location?.href !== workerUrl
    || page.protocol !== 'http:' || page.hostname !== 'favicon.localhost' || !page.port
    || page.pathname !== '/' || page.search || page.hash || page.username || page.password
    || localCacheUrl !== `chrome-extension://${extensionId}/_favicon/?pageUrl=${encodeURIComponent(page.href)}&size=64`
    || typeof key !== 'string' || !/^__entropyFaviconQaDelivery_[a-z0-9_]+$/u.test(key)
    || !Number.isInteger(maxHoldMs) || maxHoldMs < 1 || maxHoldMs > 1500
    || Object.prototype.hasOwnProperty.call(scope, key)) fail('OWNED_WORKER_REQUIRED');
  const descriptor = Object.getOwnPropertyDescriptor(scope, 'fetch');
  const nativeFetch = scope.fetch;
  if (typeof nativeFetch !== 'function' || descriptor?.configurable === false) fail('FETCH_OWNER_REQUIRED');
  const reads = [];
  const operations = new Set();
  let armed = false; let held = null; let restored = false;
  const clearHold = hold => {
    scope.clearTimeout(hold.timer);
    hold.signal?.removeEventListener('abort', hold.abort);
    if (held === hold) held = null;
  };
  const cancelHold = (hold, state, code) => {
    hold.receipt.state = state; clearHold(hold);
    hold.reject(new Error(`QA_FAVICON_RESPONSE_DELIVERY_${code}`));
  };
  function wrappedFetch(...args) {
    if (args[0] !== localCacheUrl || args[1]?.method !== 'GET') return Reflect.apply(nativeFetch, this, args);
    if (reads.length >= 8) fail('READ_LIMIT_EXCEEDED');
    const shouldHold = armed; armed = false;
    const startedAt = Date.now();
    const receipt = { sequence: reads.length + 1, startedAt, state: 'reading', status: null,
      byteCount: null, pngSignature: false, sha256: null, originalResponseUntouched: false,
      originalResponseReused: false, releasedAfterClearAck: false, heldAt: null, holdMs: null };
    reads.push(receipt);
    const operation = Reflect.apply(nativeFetch, this, args).then(async response => {
      receipt.status = response.status;
      const bytes = new Uint8Array(await response.clone().arrayBuffer());
      receipt.byteCount = bytes.length;
      receipt.pngSignature = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
      if (!bytes.length || bytes.length > 256 * 1024) fail('BODY_LIMIT_EXCEEDED');
      receipt.sha256 = [...new Uint8Array(await scope.crypto.subtle.digest('SHA-256', bytes))]
        .map(byte => byte.toString(16).padStart(2, '0')).join('');
      receipt.originalResponseUntouched = response.bodyUsed === false;
      if (!receipt.originalResponseUntouched) fail('ORIGINAL_RESPONSE_CONSUMED');
      if (!shouldHold || restored) {
        receipt.state = restored ? 'cleanup_released' : 'delivered'; receipt.originalResponseReused = true;
        return response;
      }
      if (!response.ok || !receipt.pngSignature) fail('VALID_NATIVE_RESPONSE_REQUIRED');
      return new Promise((resolve, reject) => {
        receipt.state = 'held'; receipt.heldAt = Date.now();
        const hold = { resolve, reject, response, receipt, signal: args[1]?.signal, timer: null, abort: null };
        held = hold;
        hold.abort = () => cancelHold(hold, 'aborted', 'ABORTED');
        hold.timer = scope.setTimeout(() => cancelHold(hold, 'expired', 'EXPIRED'), maxHoldMs);
        if (hold.signal?.aborted) hold.abort();
        else hold.signal?.addEventListener('abort', hold.abort, { once: true });
      });
    });
    operations.add(operation);
    void operation.then(() => operations.delete(operation), () => operations.delete(operation));
    return operation;
  }
  const snapshot = () => ({ armed, restored, maxHoldMs, reads: reads.map(read => ({ ...read })) });
  const owner = {
    arm() {
      if (armed || held || restored || operations.size) fail('ARM_STATE_INVALID');
      armed = true; return snapshot();
    },
    snapshot,
    release(clearAck) {
      if (!held || clearAck?.success !== true || clearAck.result?.cleared !== true) fail('CLEAR_ACK_REQUIRED');
      const hold = held;
      const holdMs = Date.now() - hold.receipt.heldAt;
      if (holdMs < 0 || holdMs >= maxHoldMs || Date.now() - hold.receipt.startedAt >= 2500)
        cancelHold(hold, 'expired', 'EXPIRED');
      else {
        if (hold.response.bodyUsed !== false) fail('ORIGINAL_RESPONSE_CONSUMED');
        hold.receipt.state = 'released'; hold.receipt.holdMs = holdMs;
        hold.receipt.releasedAfterClearAck = true; hold.receipt.originalResponseReused = true;
        clearHold(hold); hold.resolve(hold.response);
      }
      return snapshot();
    },
    async restore() {
      if (restored || scope.fetch !== wrappedFetch) fail('RESTORE_OWNER_CHANGED');
      restored = true; armed = false;
      if (held) {
        const hold = held; hold.receipt.state = 'cleanup_released'; hold.receipt.originalResponseReused = true;
        clearHold(hold); hold.resolve(hold.response);
      }
      if (descriptor) Object.defineProperty(scope, 'fetch', descriptor);
      else delete scope.fetch;
      if (scope.fetch !== nativeFetch) fail('RESTORE_IDENTITY_FAILED');
      await Promise.allSettled([...operations]);
      const receipt = { ...snapshot(), originalDescriptorRestored: true };
      delete scope[key]; return receipt;
    },
  };
  Object.defineProperty(scope, 'fetch', { value: wrappedFetch, configurable: true, writable: true,
    enumerable: descriptor ? descriptor.enumerable : true });
  Object.defineProperty(scope, key, { value: owner, configurable: true });
  return { workerUrl, runtimeId: extensionId, maxHoldMs, originalResponseOnly: true };
}
