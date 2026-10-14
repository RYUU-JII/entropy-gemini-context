/**
 * HMAC Key Generation Utility
 * 
 * Generates privacy-preserving keys for URL tracking:
 * - Site keys: HMAC(secret, eTLD+1) - for site-level loop detection
 * - Page keys: HMAC(secret, eTLD+1 + coarse_path_bucket) - for page-level loop detection
 * 
 * Keys are NOT reversible - original URLs cannot be recovered from keys.
 */

import KeyMaterialRepository from '../../../platform/storage/security/KeyMaterialRepository.js';

let cachedSecret = null;
let secretInitializationPromise = null;
let secretRevision = 0;
const keyMaterialRepository = KeyMaterialRepository.getInstance();
keyMaterialRepository.onProtectionKeysInvalidated(() => {
    secretRevision += 1;
    cachedSecret = null;
});

/**
 * Get the admitted protection HMAC key for this installation
 * @returns {Promise<CryptoKey>}
 */
async function getProtectionSecret() {
    await keyMaterialRepository.requireProtectionKeys();
    if (cachedSecret) return cachedSecret;

    if (!secretInitializationPromise) {
        const initialization = initializeSecret().finally(() => {
            if (secretInitializationPromise === initialization) {
                secretInitializationPromise = null;
            }
        });
        secretInitializationPromise = initialization;
    }

    return secretInitializationPromise;
}

async function initializeSecret() {
    const revision = secretRevision;
    const storedSecret = await keyMaterialRepository.getClseHmacSecret();
    const secret = await crypto.subtle.importKey(
        'jwk', storedSecret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    if (revision !== secretRevision) throw new Error('SECURITY_VAULT_LOCKED');

    // Only a successfully imported key from the current vault may serve callers.
    cachedSecret = secret;
    return secret;
}

/**
 * Generate HMAC signature for a string
 * @param {string} data - Data to sign
 * @returns {Promise<string|null>} - Hex-encoded HMAC (first 16 chars for brevity)
 */
async function hmac(data) {
    const revision = secretRevision;
    const secret = await getProtectionSecret();
    const encoded = new TextEncoder().encode(data);
    const signature = await crypto.subtle.sign('HMAC', secret, encoded);
    if (revision !== secretRevision) throw new Error('SECURITY_VAULT_LOCKED');
    const hashArray = Array.from(new Uint8Array(signature));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Return first 16 characters for brevity (still 64 bits of entropy)
    return hashHex.substring(0, 16);
}

/**
 * Extract eTLD+1 from a URL
 * Simplified version - uses hostname split
 * @param {string} url 
 * @returns {string|null}
 */
function extractETLD1(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        // Simple extraction: last two parts for most domains
        // Note: This doesn't handle special TLDs like co.uk properly
        // For production, consider using a proper PSL library
        const parts = hostname.split('.');
        if (parts.length <= 2) {
            return hostname;
        }

        // Check for common two-part TLDs
        const twoPartTLDs = ['co.uk', 'com.au', 'co.jp', 'co.kr', 'or.kr', 'ne.jp'];
        const lastTwo = parts.slice(-2).join('.');

        if (twoPartTLDs.includes(lastTwo) && parts.length > 2) {
            return parts.slice(-3).join('.');
        }

        return parts.slice(-2).join('.');
    } catch {
        return null;
    }
}

/**
 * Extract coarse path bucket from URL
 * Removes specific identifiers, keeps structure
 * @param {string} url 
 * @returns {string}
 */
function extractCoarsePath(url) {
    try {
        const urlObj = new URL(url);
        let path = urlObj.pathname;

        // Remove trailing slashes
        path = path.replace(/\/+$/, '');

        // Replace numeric IDs with placeholder
        // e.g., /post/12345 -> /post/*
        path = path.replace(/\/\d+/g, '/*');

        // Replace UUIDs with placeholder
        path = path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/*');

        // Replace long base64-like strings with placeholder
        path = path.replace(/\/[A-Za-z0-9_-]{20,}/g, '/*');

        // Keep only first 3 path segments for brevity
        const segments = path.split('/').filter(Boolean).slice(0, 3);

        return '/' + segments.join('/');
    } catch {
        return '/';
    }
}

/**
 * Generate a site-level key for loop detection
 * @param {string} url - Full URL
 * @returns {Promise<string|null>} - HMAC key prefixed with 's_'
 */
export async function generateSiteKey(url) {
    const etld1 = extractETLD1(url);
    if (!etld1) return null;

    const hash = await hmac(`site:${etld1}`);
    return hash ? `s_${hash}` : null;
}

/**
 * Generate a page-level key for loop detection
 * @param {string} url - Full URL
 * @returns {Promise<string|null>} - HMAC key prefixed with 'p_'
 */
export async function generatePageKey(url) {
    const etld1 = extractETLD1(url);
    const coarsePath = extractCoarsePath(url);
    if (!etld1) return null;

    const hash = await hmac(`page:${etld1}${coarsePath}`);
    return hash ? `p_${hash}` : null;
}

/**
 * Check if the HMAC secret exists (for debugging/status)
 */
export async function hasSecret() {
    return !!(await keyMaterialRepository.getClseHmacSecret());
}
