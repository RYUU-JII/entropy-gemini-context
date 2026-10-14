import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

import {
  resolveBrowserQaProjectScope,
  resolveBrowserQaResourceScope,
} from './browserResourceScope.mjs';

const LOOPBACK_HOST = '127.0.0.1';
const BROKER_PORT_BASE = 33_000;
const BROKER_PORT_SPAN = 16_000;
const OWNER_RESPONSE_TIMEOUT_MS = 500;
const MAX_OWNER_RESPONSE_BYTES = 8 * 1024;
const BROKER_SCHEMA_VERSION = 1;
const ENVIRONMENT_ID_PATTERN = /^[a-z][a-z0-9_]*$/u;
const RUNTIME_KEYS = new Set([
  'status',
  'browser',
  'browserEpoch',
  'installationId',
  'profileSlotId',
  'identityStatus',
  'nextAction',
  'failures',
  'targetCount',
  'pageTargetCount',
]);
const RUNTIME_STRING_KEYS = new Set([
  'status',
  'browser',
  'browserEpoch',
  'installationId',
  'profileSlotId',
  'identityStatus',
  'nextAction',
]);
const RUNTIME_COUNT_KEYS = new Set(['targetCount', 'pageTargetCount']);
const MAX_RUNTIME_BYTES = 4 * 1024;
const MAX_RUNTIME_STRING_LENGTH = 240;
const MAX_RUNTIME_FAILURES = 32;

function normalizeRuntimeSnapshot(runtime) {
  if (
    !runtime
    || typeof runtime !== 'object'
    || Array.isArray(runtime)
    || !['Object', undefined].includes(runtime.constructor?.name)
  ) {
    throw new Error('QA_BROWSER_BROKER_RUNTIME_INVALID');
  }
  const unknownKey = Object.keys(runtime).find((key) => !RUNTIME_KEYS.has(key));
  if (unknownKey) {
    throw new Error(`QA_BROWSER_BROKER_RUNTIME_KEY_UNKNOWN:${unknownKey}`);
  }
  if (typeof runtime.status !== 'string' || !runtime.status.trim()) {
    throw new Error('QA_BROWSER_BROKER_RUNTIME_STATUS_REQUIRED');
  }
  const normalized = {};
  for (const key of RUNTIME_STRING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(runtime, key)) continue;
    const value = runtime[key];
    if (value === null && key !== 'status') {
      normalized[key] = null;
      continue;
    }
    if (
      typeof value !== 'string'
      || !value.trim()
      || value !== value.trim()
      || value.length > MAX_RUNTIME_STRING_LENGTH
      || /[\r\n]/u.test(value)
    ) {
      throw new Error(`QA_BROWSER_BROKER_RUNTIME_STRING_INVALID:${key}`);
    }
    normalized[key] = value;
  }
  if (Object.prototype.hasOwnProperty.call(runtime, 'failures')) {
    if (
      !Array.isArray(runtime.failures)
      || runtime.failures.length > MAX_RUNTIME_FAILURES
      || runtime.failures.some((failure) => (
        typeof failure !== 'string'
        || !failure.trim()
        || failure !== failure.trim()
        || failure.length > MAX_RUNTIME_STRING_LENGTH
        || /[\r\n]/u.test(failure)
      ))
    ) {
      throw new Error('QA_BROWSER_BROKER_RUNTIME_FAILURES_INVALID');
    }
    normalized.failures = Object.freeze([...runtime.failures]);
  }
  for (const key of RUNTIME_COUNT_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(runtime, key)) continue;
    const value = runtime[key];
    if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000) {
      throw new Error(`QA_BROWSER_BROKER_RUNTIME_COUNT_INVALID:${key}`);
    }
    normalized[key] = value;
  }
  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > MAX_RUNTIME_BYTES) {
    throw new Error('QA_BROWSER_BROKER_RUNTIME_TOO_LARGE');
  }
  return Object.freeze(normalized);
}

function requireProjectRoot(rootDir) {
  try {
    return resolveBrowserQaProjectScope(rootDir).projectRoot;
  } catch (error) {
    if (error?.message === 'QA_BROWSER_PROJECT_ROOT_REQUIRED') {
      throw new Error('QA_BROWSER_BROKER_ROOT_REQUIRED', { cause: error });
    }
    throw new Error(`QA_BROWSER_BROKER_ROOT_INVALID:${error?.message || error}`, {
      cause: error,
    });
  }
}

function requireEnvironment(environment) {
  if (
    !environment
    || !ENVIRONMENT_ID_PATTERN.test(environment.id || '')
    || !['attach_only', 'owned'].includes(environment.processOwnership)
  ) {
    throw new Error('QA_BROWSER_BROKER_ENVIRONMENT_INVALID');
  }
  return environment;
}

function requireOwnerId(ownerId) {
  if (
    typeof ownerId !== 'string'
    || !ownerId.trim()
    || ownerId !== ownerId.trim()
    || ownerId.length > 200
    || /[\r\n]/u.test(ownerId)
  ) {
    throw new Error('QA_BROWSER_BROKER_OWNER_INVALID');
  }
  return ownerId;
}

export function resolveQaBrowserBrokerEndpoint({ rootDir, environment, ownedSessionId = null } = {}) {
  const canonicalRoot = requireProjectRoot(rootDir);
  const normalizedEnvironment = requireEnvironment(environment);
  if (ownedSessionId !== null && (
    typeof ownedSessionId !== 'string'
    || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/u.test(ownedSessionId)
    || normalizedEnvironment.processOwnership !== 'owned'
    || normalizedEnvironment.lifecyclePolicy !== 'per_run'
    || normalizedEnvironment.profile || normalizedEnvironment.cdpEndpoint
    || normalizedEnvironment.profileSlotId || normalizedEnvironment.extensionSlot
  )) throw new Error('QA_BROWSER_BROKER_OWNED_SESSION_INVALID');
  const resourceScope = resolveBrowserQaResourceScope({
    rootDir: canonicalRoot,
    environment: normalizedEnvironment,
  });
  const digest = createHash('sha256')
    .update(resourceScope.resourceIdentity)
    .update(ownedSessionId === null ? '' : '\0owned_session\0' + ownedSessionId)
    .digest();
  const scope = digest.toString('hex').slice(0, 20);
  const port = BROKER_PORT_BASE + (digest.readUInt16BE(0) % BROKER_PORT_SPAN);
  return Object.freeze({
    host: LOOPBACK_HOST,
    port,
    scope,
    rootDir: canonicalRoot,
    resourceScope: resourceScope.scopeKind,
    environmentId: normalizedEnvironment.id,
    ownedSessionId,
    statePath: path.join(
      canonicalRoot,
      '.artifacts',
      'qa',
      'browser-broker',
      ownedSessionId === null ? `${normalizedEnvironment.id}.json`
        : `${normalizedEnvironment.id}.${scope}.json`,
    ),
  });
}

async function writeAtomicJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.unlink(temporaryPath).catch((error) => {
      if (error?.code !== 'ENOENT') throw error;
    });
  }
}

export async function readQaBrowserBrokerObservation({
  rootDir,
  environment,
  ownedSessionId = null,
} = {}) {
  const endpoint = resolveQaBrowserBrokerEndpoint({ rootDir, environment, ownedSessionId });
  try {
    const parsed = JSON.parse(await fs.readFile(endpoint.statePath, 'utf8'));
    if (
      parsed?.schemaVersion !== BROKER_SCHEMA_VERSION
      || parsed?.scope !== endpoint.scope
      || parsed?.environmentId !== endpoint.environmentId
    ) {
      return Object.freeze({ status: 'invalid', statePath: endpoint.statePath });
    }
    return Object.freeze({
      status: 'available',
      statePath: endpoint.statePath,
      record: Object.freeze(parsed),
    });
  } catch (error) {
    return Object.freeze({
      status: error?.code === 'ENOENT' ? 'missing' : 'invalid',
      statePath: endpoint.statePath,
      ...(error?.code === 'ENOENT' ? {} : { error: error?.message || String(error) }),
    });
  }
}

function createBrokerServer(readSnapshot) {
  const server = net.createServer((socket) => {
    socket.on('error', () => {});
    socket.end(`${JSON.stringify(readSnapshot())}\n`);
  });
  server.maxConnections = 16;
  return server;
}

function listen(server, endpoint) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
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

export function inspectQaBrowserBroker({ rootDir, environment, ownedSessionId = null } = {}) {
  const endpoint = resolveQaBrowserBrokerEndpoint({ rootDir, environment, ownedSessionId });
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: endpoint.host, port: endpoint.port });
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
      if (Buffer.byteLength(response, 'utf8') > MAX_OWNER_RESPONSE_BYTES) finish(null);
    });
    socket.on('end', () => {
      try {
        const owner = JSON.parse(response.trim());
        if (
          owner?.schemaVersion !== BROKER_SCHEMA_VERSION
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

function createBusyError(endpoint, owner) {
  const detail = owner
    ? `${endpoint.environmentId}:${owner.ownerId}:pid=${owner.pid}`
    : `${endpoint.environmentId}:unknown_owner:endpoint=${endpoint.host}:${endpoint.port}`;
  const error = new Error(`QA_BROWSER_BROKER_BUSY:${detail}`);
  error.code = 'QA_BROWSER_BROKER_BUSY';
  error.owner = owner;
  error.endpoint = Object.freeze({ host: endpoint.host, port: endpoint.port });
  return error;
}

function publicSnapshot(snapshot) {
  return Object.freeze({
    schemaVersion: snapshot.schemaVersion,
    scope: snapshot.scope,
    leaseId: snapshot.leaseId,
    environmentId: snapshot.environmentId,
    browserClass: snapshot.browserClass,
    processOwnership: snapshot.processOwnership,
    ownerId: snapshot.ownerId,
    pid: snapshot.pid,
    acquiredAt: snapshot.acquiredAt,
    runtime: snapshot.runtime,
    ...(snapshot.ownedSessionId === null ? {} : { ownedSessionId: snapshot.ownedSessionId }),
  });
}

export async function acquireQaBrowserBroker({
  rootDir,
  environment,
  ownerId,
  ownedSessionId = null,
} = {}) {
  const normalizedEnvironment = requireEnvironment(environment);
  const endpoint = resolveQaBrowserBrokerEndpoint({
    rootDir,
    environment: normalizedEnvironment,
    ownedSessionId,
  });
  let snapshot = {
    schemaVersion: BROKER_SCHEMA_VERSION,
    scope: endpoint.scope,
    leaseId: randomUUID(),
    environmentId: normalizedEnvironment.id,
    browserClass: normalizedEnvironment.browserClass || null,
    processOwnership: normalizedEnvironment.processOwnership,
    ownerId: requireOwnerId(ownerId),
    pid: process.pid,
    acquiredAt: new Date().toISOString(),
    runtime: Object.freeze({ status: 'preflight_pending' }),
    ownedSessionId,
  };
  const server = createBrokerServer(() => publicSnapshot(snapshot));
  try {
    await listen(server, endpoint);
  } catch (error) {
    if (error?.code === 'EADDRINUSE') {
      throw createBusyError(
        endpoint,
        await inspectQaBrowserBroker({
          rootDir: endpoint.rootDir,
          environment: normalizedEnvironment,
          ownedSessionId,
        }),
      );
    }
    const acquireError = new Error(
      `QA_BROWSER_BROKER_ACQUIRE_FAILED:${error?.code || 'unknown'}:${error?.message || error}`,
      { cause: error },
    );
    acquireError.code = 'QA_BROWSER_BROKER_ACQUIRE_FAILED';
    throw acquireError;
  }
  server.unref();
  try {
    await writeAtomicJson(endpoint.statePath, {
      ...publicSnapshot(snapshot),
      state: 'leased',
      observedAt: new Date().toISOString(),
    });
  } catch (error) {
    await close(server).catch(() => {});
    throw new Error('QA_BROWSER_BROKER_OBSERVATION_WRITE_FAILED', { cause: error });
  }

  let released = false;
  let releasePromise = null;
  return Object.freeze({
    endpoint: Object.freeze({ host: endpoint.host, port: endpoint.port }),
    statePath: endpoint.statePath,
    get owner() {
      return publicSnapshot(snapshot);
    },
    async updateRuntime(runtime) {
      if (released) throw new Error('QA_BROWSER_BROKER_ALREADY_RELEASED');
      const normalizedRuntime = normalizeRuntimeSnapshot(runtime);
      snapshot = {
        ...snapshot,
        runtime: normalizedRuntime,
      };
      await writeAtomicJson(endpoint.statePath, {
        ...publicSnapshot(snapshot),
        state: 'leased',
        observedAt: new Date().toISOString(),
      });
      return publicSnapshot(snapshot);
    },
    release() {
      if (released) {
        return Promise.resolve(Object.freeze({
          resource: 'browser_broker',
          status: 'already_released',
        }));
      }
      if (!releasePromise) {
        releasePromise = (async () => {
          await close(server);
          await writeAtomicJson(endpoint.statePath, {
            ...publicSnapshot(snapshot),
            state: 'idle',
            releasedAt: new Date().toISOString(),
            observedAt: new Date().toISOString(),
          });
          released = true;
          return Object.freeze({
            resource: 'browser_broker',
            environmentId: normalizedEnvironment.id,
            status: 'released',
            processAction: normalizedEnvironment.processOwnership === 'attach_only'
              ? 'external_process_preserved'
              : 'owned_process_delegated',
          });
        })().catch((error) => {
          releasePromise = null;
          throw error;
        });
      }
      return releasePromise;
    },
  });
}

export {
  acquireQaBrowserBroker as acquireBrowserBroker,
  inspectQaBrowserBroker as inspectBrowserBroker,
  readQaBrowserBrokerObservation as readBrowserBrokerObservation,
  resolveQaBrowserBrokerEndpoint as resolveBrowserBrokerEndpoint,
};
