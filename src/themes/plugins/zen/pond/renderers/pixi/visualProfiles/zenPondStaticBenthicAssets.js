import generatedManifest from './assets/generated/zen-pond-benthic-manifest.json';
import {
    fetchPackagedExtensionAsset,
} from '@/platform/extension/packagedAssetFetch.js';
import {
    ZEN_POND_STATIC_BENTHIC_ASSET_FILES,
    ZEN_POND_STATIC_BENTHIC_ASSET_SCHEMA_VERSION,
    ZEN_POND_STATIC_BENTHIC_MATERIAL_ID,
    ZEN_POND_STATIC_BENTHIC_RUNTIME_ASSET_FILES,
    ZEN_POND_STATIC_BENTHIC_RUNTIME_CHANNEL_COUNT,
    ZEN_POND_STATIC_BENTHIC_RUNTIME_ENCODING,
    ZEN_POND_STATIC_BENTHIC_RUNTIME_PIXEL_FORMAT,
    ZEN_POND_STATIC_BENTHIC_STYLE_VALUES,
    ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE,
} from './zenPondStaticBenthicAssetContract.js';

const STATIC_ASSET_STYLES = ZEN_POND_STATIC_BENTHIC_STYLE_VALUES;
const STATIC_RUNTIME_BYTES_PER_TEXTURE = (
    ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE
    * ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE
    * ZEN_POND_STATIC_BENTHIC_RUNTIME_CHANNEL_COUNT
);

const STATIC_ASSET_URLS = Object.freeze({
    primary: new URL(
        './assets/generated/zen-pond-benthic-primary.rgba.gz',
        import.meta.url,
    ).href,
    detail: new URL(
        './assets/generated/zen-pond-benthic-detail.rgba.gz',
        import.meta.url,
    ).href,
});

const nowMs = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);

const roundMs = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Number(parsed.toFixed(2))) : null;
};

const requireGeneratedManifest = (manifest) => {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
        throw new Error('ZEN_POND_STATIC_BENTHIC_MANIFEST_REQUIRED');
    }
    if (manifest.schemaVersion !== ZEN_POND_STATIC_BENTHIC_ASSET_SCHEMA_VERSION) {
        throw new Error('ZEN_POND_STATIC_BENTHIC_MANIFEST_SCHEMA_MISMATCH');
    }
    if (manifest.contractSignature !== generatedManifest.contractSignature) {
        throw new Error('ZEN_POND_STATIC_BENTHIC_MANIFEST_SIGNATURE_MISMATCH');
    }
    if (manifest.materialId !== ZEN_POND_STATIC_BENTHIC_MATERIAL_ID) {
        throw new Error('ZEN_POND_STATIC_BENTHIC_MANIFEST_MATERIAL_MISMATCH');
    }
    if (manifest.textureSize !== ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE) {
        throw new Error('ZEN_POND_STATIC_BENTHIC_MANIFEST_SIZE_MISMATCH');
    }
    for (const style of STATIC_ASSET_STYLES) {
        const asset = manifest.assets?.[style];
        if (
            !asset
            || asset.file !== ZEN_POND_STATIC_BENTHIC_ASSET_FILES[style]
            || !Number.isInteger(asset.bytes)
            || asset.bytes <= 0
            || typeof asset.sha256 !== 'string'
            || !/^[a-f0-9]{64}$/u.test(asset.sha256)
            || asset.runtimeFile !== ZEN_POND_STATIC_BENTHIC_RUNTIME_ASSET_FILES[style]
            || !Number.isInteger(asset.runtimeBytes)
            || asset.runtimeBytes <= 0
            || typeof asset.runtimeSha256 !== 'string'
            || !/^[a-f0-9]{64}$/u.test(asset.runtimeSha256)
            || asset.runtimeDecodedBytes !== STATIC_RUNTIME_BYTES_PER_TEXTURE
            || typeof asset.runtimeDecodedSha256 !== 'string'
            || !/^[a-f0-9]{64}$/u.test(asset.runtimeDecodedSha256)
            || asset.runtimePixelFormat
                !== ZEN_POND_STATIC_BENTHIC_RUNTIME_PIXEL_FORMAT
            || asset.runtimeEncoding !== ZEN_POND_STATIC_BENTHIC_RUNTIME_ENCODING
        ) {
            throw new Error(`ZEN_POND_STATIC_BENTHIC_MANIFEST_ASSET_INVALID:${style}`);
        }
    }
    return manifest;
};

const defaultFetchAsset = (url) => {
    return fetchPackagedExtensionAsset(url);
};

const defaultReadAssetBytes = async (response) => {
    if (
        typeof globalThis.DecompressionStream !== 'function'
        || !response?.body
        || typeof response.body.pipeThrough !== 'function'
    ) {
        throw new Error('ZEN_POND_STATIC_BENTHIC_GZIP_STREAM_UNAVAILABLE');
    }
    const decompressed = response.body.pipeThrough(
        new globalThis.DecompressionStream(ZEN_POND_STATIC_BENTHIC_RUNTIME_ENCODING),
    );
    return new Uint8Array(await new Response(decompressed).arrayBuffer());
};

export const createZenPondStaticBenthicAssetOwner = ({
    manifest = generatedManifest,
    assetUrls = STATIC_ASSET_URLS,
    fetchAsset = defaultFetchAsset,
    readAssetBytes = defaultReadAssetBytes,
    readNowMs = nowMs,
} = {}) => {
    const canonicalManifest = requireGeneratedManifest(manifest);
    if (typeof fetchAsset !== 'function' || typeof readAssetBytes !== 'function') {
        throw new Error('ZEN_POND_STATIC_BENTHIC_ASSET_PORT_INVALID');
    }
    let state = 'idle';
    let terminalPromise = null;
    let preparedAssets = null;
    const decodedAssets = {};
    let startedAtMs = null;
    let settledAtMs = null;
    let terminalError = null;

    const loadStyle = async (style) => {
        const url = assetUrls?.[style];
        if (typeof url !== 'string' || !url) {
            throw new Error(`ZEN_POND_STATIC_BENTHIC_ASSET_URL_REQUIRED:${style}`);
        }
        const response = await fetchAsset(url);
        if (!response || response.ok !== true) {
            throw new Error(`ZEN_POND_STATIC_BENTHIC_ASSET_FETCH_FAILED:${style}`);
        }
        const bytes = await readAssetBytes(response, style);
        if (
            !(bytes instanceof Uint8Array)
            || bytes.byteLength !== STATIC_RUNTIME_BYTES_PER_TEXTURE
        ) {
            throw new Error(`ZEN_POND_STATIC_BENTHIC_ASSET_BYTES_INVALID:${style}`);
        }
        const source = Object.freeze({
            kind: ZEN_POND_STATIC_BENTHIC_RUNTIME_PIXEL_FORMAT,
            width: ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE,
            height: ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE,
            data: bytes,
        });
        const decoded = Object.freeze({
            style,
            source,
            url,
            bytes: canonicalManifest.assets[style].bytes,
            sha256: canonicalManifest.assets[style].sha256,
        });
        decodedAssets[style] = decoded;
        return decoded;
    };

    const prepare = () => {
        if (terminalPromise) return terminalPromise;
        state = 'loading';
        startedAtMs = Number(readNowMs());
        terminalPromise = Promise.all(
            STATIC_ASSET_STYLES.map(loadStyle),
        ).then((entries) => {
            preparedAssets = Object.freeze(Object.fromEntries(
                entries.map((entry) => [entry.style, entry]),
            ));
            settledAtMs = Number(readNowMs());
            state = 'ready';
            return preparedAssets;
        }).catch((error) => {
            settledAtMs = Number(readNowMs());
            state = 'failed';
            terminalError = error instanceof Error ? error : new Error(String(error));
            preparedAssets = null;
            throw terminalError;
        });
        return terminalPromise;
    };

    const requireSource = (size, options = {}) => {
        if (state !== 'ready' || !preparedAssets) {
            if (terminalError) throw terminalError;
            throw new Error(`ZEN_POND_STATIC_BENTHIC_ASSETS_NOT_READY:${state}`);
        }
        const requestedSize = Number(size);
        if (requestedSize !== ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE) {
            throw new Error(`ZEN_POND_STATIC_BENTHIC_TEXTURE_SIZE_INVALID:${String(size)}`);
        }
        const style = options?.style;
        if (!STATIC_ASSET_STYLES.includes(style)) {
            throw new Error(`ZEN_POND_STATIC_BENTHIC_STYLE_INVALID:${String(style)}`);
        }
        const asset = preparedAssets[style];
        if (!asset?.source) {
            throw new Error(`ZEN_POND_STATIC_BENTHIC_ASSET_MISSING:${style}`);
        }
        return asset.source;
    };

    return Object.freeze({
        prepare,
        requireSource,
        getSnapshot: () => Object.freeze({
            state,
            startedAtMs: roundMs(startedAtMs),
            settledAtMs: roundMs(settledAtMs),
            durationMs: startedAtMs === null || settledAtMs === null
                ? null
                : roundMs(settledAtMs - startedAtMs),
            contractSignature: canonicalManifest.contractSignature,
            sourceDigest: canonicalManifest.sourceDigest,
            totalPreviewPngBytes: STATIC_ASSET_STYLES.reduce(
                (total, style) => total + canonicalManifest.assets[style].bytes,
                0,
            ),
            totalRuntimeBytes: STATIC_ASSET_STYLES.reduce(
                (total, style) => (
                    total + canonicalManifest.assets[style].runtimeBytes
                ),
                0,
            ),
            totalDecodedBytes: STATIC_ASSET_STYLES.reduce(
                (total, style) => (
                    total + canonicalManifest.assets[style].runtimeDecodedBytes
                ),
                0,
            ),
        }),
    });
};

const staticBenthicAssetOwner = createZenPondStaticBenthicAssetOwner();

export const prepareZenPondStaticBenthicAssets = () => (
    staticBenthicAssetOwner.prepare()
);

export const requirePreparedZenPondStaticBenthicSource = (size, options) => (
    staticBenthicAssetOwner.requireSource(size, options)
);

export const getZenPondStaticBenthicAssetSnapshot = () => (
    staticBenthicAssetOwner.getSnapshot()
);
