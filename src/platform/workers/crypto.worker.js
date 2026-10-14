/**
 * CryptoWorker - Dedicated Worker for AES-GCM Encryption/Decryption
 * 
 * This worker handles CPU-intensive cryptographic operations
 * to prevent main thread blocking.
 * 
 * Message Types:
 * - INIT: Initialize with a nonextractable CryptoKey
 * - ENCRYPT_BATCH: Encrypt multiple items
 * - DECRYPT_BATCH: Decrypt multiple records
 */

import { encryptLogRecord, decryptLogRecord } from '../security/encryptedLogContract.js';

let cryptoKey = null;

async function encryptItem(data) {
    if (!cryptoKey) throw new Error('SECURITY_VAULT_LOCKED');
    return encryptLogRecord(cryptoKey, data);
}

async function decryptItem(record) {
    if (!cryptoKey) throw new Error('SECURITY_VAULT_LOCKED');
    return decryptLogRecord(cryptoKey, record);
}

/**
 * Handle incoming messages from main thread
 */
self.onmessage = async (event) => {
    const message = event?.data && typeof event.data === 'object' ? event.data : {};
    const { type, id, payload = {} } = message;

    try {
        switch (type) {
            case 'INIT': {
                // Structured clone transfers a nonextractable CryptoKey only.
                if (!payload.key || payload.key.type !== 'secret' || payload.key.extractable !== false
                    || payload.key.algorithm?.name !== 'AES-GCM' || payload.key.algorithm?.length !== 256) {
                    throw new Error('CRYPTO_WORKER_KEY_INVALID');
                }
                cryptoKey = payload.key;
                self.postMessage({ type: 'INIT_SUCCESS', id });
                break;
            }

            case 'ENCRYPT_BATCH': {
                // Encrypt multiple items in parallel
                const items = Array.isArray(payload.items) ? payload.items : [];
                const results = await Promise.all(items.map(encryptItem));
                self.postMessage({ type: 'ENCRYPTED', id, results });
                break;
            }

            case 'DECRYPT_BATCH': {
                // Decrypt multiple records in parallel
                const records = Array.isArray(payload.records) ? payload.records : [];
                const results = await Promise.all(records.map(decryptItem));
                self.postMessage({ type: 'DECRYPTED', id, results });
                break;
            }

            case 'PING': {
                // Health check
                self.postMessage({ type: 'PONG', id, ready: !!cryptoKey });
                break;
            }

            default:
                self.postMessage({
                    type: 'ERROR',
                    id,
                    error: `Unknown message type: ${type}`
                });
        }
    } catch (err) {
        self.postMessage({
            type: 'ERROR',
            id,
            error: err.message || 'Unknown error in CryptoWorker'
        });
    }
};

// Signal worker is ready
self.postMessage({ type: 'READY' });
