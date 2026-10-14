import {
    Container,
    SimpleRope,
} from '@/themes/plugins/zen/pond/renderers/pixi/zenPondPixiRuntime.js';

const LEASE_CONTRACT =
    'zen_pixi_koi_body_receiver_effect_lease_v1';
const CLIP_MODE = 'body_rope_stencil';
const STATE_BY_FISH = new WeakMap();

const toFiniteNumber = (value, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const isDestroyedDisplayObject = (value) =>
    value?.destroyed === true || value?._destroyed === true;

const fail = (detail) => {
    throw new Error(`ZEN_PIXI_KOI_BODY_RECEIVER_EFFECT_INVALID:${detail}`);
};

const requireOwner = (pixiFish) => {
    if (!pixiFish || typeof pixiFish !== 'object' || Array.isArray(pixiFish)) {
        fail('pixi_fish');
    }
    const container = pixiFish.container;
    if (
        !container
        || isDestroyedDisplayObject(container)
        || typeof container.addChildAt !== 'function'
        || typeof container.getChildIndex !== 'function'
    ) {
        fail('fish_container');
    }
    const bodyRope = pixiFish.bodyRope;
    const ropePoints = pixiFish.ropePoints;
    if (
        !bodyRope
        || isDestroyedDisplayObject(bodyRope)
        || !Array.isArray(ropePoints)
        || ropePoints.length < 2
        || bodyRope.geometry?.points !== ropePoints
    ) {
        fail('body_rope');
    }
    if (!bodyRope.texture) {
        fail('body_texture');
    }
    return { container, bodyRope, ropePoints };
};

const copyBodyRopeTransform = (bodyRope, mask) => {
    mask.pivot.set(
        toFiniteNumber(bodyRope.pivot?.x, 0),
        toFiniteNumber(bodyRope.pivot?.y, 0),
    );
    mask.position.set(
        toFiniteNumber(bodyRope.position?.x, 0),
        toFiniteNumber(bodyRope.position?.y, 0),
    );
    mask.scale.set(
        toFiniteNumber(bodyRope.scale?.x, 1),
        toFiniteNumber(bodyRope.scale?.y, 1),
    );
    mask.rotation = toFiniteNumber(bodyRope.rotation, 0);
};

const createState = (pixiFish, owner) => {
    const { container, bodyRope, ropePoints } = owner;
    const mask = new SimpleRope(bodyRope.texture, ropePoints);
    mask.label = 'zen-koi-body-receiver-effect-mask';
    mask.eventMode = 'none';
    copyBodyRopeTransform(bodyRope, mask);

    const slot = new Container();
    slot.label = 'zen-koi-body-receiver-effect-slot';
    slot.eventMode = 'none';
    const debugText = pixiFish.debugText;
    const insertIndex = debugText?.parent === container
        ? container.getChildIndex(debugText)
        : container.children.length;
    container.addChildAt(mask, insertIndex);
    container.addChildAt(slot, insertIndex + 1);
    slot.mask = mask;

    const state = { mask, slot, leases: new Set(), disposed: false };
    STATE_BY_FISH.set(pixiFish, state);
    return state;
};

const requireActiveState = (pixiFish, owner) => {
    const existing = STATE_BY_FISH.get(pixiFish);
    if (!existing) {
        return createState(pixiFish, owner);
    }
    if (
        existing.disposed
        || isDestroyedDisplayObject(existing.mask)
        || isDestroyedDisplayObject(existing.slot)
        || existing.mask.parent !== owner.container
        || existing.slot.parent !== owner.container
        || existing.slot.mask !== existing.mask
    ) {
        fail('lease_state');
    }
    return existing;
};

const detachEffect = (state, effectDisplayObject) => {
    if (
        effectDisplayObject?.parent === state.slot
        && typeof state.slot.removeChild === 'function'
    ) {
        state.slot.removeChild(effectDisplayObject);
    }
};

export const disposePixiKoiBodyReceiverEffects = (
    pixiFish,
    state = STATE_BY_FISH.get(pixiFish),
) => {
    if (!state || state.disposed) return false;
    state.disposed = true;
    for (const record of state.leases) {
        record.released = true;
        detachEffect(state, record.effectDisplayObject);
    }
    state.leases.clear();
    if (state.slot?.mask === state.mask) {
        state.slot.mask = null;
    }
    state.slot?.parent?.removeChild(state.slot);
    state.mask?.parent?.removeChild(state.mask);
    if (state.slot && !isDestroyedDisplayObject(state.slot)) {
        state.slot.destroy({ children: false });
    }
    if (state.mask && !isDestroyedDisplayObject(state.mask)) {
        state.mask.destroy();
    }
    if (STATE_BY_FISH.get(pixiFish) === state) {
        STATE_BY_FISH.delete(pixiFish);
    }
    return true;
};

export const syncPixiKoiBodyReceiverEffectTexture = (
    pixiFish,
) => {
    const state = STATE_BY_FISH.get(pixiFish);
    if (!state) return false;
    if (state.disposed || isDestroyedDisplayObject(state.mask)) {
        fail('mask_lifecycle');
    }
    const bodyTexture = pixiFish?.bodyRope?.texture;
    if (!bodyTexture) {
        fail('body_texture');
    }
    if (state.mask.texture !== bodyTexture) {
        state.mask.texture = bodyTexture;
    }
    return true;
};

export const syncPixiKoiBodyReceiverEffectTransform = (
    pixiFish,
) => {
    const state = STATE_BY_FISH.get(pixiFish);
    if (!state) return false;
    syncPixiKoiBodyReceiverEffectTexture(pixiFish);
    const bodyRope = pixiFish?.bodyRope;
    if (!bodyRope || isDestroyedDisplayObject(bodyRope)) {
        fail('body_rope');
    }
    copyBodyRopeTransform(bodyRope, state.mask);
    return true;
};

export const acquirePixiKoiBodyReceiverEffect = (
    pixiFish,
    effectDisplayObject,
) => {
    const owner = requireOwner(pixiFish);
    if (
        !effectDisplayObject
        || typeof effectDisplayObject !== 'object'
        || Array.isArray(effectDisplayObject)
        || typeof effectDisplayObject.destroy !== 'function'
        || !('parent' in effectDisplayObject)
        || isDestroyedDisplayObject(effectDisplayObject)
    ) {
        fail('effect_display_object');
    }
    if (effectDisplayObject.parent) {
        fail('effect_parent');
    }
    const state = requireActiveState(pixiFish, owner);
    const record = { effectDisplayObject, released: false };
    state.leases.add(record);
    state.slot.addChild(effectDisplayObject);

    return Object.freeze({
        contract: LEASE_CONTRACT,
        clipMode: CLIP_MODE,
        release() {
            if (record.released) return false;
            record.released = true;
            state.leases.delete(record);
            detachEffect(state, effectDisplayObject);
            if (state.leases.size === 0) {
                disposePixiKoiBodyReceiverEffects(pixiFish, state);
            }
            return true;
        },
    });
};
