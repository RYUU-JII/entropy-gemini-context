import {
    clamp,
    normalizeHexColor,
    rgbToHex,
    colorDistanceRgb,
} from './colorMath.js';

const SAMPLE_SIZE = 24;
const MIN_ALPHA = 40;
const COLOR_QUANT_STEP = 17;
const MERGE_DISTANCE_THRESHOLD = 34;

const quantizeChannel = (value) => {
    const channel = clamp(Math.round(value), 0, 255);
    return clamp(Math.round(channel / COLOR_QUANT_STEP) * COLOR_QUANT_STEP, 0, 255);
};

const finalizeMixWeights = (rawMix) => {
    if (!Array.isArray(rawMix)) return null;
    const normalized = rawMix
        .map((entry) => {
            const hex = normalizeHexColor(entry?.hex || entry?.color);
            const weight = Number(entry?.weight || 0);
            if (!hex || !Number.isFinite(weight) || weight <= 0) return null;
            return { hex, weight };
        })
        .filter(Boolean);

    if (normalized.length < 2) return null;

    const deduped = [];
    normalized.forEach((entry) => {
        const existing = deduped.find((candidate) => candidate.hex === entry.hex);
        if (existing) {
            existing.weight += entry.weight;
            return;
        }
        deduped.push({ ...entry });
    });

    if (deduped.length < 2) return null;

    deduped.sort((a, b) => b.weight - a.weight);
    let limited = deduped.slice(0, 3);
    const weightSum = limited.reduce((acc, entry) => acc + entry.weight, 0) || 1;
    limited = limited.map((entry) => ({
        hex: entry.hex,
        weight: entry.weight / weightSum,
    }));

    if (limited.length === 3 && limited[2].weight < 0.11) {
        limited = limited.slice(0, 2);
    }

    if (limited.length === 2) {
        const dominant = clamp(limited[0].weight, 0.55, 0.92);
        const support = 1 - dominant;
        return Object.freeze([
            Object.freeze({ hex: limited[0].hex, weight: dominant }),
            Object.freeze({ hex: limited[1].hex, weight: support }),
        ]);
    }

    if (limited.length === 3) {
        const third = Math.max(0.12, limited[2].weight);
        const remainder = 1 - third;
        const twoWeightSum = (limited[0].weight + limited[1].weight) || 1;

        let first = clamp((limited[0].weight / twoWeightSum) * remainder, 0.45, 0.7);
        let second = remainder - first;
        if (second < 0.18) {
            second = 0.18;
            first = remainder - second;
        }

        return Object.freeze([
            Object.freeze({ hex: limited[0].hex, weight: first }),
            Object.freeze({ hex: limited[1].hex, weight: second }),
            Object.freeze({ hex: limited[2].hex, weight: third }),
        ]);
    }

    return null;
};

const hashColorMix = (candidate) => {
    const mix = finalizeMixWeights(candidate);
    if (!mix) return '';

    let hash = 2166136261;
    const text = mix
        .map((entry) => `${entry.hex}:${entry.weight.toFixed(6)}`)
        .join('|');
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
};

const normalizeClusterList = (colorCounts) => {
    const total = colorCounts.reduce((acc, entry) => acc + entry.count, 0) || 1;
    const candidates = colorCounts
        .filter((entry) => entry.count / total >= 0.02)
        .sort((a, b) => b.count - a.count);

    const clusters = [];
    candidates.forEach((entry) => {
        const matched = clusters.find((cluster) => colorDistanceRgb(cluster, entry) <= MERGE_DISTANCE_THRESHOLD);
        if (!matched) {
            clusters.push({ ...entry });
            return;
        }
        const nextCount = matched.count + entry.count;
        matched.r = ((matched.r * matched.count) + (entry.r * entry.count)) / nextCount;
        matched.g = ((matched.g * matched.count) + (entry.g * entry.count)) / nextCount;
        matched.b = ((matched.b * matched.count) + (entry.b * entry.count)) / nextCount;
        matched.count = nextCount;
    });

    clusters.sort((a, b) => b.count - a.count);
    return clusters;
};

const loadImageFromDataUrl = (dataUrl) => new Promise((resolve, reject) => {
    if (typeof Image === 'undefined') {
        reject(new Error('IMAGE_API_UNAVAILABLE'));
        return;
    }

    const image = new Image();
    image.decoding = 'async';

    const timeoutId = setTimeout(() => {
        reject(new Error('IMAGE_LOAD_TIMEOUT'));
    }, 3000);

    image.onload = () => {
        clearTimeout(timeoutId);
        resolve(image);
    };

    image.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error('IMAGE_LOAD_FAILED'));
    };

    image.src = dataUrl;
});

const isGeneratedFallbackDataUrl = (value) => {
    if (typeof value !== 'string' || !value.startsWith('data:image/svg+xml')) return false;
    try {
        const payload = value.split(',', 2)[1] || '';
        const svg = atob(payload);
        return svg.includes('font-size="32"') && svg.includes('dominant-baseline="middle"');
    } catch (_) {
        return false;
    }
};

const normalizeColorMix = (candidate) => finalizeMixWeights(candidate);

const extractFaviconColorMixFromDataUrl = async (dataUrl) => {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return null;
    if (isGeneratedFallbackDataUrl(dataUrl)) return null;
    if (typeof document === 'undefined') return null;

    const image = await loadImageFromDataUrl(dataUrl);
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const imageWidth = Math.max(1, Number(image.naturalWidth || image.width || 1));
    const imageHeight = Math.max(1, Number(image.naturalHeight || image.height || 1));
    const scale = Math.min(SAMPLE_SIZE / imageWidth, SAMPLE_SIZE / imageHeight);
    const drawWidth = Math.max(1, Math.floor(imageWidth * scale));
    const drawHeight = Math.max(1, Math.floor(imageHeight * scale));
    const offsetX = Math.floor((SAMPLE_SIZE - drawWidth) / 2);
    const offsetY = Math.floor((SAMPLE_SIZE - drawHeight) / 2);

    ctx.clearRect(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

    const pixelData = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
    const bucketMap = new Map();

    for (let index = 0; index < pixelData.length; index += 4) {
        const alpha = pixelData[index + 3];
        if (alpha < MIN_ALPHA) continue;

        const r = quantizeChannel(pixelData[index]);
        const g = quantizeChannel(pixelData[index + 1]);
        const b = quantizeChannel(pixelData[index + 2]);
        const key = `${r},${g},${b}`;

        const existing = bucketMap.get(key);
        if (existing) {
            existing.count += 1;
            continue;
        }

        bucketMap.set(key, {
            r,
            g,
            b,
            count: 1,
        });
    }

    if (bucketMap.size < 2) return null;

    const clusters = normalizeClusterList(Array.from(bucketMap.values()));
    if (clusters.length < 2) return null;

    const rawMix = clusters.slice(0, 3).map((cluster) => ({
        hex: rgbToHex(cluster),
        weight: cluster.count,
    }));

    return normalizeColorMix(rawMix);
};

export {
    normalizeColorMix,
    hashColorMix,
    extractFaviconColorMixFromDataUrl,
};
