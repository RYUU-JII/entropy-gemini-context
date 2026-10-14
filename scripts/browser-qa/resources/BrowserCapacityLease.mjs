import { createHash, randomUUID } from 'node:crypto';
import net from 'node:net';
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveBrowserQaProjectScope,
} from './browserResourceScope.mjs';

const LOOPBACK_HOST = '127.0.0.1';
const CAPACITY_PORT_BASE = 22_000;
const CAPACITY_PORT_SPAN = 10_000;
const OWNER_RESPONSE_TIMEOUT_MS = 500;
const MAX_OWNER_RESPONSE_BYTES = 4 * 1024;
const CAPACITY_SCHEMA_VERSION = 1;
const capacityLeaseRecords = new WeakMap();
const PROJECT_CAPTURE_SLOTS = 2;

function requireReservationMode(mode) {
  if (!['exclusive', 'shared_capture', 'isolated_functional'].includes(mode)) {
    throw new Error('QA_BROWSER_CAPACITY_RESERVATION_MODE_INVALID');
  }
  return mode;
}

function requireProjectRoot(rootDir) {
  try {
    return resolveBrowserQaProjectScope(rootDir);
  } catch (error) {
    if (error?.message === 'QA_BROWSER_PROJECT_ROOT_REQUIRED') {
      throw new Error('QA_BROWSER_CAPACITY_ROOT_REQUIRED', { cause: error });
    }
    throw new Error(
      `QA_BROWSER_CAPACITY_ROOT_INVALID:${error?.message || error}`,
      { cause: error },
    );
  }
}

function requireOwnerId(ownerId) {
  if (
    typeof ownerId !== 'string'
    || !ownerId.trim()
    || ownerId !== ownerId.trim()
    || ownerId.length > 160
    || /[\r\n]/u.test(ownerId)
  ) {
    throw new Error('QA_BROWSER_CAPACITY_OWNER_INVALID');
  }
  return ownerId;
}

function normalizeHostBrowserResourceIdentity(browserResourceIdentity) {
  if (browserResourceIdentity === null || browserResourceIdentity === undefined) {
    return null;
  }
  if (
    typeof browserResourceIdentity !== 'string'
    || !browserResourceIdentity.trim()
    || browserResourceIdentity !== browserResourceIdentity.trim()
    || browserResourceIdentity.length > 2_048
    || /[\r\n]/u.test(browserResourceIdentity)
  ) {
    throw new Error('QA_BROWSER_CAPACITY_RESOURCE_IDENTITY_INVALID');
  }
  return browserResourceIdentity;
}

function normalizeHostBrowserResourceIdentities(browserResourceIdentities) {
  if (browserResourceIdentities === null || browserResourceIdentities === undefined) {
    return null;
  }
  if (!Array.isArray(browserResourceIdentities) || browserResourceIdentities.length === 0) {
    throw new Error('QA_BROWSER_CAPACITY_RESOURCE_IDENTITIES_INVALID');
  }
  const identities = browserResourceIdentities.map((identity) => (
    normalizeHostBrowserResourceIdentity(identity)
  ));
  if (identities.some((identity) => identity === null)) {
    throw new Error('QA_BROWSER_CAPACITY_RESOURCE_IDENTITIES_INVALID');
  }
  return Object.freeze(
    [...new Set(identities)].sort((left, right) => left.localeCompare(right)),
  );
}

export function resolveQaBrowserCapacityEndpoint(rootDir, {
  browserResourceIdentity = null,
  capacitySlot = 0,
} = {}) {
  const project = requireProjectRoot(rootDir);
  const hostIdentity = normalizeHostBrowserResourceIdentity(browserResourceIdentity);
  if (!Number.isInteger(capacitySlot) || capacitySlot < 0 || capacitySlot >= PROJECT_CAPTURE_SLOTS
    || (hostIdentity !== null && capacitySlot !== 0)) {
    throw new Error('QA_BROWSER_CAPACITY_SLOT_INVALID');
  }
  const digest = createHash('sha256')
    .update(hostIdentity ? 'host_browser_identity\0' : 'project_scope\0')
    .update(hostIdentity || project.scopePath)
    .digest();
  const scope = capacitySlot === 0 ? digest.toString('hex').slice(0, 16)
    : createHash('sha256').update(digest).update(String(capacitySlot)).digest('hex').slice(0, 16);
  const port = CAPACITY_PORT_BASE + ((digest.readUInt16BE(0) + capacitySlot) % CAPACITY_PORT_SPAN);
  return Object.freeze({
    host: LOOPBACK_HOST,
    port,
    scope,
    rootDir: project.projectRoot,
    projectScope: hostIdentity ? null : project.scopePath,
    scopeKind: hostIdentity ? 'host_browser_identity' : project.scopeKind,
    capacitySlot,
  });
}

function writeOwnerSnapshot(socket, snapshot) {
  socket.end(`${JSON.stringify(snapshot)}\n`);
}

function createCapacityServer(snapshot) {
  const server = net.createServer((socket) => {
    socket.on('error', () => {});
    writeOwnerSnapshot(socket, snapshot);
  });
  server.maxConnections = 16;
  return server;
}

function listen(server, endpoint) {
  return new Promise((resolve, reject) => {
    const handleError = (error) => {
      server.removeListener('listening', handleListening);
      reject(error);
    };
    const handleListening = () => {
      server.removeListener('error', handleError);
      resolve();
    };
    server.once('error', handleError);
    server.once('listening', handleListening);
    server.listen(endpoint.port, endpoint.host);
  });
}

function close(server) {
  if (!server.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function startCaptureResponder(endpoint, snapshot) {
  const workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'captureCapacityResponder.worker.mjs');
  const worker = new Worker(workerPath, {
    workerData: { endpoint, snapshot },
    execArgv: process.execArgv.filter((argument) => !argument.startsWith('--input-type')),
  });
  const response = (success, failure) => new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.off('message', onMessage);
      worker.off('error', onError);
      worker.off('exit', onExit);
    };
    const onError = (error) => { cleanup(); reject(error); };
    const onExit = (code) => onError(new Error(`QA_CAPTURE_CAPACITY_RESPONDER_EXITED:${code}`));
    const onMessage = (message) => {
      if (message.type === success) { cleanup(); resolve(); }
      else if (message.type === failure) {
        onError(Object.assign(new Error(message.message), { code: message.code }));
      }
    };
    worker.on('message', onMessage);
    worker.once('error', onError);
    worker.once('exit', onExit);
  });
  try {
    await response('ready', 'listen_error');
  } catch (error) {
    await worker.terminate();
    throw error;
  }
  worker.unref();
  return async () => {
    if (worker.threadId === -1) throw new Error('QA_CAPTURE_CAPACITY_RESPONDER_LOST');
    // Keep the awaited close handshake alive even after all browser work ends.
    worker.ref();
    const closed = response('closed', 'close_error');
    worker.postMessage('close');
    await closed;
    await worker.terminate();
  };
}

export function inspectQaBrowserCapacity(rootDir, options = {}) {
  const endpoint = resolveQaBrowserCapacityEndpoint(rootDir, options);
  return new Promise((resolve) => {
    const socket = net.createConnection({
      host: endpoint.host,
      port: endpoint.port,
    });
    let settled = false;
    let response = '';
    const finish = (owner) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(owner);
    };
    socket.setEncoding('utf8');
    socket.setTimeout(OWNER_RESPONSE_TIMEOUT_MS);
    socket.on('data', (chunk) => {
      response += chunk;
      if (Buffer.byteLength(response, 'utf8') > MAX_OWNER_RESPONSE_BYTES) {
        finish(null);
      }
    });
    socket.on('end', () => {
      try {
        const owner = JSON.parse(response.trim());
        if (
          owner?.schemaVersion !== CAPACITY_SCHEMA_VERSION
          || owner?.scope !== endpoint.scope
          || typeof owner?.ownerId !== 'string'
          || !Number.isSafeInteger(owner?.pid)
        ) {
          finish(null);
          return;
        }
        finish(Object.freeze(owner));
      } catch {
        finish(null);
      }
    });
    socket.on('timeout', () => finish(null));
    socket.on('error', () => finish(null));
  });
}

function createCapacityBusyError(endpoint, owner) {
  const ownerDetail = owner
    ? `${owner.ownerId}:pid=${owner.pid}`
    : `unknown_owner:endpoint=${endpoint.host}:${endpoint.port}`;
  const error = new Error(`QA_BROWSER_CAPACITY_BUSY:${ownerDetail}`);
  error.code = 'QA_BROWSER_CAPACITY_BUSY';
  error.owner = owner;
  error.endpoint = Object.freeze({ host: endpoint.host, port: endpoint.port });
  return error;
}

async function acquireSingleQaBrowserCapacity({
  rootDir,
  ownerId,
  browserResourceIdentity = null,
  capacitySlot = 0,
  reservationMode = 'exclusive',
} = {}) {
  const endpoint = resolveQaBrowserCapacityEndpoint(rootDir, {
    browserResourceIdentity,
    capacitySlot,
  });
  const snapshot = Object.freeze({
    schemaVersion: CAPACITY_SCHEMA_VERSION,
    scope: endpoint.scope,
    leaseId: randomUUID(),
    ownerId: requireOwnerId(ownerId),
    pid: process.pid,
    acquiredAt: new Date().toISOString(),
    reservationMode,
    capacitySlot,
  });
  let releaseEndpoint;
  try {
    if (reservationMode !== 'exclusive') {
      releaseEndpoint = await startCaptureResponder(endpoint, snapshot);
    } else {
      const server = createCapacityServer(snapshot);
      await listen(server, endpoint);
      server.unref();
      releaseEndpoint = () => close(server);
    }
  } catch (error) {
    if (error?.code === 'EADDRINUSE') {
      const owner = await inspectQaBrowserCapacity(endpoint.rootDir, {
        browserResourceIdentity,
        capacitySlot,
      });
      throw createCapacityBusyError(endpoint, owner);
    }
    const acquireError = new Error(
      `QA_BROWSER_CAPACITY_ACQUIRE_FAILED:${error?.code || 'unknown'}:${error?.message || error}`,
      { cause: error },
    );
    acquireError.code = 'QA_BROWSER_CAPACITY_ACQUIRE_FAILED';
    throw acquireError;
  }
  let released = false;
  let releasePromise = null;
  const record = {
    projectScope: browserResourceIdentity === null ? endpoint.projectScope : null,
    reservationMode,
    resourceIdentities: browserResourceIdentity === null
      ? null
      : Object.freeze([normalizeHostBrowserResourceIdentity(browserResourceIdentity)]),
    borrowerCount: 0,
    releasing: false,
    released: false,
  };
  const lease = Object.freeze({
    endpoint: Object.freeze({ host: endpoint.host, port: endpoint.port }),
    owner: snapshot,
    release() {
      if (released) {
        return Promise.resolve(Object.freeze({
          resource: 'browser_capacity',
          status: 'already_released',
        }));
      }
      if (!releasePromise) {
        releasePromise = (async () => {
          if (record.borrowerCount > 0) {
            throw new Error(
              `QA_BROWSER_CAPACITY_BORROWERS_ACTIVE:count=${record.borrowerCount}`,
            );
          }
          record.releasing = true;
          await releaseEndpoint();
          released = true;
          record.released = true;
          return Object.freeze({
            resource: 'browser_capacity',
            status: 'released',
          });
        })().catch((error) => {
          record.releasing = false;
          releasePromise = null;
          throw error;
        });
      }
      return releasePromise;
    },
  });
  capacityLeaseRecords.set(lease, record);
  return lease;
}

async function releaseCapacityLeasesReverse(leases) {
  const receipts = [];
  const errors = [];
  for (const lease of [...leases].reverse()) {
    try {
      receipts.push(await lease.release());
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) {
    throw new AggregateError(errors, 'QA_BROWSER_CAPACITY_RELEASE_INCOMPLETE');
  }
  return Object.freeze(receipts);
}

export async function acquireQaBrowserCapacity({
  rootDir,
  ownerId,
  browserResourceIdentity = null,
  browserResourceIdentities = null,
  reservationMode = 'exclusive',
} = {}) {
  requireReservationMode(reservationMode);
  if (
    browserResourceIdentity !== null
    && browserResourceIdentity !== undefined
    && browserResourceIdentities !== null
    && browserResourceIdentities !== undefined
  ) {
    throw new Error('QA_BROWSER_CAPACITY_RESOURCE_IDENTITY_CONFLICT');
  }
  const identities = normalizeHostBrowserResourceIdentities(browserResourceIdentities);
  const hostIdentity = normalizeHostBrowserResourceIdentity(browserResourceIdentity);
  if (reservationMode !== 'exclusive' && (identities !== null || hostIdentity !== null)) {
    throw new Error(reservationMode === 'shared_capture'
      ? 'QA_BROWSER_CAPACITY_SHARED_CAPTURE_REQUIRES_OWNED_PROJECT'
      : 'QA_BROWSER_CAPACITY_ISOLATED_FUNCTIONAL_REQUIRES_OWNED_PROJECT');
  }
  if (!identities && hostIdentity !== null) {
    return acquireSingleQaBrowserCapacity({
      rootDir,
      ownerId,
      browserResourceIdentity,
    });
  }

  if (reservationMode !== 'exclusive') {
    for (let capacitySlot = 0; capacitySlot < PROJECT_CAPTURE_SLOTS; capacitySlot += 1) {
      try {
        return await acquireSingleQaBrowserCapacity({ rootDir, ownerId, capacitySlot, reservationMode });
      } catch (error) {
        // Only a proved bounded shared owner admits the next slot. Old or unknown
        // owners remain exclusive; another endpoint is never a bypass.
        if (error.code !== 'QA_BROWSER_CAPACITY_BUSY'
          || !['shared_capture', 'isolated_functional'].includes(error.owner?.reservationMode)
          || capacitySlot === PROJECT_CAPTURE_SLOTS - 1) throw error;
      }
    }
  }

  const leases = [];
  try {
    const reservations = identities === null
      ? Array.from({ length: PROJECT_CAPTURE_SLOTS }, (_, capacitySlot) => ({ capacitySlot }))
      : identities.map((browserResourceIdentity) => ({ browserResourceIdentity }));
    for (const reservation of reservations) {
      leases.push(await acquireSingleQaBrowserCapacity({
        rootDir,
        ownerId,
        ...reservation,
      }));
    }
  } catch (error) {
    try {
      await releaseCapacityLeasesReverse(leases);
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        'QA_BROWSER_CAPACITY_ACQUIRE_ROLLBACK_FAILED',
        { cause: error },
      );
    }
    throw error;
  }
  return combineCapacityLeases(leases, {
    resourceIdentities: identities,
    projectScope: identities === null ? requireProjectRoot(rootDir).scopePath : null,
  });
}

function combineCapacityLeases(leases, { resourceIdentities, projectScope }) {
  let released = false;
  let releasePromise = null;
  const record = {
    resourceIdentities,
    projectScope,
    reservationMode: 'exclusive',
    borrowerCount: 0,
    releasing: false,
    released: false,
  };
  const lease = Object.freeze({
    endpoint: leases[0].endpoint,
    owner: leases[0].owner,
    endpoints: Object.freeze(leases.map((lease) => lease.endpoint)),
    owners: Object.freeze(leases.map((lease) => lease.owner)),
    resources: Object.freeze(leases.map((lease) => Object.freeze({
      scope: lease.owner.scope,
      endpoint: lease.endpoint,
    }))),
    release() {
      if (released) {
        return Promise.resolve(Object.freeze({
          resource: 'browser_capacity_set',
          status: 'already_released',
        }));
      }
      if (!releasePromise) {
        releasePromise = (async () => {
          if (record.borrowerCount > 0) {
            throw new Error(
              `QA_BROWSER_CAPACITY_BORROWERS_ACTIVE:count=${record.borrowerCount}`,
            );
          }
          record.releasing = true;
          const receipts = await releaseCapacityLeasesReverse(leases);
          released = true;
          record.released = true;
          return Object.freeze({
            resource: 'browser_capacity_set',
            status: 'released',
            receipts,
          });
        })().catch((error) => {
          record.releasing = false;
          releasePromise = null;
          throw error;
        });
      }
      return releasePromise;
    },
  });
  capacityLeaseRecords.set(lease, record);
  return lease;
}

/**
 * Creates a non-owning child claim only when the caller proves it already
 * holds the requested host resources or bounded shared project reservation.
 * Releasing the child never releases the parent lifecycle reservation.
 */
export function borrowQaBrowserCapacity(capacityLease, {
  browserResourceIdentities,
  rootDir,
  reservationMode = 'exclusive',
} = {}) {
  const record = capacityLeaseRecords.get(capacityLease);
  const requested = normalizeHostBrowserResourceIdentities(
    browserResourceIdentities,
  );
  if (
    !record
    || record.releasing
    || record.released
  ) {
    throw new Error('QA_BROWSER_CAPACITY_RESERVATION_INVALID');
  }
  if (requested === null) {
    if (record.projectScope === null || !['shared_capture', 'isolated_functional'].includes(reservationMode)
      || record.reservationMode !== reservationMode
      || requireProjectRoot(rootDir).scopePath !== record.projectScope) {
      throw new Error('QA_BROWSER_CAPACITY_RESERVATION_SCOPE_MISMATCH');
    }
  } else if (!record.resourceIdentities
    || requested.some((identity) => !new Set(record.resourceIdentities).has(identity))) {
    throw new Error('QA_BROWSER_CAPACITY_RESERVATION_SCOPE_MISMATCH');
  }
  record.borrowerCount += 1;
  let released = false;
  return Object.freeze({
    release() {
      const status = released ? 'already_released' : 'released';
      if (!released) {
        released = true;
        record.borrowerCount -= 1;
      }
      return Promise.resolve(Object.freeze({
        resource: 'browser_capacity_borrow',
        status,
        parentAction: 'preserved',
      }));
    },
  });
}

export {
  acquireQaBrowserCapacity as acquireBrowserCapacity,
  borrowQaBrowserCapacity as borrowBrowserCapacity,
  inspectQaBrowserCapacity as inspectBrowserCapacity,
  resolveQaBrowserCapacityEndpoint as resolveBrowserCapacityEndpoint,
};
