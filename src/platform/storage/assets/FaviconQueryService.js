import {
  getRuntimeId,
  runtimeOnMessageAddListener,
  runtimeSendMessage,
} from '../../messaging/runtime/runtimeMessaging.js';
import { MESSAGE_ACTIONS, MESSAGE_TYPES } from '../../messaging/contracts/messageTypes.js';
import { normalizeDomain } from '../../../lib/domain.js';
import { isAllowedFaviconDataUrl } from './faviconDataUrlPolicy.js';

function normalizeFaviconDomain(domain) {
  const normalized = normalizeDomain(domain);
  return normalized ? normalized.toLowerCase() : '';
}

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MISS_TTL_MS = 15 * 1000;
const DEFAULT_CACHE_MAX_ENTRIES = 128;

function normalizePositiveInteger(value, fallback) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export class FaviconQueryService {
  constructor({
    getRuntimeIdFn = getRuntimeId,
    runtimeSendMessageFn = runtimeSendMessage,
    runtimeOnMessageAddListenerFn = runtimeOnMessageAddListener,
    nowFn = Date.now,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    missTtlMs = DEFAULT_MISS_TTL_MS,
    cacheMaxEntries = DEFAULT_CACHE_MAX_ENTRIES,
  } = {}) {
    this.getRuntimeId = getRuntimeIdFn;
    this.runtimeSendMessage = runtimeSendMessageFn;
    this.runtimeOnMessageAddListener = runtimeOnMessageAddListenerFn;
    this.now = nowFn;
    this.cacheTtlMs = normalizePositiveInteger(cacheTtlMs, DEFAULT_CACHE_TTL_MS);
    this.missTtlMs = normalizePositiveInteger(missTtlMs, DEFAULT_MISS_TTL_MS);
    this.cacheMaxEntries = normalizePositiveInteger(
      cacheMaxEntries,
      DEFAULT_CACHE_MAX_ENTRIES,
    );
    this.cache = new Map();
    this.inFlight = new Map();
    this.subscribers = new Map();
    this.runtimeSubscribed = false;
  }

  ensureRuntimeSubscription() {
    if (this.runtimeSubscribed || !this.getRuntimeId()) return;
    this.runtimeSubscribed = this.runtimeOnMessageAddListener((message, sender) => {
      if (sender?.tab) return;
      if (message?.type !== MESSAGE_TYPES.FAVICON_CACHE_CHANGED) return;
      if (message.domain === null || typeof message.domain === 'string') {
        this.invalidate(message.domain);
      }
    });
  }

  subscribe(domain, listener) {
    const normalizedDomain = normalizeFaviconDomain(domain);
    if (!normalizedDomain || typeof listener !== 'function') return () => {};
    this.ensureRuntimeSubscription();
    let listeners = this.subscribers.get(normalizedDomain);
    if (!listeners) {
      listeners = new Set();
      this.subscribers.set(normalizedDomain, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.subscribers.delete(normalizedDomain);
    };
  }

  invalidate(domain = null) {
    const normalizedDomain = domain === null ? null : normalizeFaviconDomain(domain);
    if (normalizedDomain === '') return;
    if (normalizedDomain === null) {
      this.cache.clear();
      this.inFlight.clear();
    } else {
      this.cache.delete(normalizedDomain);
      this.inFlight.delete(normalizedDomain);
    }
    for (const [subscribedDomain, listeners] of this.subscribers) {
      if (normalizedDomain !== null && subscribedDomain !== normalizedDomain) continue;
      for (const listener of [...listeners]) listener();
    }
  }

  readCachedDataUrl(domain, now) {
    const entry = this.cache.get(domain);
    if (!entry) return null;

    if (entry.expiresAt <= now) {
      this.cache.delete(domain);
      return null;
    }

    this.cache.delete(domain);
    this.cache.set(domain, entry);
    return entry.dataUrl;
  }

  writeCachedDataUrl(domain, dataUrl, now) {
    for (const [cachedDomain, entry] of this.cache) {
      if (entry.expiresAt <= now) this.cache.delete(cachedDomain);
    }

    this.cache.delete(domain);
    while (this.cache.size >= this.cacheMaxEntries) {
      const oldestDomain = this.cache.keys().next().value;
      if (oldestDomain === undefined) break;
      this.cache.delete(oldestDomain);
    }

    this.cache.set(domain, {
      dataUrl,
      expiresAt: now + (dataUrl ? this.cacheTtlMs : this.missTtlMs),
    });
  }

  async getDataUrl(domain) {
    const normalizedDomain = normalizeFaviconDomain(domain);
    if (!normalizedDomain || !this.getRuntimeId()) return '';
    this.ensureRuntimeSubscription();

    const now = this.now();
    const cachedDataUrl = this.readCachedDataUrl(normalizedDomain, now);
    if (cachedDataUrl !== null) return cachedDataUrl;

    const pendingRequest = this.inFlight.get(normalizedDomain);
    if (pendingRequest) return pendingRequest;

    let request;
    request = (async () => {
      let response;
      try {
        response = await this.runtimeSendMessage({
          action: MESSAGE_ACTIONS.GET_FAVICON_DATA,
          domain: normalizedDomain,
        });
      } catch (error) {
        if (this.inFlight.get(normalizedDomain) !== request) return this.getDataUrl(normalizedDomain);
        throw error;
      }
      // A committed save/clear supersedes reads that started before its event.
      if (this.inFlight.get(normalizedDomain) !== request) return this.getDataUrl(normalizedDomain);
      if (response?.success !== true) {
        throw new Error(response?.error || 'FAVICON_QUERY_RESPONSE_INVALID');
      }
      const dataUrl = response.dataUrl;
      if (typeof dataUrl !== 'string' || (dataUrl !== '' && !isAllowedFaviconDataUrl(dataUrl))) {
        throw new Error('FAVICON_QUERY_INVALID_DATA_URL');
      }
      this.writeCachedDataUrl(normalizedDomain, dataUrl, this.now());
      return dataUrl;
    })();

    this.inFlight.set(normalizedDomain, request);

    try {
      return await request;
    } finally {
      if (this.inFlight.get(normalizedDomain) === request) {
        this.inFlight.delete(normalizedDomain);
      }
    }
  }
}

export const createFaviconQueryService = (options = {}) => new FaviconQueryService(options);

export const faviconQueryService = createFaviconQueryService();

export async function queryFaviconDataUrl(domain, options = {}) {
  const service = options.faviconQueryService || (Object.keys(options).length ? createFaviconQueryService(options) : faviconQueryService);
  return service.getDataUrl(domain);
}

export default FaviconQueryService;
