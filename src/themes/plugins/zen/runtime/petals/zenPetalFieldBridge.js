import { MAX_ZEN_PETAL_LANDING_BATCH, MAX_ZEN_PETAL_PENDING_BATCHES } from './zenAppPetalBudget.js';
import { requireZenPetalAppearance } from './zenPetalMaterial.js';
import { ZEN_PETAL_DEPTH_LAYERS } from './zenPetalDepth.js';

const LANDING_ACK_TIMEOUT_MS = 5_000;
const clippedOverflow = new Set(['hidden', 'clip', 'scroll', 'auto']);
const createSessionExpiredError = () => Object.assign(new Error('ZEN_PETAL_RECEIVER_SESSION_EXPIRED'), {
    code: 'ZEN_PETAL_RECEIVER_SESSION_EXPIRED',
});
export const isZenPetalReceiverCancellation = (error) => error?.code === 'ZEN_PETAL_RECEIVER_SESSION_EXPIRED';

const roundedClip = (node, style, bounds) => {
    const readRadius = (value, axis) => {
        if (typeof value !== 'string' || !value) return 0;
        const parts = value.trim().split(/\s+/);
        const token = parts[Math.min(axis, parts.length - 1)];
        const size = axis === 0 ? bounds.width : bounds.height;
        const layoutSize = axis === 0 ? node.clientWidth : node.clientHeight;
        const scale = layoutSize > 0 ? size / layoutSize : 1;
        return Math.min(size / 2, token.endsWith('%') ? parseFloat(token) * size / 100 : parseFloat(token) * scale);
    };
    return ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius']
        .map((key, corner) => {
            const rx = readRadius(style[key], 0);
            const ry = readRadius(style[key], 1);
            return {
                rx, ry,
                x: corner === 0 || corner === 3 ? bounds.left + rx : bounds.right - rx,
                y: corner < 2 ? bounds.top + ry : bounds.bottom - ry,
                sx: corner === 0 || corner === 3 ? -1 : 1,
                sy: corner < 2 ? -1 : 1,
            };
        }).filter(({ rx, ry }) => rx > 0 && ry > 0);
};

const requireDescriptor = (petal) => {
    if (petal?.depthLayer !== ZEN_PETAL_DEPTH_LAYERS.SURFACE) throw new Error('ZEN_PETAL_LANDING_DEPTH_LAYER_INVALID');
    if (typeof petal?.id !== 'string' || !petal.id || petal.id.length > 160) {
        throw new Error('ZEN_PETAL_LANDING_ID_INVALID');
    }
    for (const key of ['x', 'y', 'size', 'rotation', 'opacity', 'velocityX', 'velocityY']) {
        if (typeof petal[key] !== 'number' || !Number.isFinite(petal[key])) {
            throw new Error(`ZEN_PETAL_LANDING_FIELD_INVALID:${key}`);
        }
    }
    if (petal.size <= 0 || petal.opacity < 0 || petal.opacity > 1) {
        throw new Error('ZEN_PETAL_LANDING_APPEARANCE_INVALID');
    }
    requireZenPetalAppearance(petal);
};

const measureReceiver = ({ element, getInteractionSurface, getViewport }) => {
    if (!element.isConnected) return null;
    const document = element.ownerDocument;
    if (document.hidden) return null;
    const interactionSurface = getInteractionSurface();
    if (!interactionSurface || interactionSurface.ownerDocument !== document) {
        throw new Error('ZEN_PETAL_RECEIVER_INTERACTION_SURFACE_INVALID');
    }
    if (!interactionSurface.isConnected) return null;
    const view = document.defaultView;
    const rect = element.getBoundingClientRect();
    if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)) {
        throw new Error('ZEN_PETAL_RECEIVER_RECT_INVALID');
    }
    if (rect.width <= 0 || rect.height <= 0) return null;
    let clip = {
        left: Math.max(0, rect.left), top: Math.max(0, rect.top),
        right: Math.min(view.innerWidth, rect.right), bottom: Math.min(view.innerHeight, rect.bottom),
    };
    const corners = [];
    for (let node = element; node; node = node.parentElement) {
        const style = view.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse'
            || Number(style.opacity) === 0 || node.hidden || node.hasAttribute('inert')) return null;
        const clipsX = clippedOverflow.has(style.overflowX);
        const clipsY = clippedOverflow.has(style.overflowY);
        if (node === element || clipsX || clipsY) {
            corners.push(...roundedClip(node, style, node === element ? rect : node.getBoundingClientRect()));
        }
        if (node !== element && (clipsX || clipsY)) {
            const bounds = node.getBoundingClientRect();
            clip = {
                left: clipsX ? Math.max(clip.left, bounds.left) : clip.left,
                right: clipsX ? Math.min(clip.right, bounds.right) : clip.right,
                top: clipsY ? Math.max(clip.top, bounds.top) : clip.top,
                bottom: clipsY ? Math.min(clip.bottom, bounds.bottom) : clip.bottom,
            };
        }
    }
    if (clip.right <= clip.left || clip.bottom <= clip.top) return null;
    const viewport = getViewport();
    if (![viewport?.width, viewport?.height].every((value) => Number.isFinite(value) && value > 0)) {
        throw new Error('ZEN_PETAL_RECEIVER_VIEWPORT_INVALID');
    }
    return { rect, clip, corners, element, interactionSurface, document, scaleX: viewport.width / rect.width, scaleY: viewport.height / rect.height };
};

const mapDescriptor = (petal, { rect, clip, corners, element, interactionSurface, document, scaleX, scaleY }) => {
    // Reserve the complete rotated petal footprint, so handoff cannot clip a
    // half-petal against the water aperture or rounded corner.
    const radius = petal.size * 1.1;
    if (petal.x-radius < clip.left || petal.x+radius > clip.right || petal.y-radius < clip.top || petal.y+radius > clip.bottom) return null;
    const footprint = [[petal.x,petal.y],...[-1,1].flatMap(dx=>[-1,1].map(dy=>[petal.x+dx*radius,petal.y+dy*radius]))];
    if (footprint.some(([px,py])=>corners.some(({ rx, ry, x, y, sx, sy }) => (
        (px - x) * sx > 0 && (py - y) * sy > 0
        && ((px - x) / rx) ** 2 + ((py - y) / ry) ** 2 > 1
    )))) return null;
    // Check sibling overlays (dialogs, menus, side panels) separately from the
    // receiver's explicit rounded clips. The field is pointer-transparent. A
    // pond canvas can return its containing surface or the scanner's declared
    // transparent input plane. Other siblings and input-plane children still occlude.
    if (footprint.some(([x,y])=>{
        const hit = document.elementFromPoint(x,y);
        return !hit || !(hit === interactionSurface || hit === element || element.contains(hit) || hit.contains(element));
    })) return null;
    return {
        ...petal,
        x: (petal.x - rect.left) * scaleX,
        y: (petal.y - rect.top) * scaleY,
        size: petal.size * Math.sqrt(scaleX * scaleY),
        velocityX: petal.velocityX * scaleX,
        velocityY: petal.velocityY * scaleY,
    };
};

// Memory-only event transport. Batches never share a latest-value pointer slot,
// and an old receiver's ACK can never hand a particle to its replacement.
export const createZenPetalFieldBridge = () => {
    const receivers = new Set();
    let sessionSequence = 0;

    const drain = async (receiver) => {
        if (receiver.draining) return;
        receiver.draining = true;
        while (receiver.active && receiver.queue.length > 0) {
            const batch = receiver.queue[0];
            if (batch.settled) {
                receiver.queue.shift();
                continue;
            }
            try {
                const geometry = measureReceiver(receiver);
                const mapped = geometry === null ? [] : batch.candidates
                    .map((petal) => mapDescriptor(petal, geometry)).filter(Boolean);
                if (mapped.length === 0) {
                    batch.resolve([]);
                } else {
                    batch.dispatched = true;
                    const result = await Promise.race([
                        receiver.submit(mapped),
                        batch.cancelled.then((error) => { throw error; }),
                    ]);
                    if (!receiver.active || batch.settled) throw createSessionExpiredError();
                    const acceptedIds = Array.isArray(result) ? result : result?.acceptedIds;
                    const offeredIds = new Set(mapped.map(({ id }) => id));
                    if (!Array.isArray(acceptedIds) || new Set(acceptedIds).size !== acceptedIds.length
                        || acceptedIds.some((id) => !offeredIds.has(id))) {
                        throw new Error('ZEN_PETAL_RECEIVER_ACK_INVALID');
                    }
                    batch.resolve(acceptedIds);
                }
            } catch (error) {
                batch.reject(error);
            }
            receiver.queue.shift();
        }
        receiver.draining = false;
    };

    return {
        register({ element, getInteractionSurface, getViewport, submit }) {
            if (!element || typeof getInteractionSurface !== 'function'
                || typeof getViewport !== 'function' || typeof submit !== 'function') {
                throw new Error('ZEN_PETAL_RECEIVER_CONTRACT_REQUIRED');
            }
            const receiver = { element, getInteractionSurface, getViewport, submit, session: ++sessionSequence,
                active: true, draining: false, queue: [] };
            receivers.add(receiver);
            return () => {
                if (!receiver.active) return;
                receiver.active = false;
                receivers.delete(receiver);
                for (const batch of receiver.queue) {
                    if (batch.dispatched) batch.reject(createSessionExpiredError());
                    else batch.resolve([]); // Unsent particles may keep falling.
                }
                receiver.queue.length = 0;
            };
        },
        async submit(candidates) {
            if (!Array.isArray(candidates) || candidates.length > MAX_ZEN_PETAL_LANDING_BATCH) {
                throw new Error('ZEN_PETAL_LANDING_BATCH_INVALID');
            }
            candidates.forEach(requireDescriptor);
            if (new Set(candidates.map(({ id }) => id)).size !== candidates.length) {
                throw new Error('ZEN_PETAL_LANDING_BATCH_DUPLICATE');
            }
            const assigned = new Set();
            const deliveries = [];
            for (const receiver of receivers) {
                const geometry = measureReceiver(receiver);
                if (geometry === null) continue;
                const matching = candidates.filter((petal) => !assigned.has(petal.id) && mapDescriptor(petal, geometry));
                if (matching.length === 0) continue;
                if (receiver.queue.length >= MAX_ZEN_PETAL_PENDING_BATCHES) {
                    throw new Error('ZEN_PETAL_LANDING_QUEUE_FULL');
                }
                matching.forEach(({ id }) => assigned.add(id));
                deliveries.push({ receiver, matching });
            }
            // Complete admission before any side effect, so a later receiver's
            // full queue cannot leave an earlier promise detached from its caller.
            const jobs = deliveries.map(({ receiver, matching }) => new Promise((resolve, reject) => {
                    const batch = { candidates: matching, settled: false };
                    batch.cancelled = new Promise((expire) => { batch.expire = expire; });
                    const settle = (callback, value) => {
                        if (batch.settled) return;
                        batch.settled = true;
                        clearTimeout(batch.timeout);
                        callback(value);
                    };
                    batch.resolve = (value) => settle(resolve, value);
                    batch.reject = (error) => {
                        batch.expire(error);
                        settle(reject, error);
                    };
                    batch.timeout = setTimeout(() => batch.reject(new Error('ZEN_PETAL_LANDING_ACK_TIMEOUT')), LANDING_ACK_TIMEOUT_MS);
                    receiver.queue.push(batch);
                    void drain(receiver);
            }));
            return (await Promise.all(jobs)).flat();
        },
    };
};

const bridge = createZenPetalFieldBridge();
export const registerZenPetalReceiver = (receiver) => bridge.register(receiver);
export const submitZenPetalLandings = (candidates) => bridge.submit(candidates);
