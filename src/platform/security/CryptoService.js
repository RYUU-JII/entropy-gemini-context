/**
 * CryptoService
 *
 * Handles AES-GCM encryption/decryption and Web Worker management.
 * Extracted from DBManager.
 */

import {
    WorkerRequestClient,
    WORKER_RUNTIME_SURFACE_IDS,
    WORKER_RUNTIME_TASK_TYPE,
    createWorkerRequestClientConfig,
    recordWorkerRuntimeSurfaceFallback,
    requireWorkerRuntimeSurface,
} from '../workers/runtime/index.js';
import cryptoWorkerUrl from '../workers/crypto.worker.js?worker&url';
import KeyMaterialRepository from '../storage/security/KeyMaterialRepository.js';
import { encryptLogRecord, decryptLogRecord, requireEncryptedLogRecord } from './encryptedLogContract.js';

const ENC_ALGO = 'AES-GCM';
const CRYPTO_WORKER_SURFACE = requireWorkerRuntimeSurface(WORKER_RUNTIME_SURFACE_IDS.CRYPTO);
const keyMaterialRepository = KeyMaterialRepository.getInstance();

function createCryptoServiceError(code, cause = null) {
    const error = new Error(code);
    error.code = code;
    if (cause) error.cause = cause;
    return error;
}

const resolveCryptoTaskType = (type) => {
    switch (String(type || '').trim()) {
        case 'INIT':
            return WORKER_RUNTIME_TASK_TYPE.CRYPTO_INIT;
        case 'ENCRYPT_BATCH':
            return WORKER_RUNTIME_TASK_TYPE.CRYPTO_ENCRYPT_BATCH;
        case 'DECRYPT_BATCH':
            return WORKER_RUNTIME_TASK_TYPE.CRYPTO_DECRYPT_BATCH;
        default:
            return WORKER_RUNTIME_TASK_TYPE.CRYPTO_ENCRYPT_BATCH;
    }
};

class CryptoService {
    constructor() {
        this.key = null; // CryptoKey
        this.initPromise = null;

        // CryptoWorker state
        this._workerClient = null;
        this._workerReady = false;
        this._keyGeneration = 0;
        keyMaterialRepository.onLock(() => this.clearKeyMaterial());
        this._localMainThreadReason = null;
        this._localMainThreadError = null;
        this._localFallbackEventKeys = new Set();
    }

    static getInstance() {
        if (!CryptoService.instance) CryptoService.instance = new CryptoService();
        return CryptoService.instance;
    }

    clearKeyMaterial() {
        this._keyGeneration += 1;
        this.key = null;
        this.initPromise = null;
        this._disableWorker('SECURITY_VAULT_LOCKED');
    }

    async init() {
        await keyMaterialRepository.requireUnlocked();
        if (this.initPromise) return this.initPromise;
        const generation = this._keyGeneration;
        const initialization = (async () => {
            await this._loadUnlockedKey();
            if (generation !== this._keyGeneration) throw createCryptoServiceError('SECURITY_VAULT_LOCKED');
            await this._initWorker();
            if (generation !== this._keyGeneration) throw createCryptoServiceError('SECURITY_VAULT_LOCKED');
        })();
        this.initPromise = initialization;
        try {
            await initialization;
        } catch (error) {
            if (this.initPromise === initialization) this.initPromise = null;
            throw error;
        }
    }

    // ===========================================================
    // Worker Management
    // ===========================================================

    _getWorkerClient() {
        if (this._workerClient) {
            return this._workerClient;
        }
        this._workerClient = new WorkerRequestClient(createWorkerRequestClientConfig(
            WORKER_RUNTIME_SURFACE_IDS.CRYPTO,
            {
                workerFactory: () => {
                    const workerUrl = new URL(cryptoWorkerUrl, import.meta.url);
                    return new Worker(workerUrl, { type: 'module' });
                },
                initMessage: { type: 'PING' },
                initReadyTypes: ['READY', 'PONG'],
            },
        ));
        return this._workerClient;
    }

    /**
     * Initialize CryptoWorker for background encryption/decryption
     * Falls back to main thread if worker fails
     */
    async _initWorker() {
        if (typeof Worker === 'undefined') {
            this._localMainThreadReason = 'WORKER_API_UNAVAILABLE';
            this._localMainThreadError = null;
            return;
        }
        if (!this.key) {
            this._localMainThreadReason = 'KEY_UNAVAILABLE';
            this._localMainThreadError = null;
            return;
        }

        try {
            const client = this._getWorkerClient();
            const ready = await client.init();
            if (!ready) {
                throw new Error(client.lastDisableReason || 'CryptoWorker unavailable');
            }

            await this._workerRequest(
                'INIT',
                { key: this.key },
                {
                    timeoutMs: 30000,
                    taskType: WORKER_RUNTIME_TASK_TYPE.CRYPTO_INIT,
                },
            );
            this._workerReady = true;
            this._localMainThreadReason = null;
            this._localMainThreadError = null;
            console.debug('[CryptoService] CryptoWorker initialized successfully');
        } catch (err) {
            console.warn('[CryptoService] Failed to init worker, using main thread:', err.message);
            this._disableWorker('WORKER_INIT_FAILED', err);
        }
    }

    _disableWorker(reason = 'WORKER_DISABLED', error = null) {
        this._workerReady = false;
        this._localMainThreadReason = reason;
        this._localMainThreadError = error;
        if (this._workerClient) {
            this._workerClient.disable(reason);
            this._workerClient = null;
        }
    }

    _recordLocalMainThreadFallback({
        taskType,
        itemCount = 0,
        reason = this._localMainThreadReason || 'WORKER_NOT_READY',
        error = this._localMainThreadError,
    } = {}) {
        const resolvedTaskType = taskType || WORKER_RUNTIME_TASK_TYPE.CRYPTO_ENCRYPT_BATCH;
        const resolvedReason = String(reason || 'WORKER_NOT_READY');
        const eventKey = `${resolvedTaskType}:${resolvedReason}`;
        if (this._localFallbackEventKeys.has(eventKey)) {
            return;
        }
        this._localFallbackEventKeys.add(eventKey);
        recordWorkerRuntimeSurfaceFallback({
            surfaceId: WORKER_RUNTIME_SURFACE_IDS.CRYPTO,
            stage: 'local_main_thread',
            reason: resolvedReason,
            workerMessageType: 'local_main_thread',
            error,
            taskType: resolvedTaskType,
            details: {
                itemCount: Math.max(0, Math.floor(Number(itemCount) || 0)),
                businessResultPreserved: true,
            },
            messagePrefix: 'CRYPTO_WORKER_LOCAL_MAIN_THREAD',
        });
    }

    /**
     * Send request to worker and return promise
     */
    async _workerRequest(type, payload, options = {}) {
        const client = this._getWorkerClient();
        const taskType = options?.taskType || resolveCryptoTaskType(type);
        const generation = this._keyGeneration;
        try {
            const result = await client.request(type, payload, {
                taskType,
                priority: CRYPTO_WORKER_SURFACE.priority,
                timeoutMs: options?.timeoutMs,
            });
            if (generation !== this._keyGeneration) throw createCryptoServiceError('SECURITY_VAULT_LOCKED');
            return result;
        } catch (error) {
            this._workerReady = false;
            throw error;
        }
    }

    // ===========================================================
    // Security (AES-GCM Encryption)
    // ===========================================================

    async _loadUnlockedKey() {
        if (this.key) return;
        const generation = this._keyGeneration;
        const jwk = await keyMaterialRepository.getLogCryptoJwk();
        const key = await crypto.subtle.importKey('jwk', jwk,
            { name: ENC_ALGO, length: 256 }, false, ['encrypt', 'decrypt']);
        if (generation !== this._keyGeneration) throw createCryptoServiceError('SECURITY_VAULT_LOCKED');
        this.key = key;
    }

    async _encryptOne(data) {
        if (!this.key) throw createCryptoServiceError('SECURITY_VAULT_LOCKED');
        const generation = this._keyGeneration;
        const record = await encryptLogRecord(this.key, data);
        if (generation !== this._keyGeneration) throw createCryptoServiceError('SECURITY_VAULT_LOCKED');
        return record;
    }

    async _decryptOne(record) {
        if (!this.key) throw createCryptoServiceError('SECURITY_VAULT_LOCKED');
        const generation = this._keyGeneration;
        const value = await decryptLogRecord(this.key, record);
        if (generation !== this._keyGeneration) throw createCryptoServiceError('SECURITY_VAULT_LOCKED');
        return value;
    }

    // Public API

    async encryptBatch(items) {
        await this.init();
        const safeItems = Array.isArray(items) ? items : [];
        if (safeItems.length === 0) return [];

        // Try Worker-based encryption first
        if (this._workerReady && this._workerClient && this._workerClient.isReady()) {
            try {
                const records = await this._workerRequest('ENCRYPT_BATCH', { items: safeItems });
                if (!Array.isArray(records) || records.length !== safeItems.length) {
                    throw createCryptoServiceError('CRYPTO_ENCRYPT_BATCH_RESULT_INVALID');
                }
                records.forEach(requireEncryptedLogRecord);
                return records;
            } catch (workerErr) {
                console.warn('[CryptoService] Worker encryption failed, falling back:', workerErr.message);
                this._disableWorker('WORKER_ENCRYPT_FAILED', workerErr);
            }
        }

        this._recordLocalMainThreadFallback({
            taskType: WORKER_RUNTIME_TASK_TYPE.CRYPTO_ENCRYPT_BATCH,
            itemCount: safeItems.length,
        });
        return Promise.all(safeItems.map((log) => this._encryptOne(log)));
    }

    async decryptBatch(records) {
        await this.init();
        const safeRecords = Array.isArray(records) ? records : [];

        if (safeRecords.length === 0) return [];

        // Try Worker-based decryption first
        if (this._workerReady && this._workerClient && this._workerClient.isReady()) {
            try {
                const workerResult = await this._workerRequest('DECRYPT_BATCH', { records: safeRecords });
                if (!Array.isArray(workerResult) || workerResult.length !== safeRecords.length) {
                    throw createCryptoServiceError('CRYPTO_DECRYPT_BATCH_RESULT_INVALID');
                }
                return workerResult;
            } catch (workerErr) {
                console.warn('[CryptoService] Worker decryption failed, falling back:', workerErr.message);
                const reason = workerErr?.code === 'CRYPTO_DECRYPT_BATCH_RESULT_INVALID'
                    ? 'WORKER_DECRYPT_RESULT_INVALID'
                    : 'WORKER_DECRYPT_FAILED';
                this._disableWorker(reason, workerErr);
            }
        }

        this._recordLocalMainThreadFallback({
            taskType: WORKER_RUNTIME_TASK_TYPE.CRYPTO_DECRYPT_BATCH,
            itemCount: safeRecords.length,
        });
        return Promise.all(safeRecords.map((r) => this._decryptOne(r)));
    }

    async encrypt(data) {
        await this.init();
        return this._encryptOne(data);
    }

    async decrypt(record) {
        await this.init();
        return this._decryptOne(record);
    }
}

export default CryptoService;
