function requireFunction(value, errorCode) {
  if (typeof value !== 'function') throw new Error(errorCode);
  return value;
}

function requireNonNegativeSafeInteger(value, errorCode) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(errorCode);
  return value;
}

export class ClseCheckpointWriteScheduler {
  constructor({
    capture,
    write,
    minWriteIntervalMs = 5_000,
  } = {}) {
    this.capture = requireFunction(capture, 'CLSE_CHECKPOINT_CAPTURE_REQUIRED');
    this.write = requireFunction(write, 'CLSE_CHECKPOINT_WRITE_REQUIRED');
    this.minWriteIntervalMs = requireNonNegativeSafeInteger(
      minWriteIntervalMs,
      'CLSE_CHECKPOINT_WRITE_INTERVAL_INVALID',
    );
    this.operationTail = Promise.resolve();
    this.lastAcceptedAt = null;
    this.lastAcceptedTask = null;
  }

  request({ force = false, now = Date.now() } = {}) {
    const requestedAt = requireNonNegativeSafeInteger(
      now,
      'CLSE_CHECKPOINT_REQUEST_TIMESTAMP_INVALID',
    );
    if (
      force !== true
      && this.lastAcceptedAt !== null
      && requestedAt - this.lastAcceptedAt < this.minWriteIntervalMs
    ) {
      return this.lastAcceptedTask || Promise.resolve(Object.freeze({
        status: 'coalesced',
        requestedAt,
      }));
    }

    this.lastAcceptedAt = requestedAt;
    const operation = async () => {
      const checkpoint = this.capture();
      await this.write(checkpoint);
      return Object.freeze({ status: 'written', requestedAt });
    };
    const pending = this.operationTail.then(operation, operation);
    this.operationTail = pending.catch(() => undefined);
    this.lastAcceptedTask = pending;
    void pending.catch(() => {
      if (this.lastAcceptedTask === pending) {
        this.lastAcceptedAt = null;
        this.lastAcceptedTask = null;
      }
    });
    return pending;
  }

  drain() {
    return this.operationTail;
  }

  resetCadence() {
    this.lastAcceptedAt = null;
    this.lastAcceptedTask = null;
  }
}

export default ClseCheckpointWriteScheduler;
