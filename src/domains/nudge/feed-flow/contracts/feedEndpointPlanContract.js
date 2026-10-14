import {
  validateFeedEndpointBoundaryMotionProfile,
} from '../terminus/feedEndpointBoundaryMotionProfile.js';
import {
  FEED_ENDPOINT_TAIL_PAINT_MODES,
  validateFeedEndpointTailPaintProfile,
} from '../terminus/feedEndpointTailPaintProfile.js';

export const FEED_ENDPOINT_FORWARD_CONTROL_KINDS = Object.freeze({
  NATIVE_BUTTON: 'native_button',
  ARIA_BUTTON: 'aria_button',
});

export const FEED_ENDPOINT_FORWARD_CONTROL_POLICIES = Object.freeze({
  NATIVE_DISABLED_DIMMED: 'native_disabled_dimmed',
});

const SUPPORTED_FORWARD_CONTROL_KINDS = new Set(
  Object.values(FEED_ENDPOINT_FORWARD_CONTROL_KINDS),
);
const SUPPORTED_FORWARD_CONTROL_POLICIES = new Set(
  Object.values(FEED_ENDPOINT_FORWARD_CONTROL_POLICIES),
);

function isElement(node, documentRef) {
  const ElementCtor = documentRef?.defaultView?.Element || globalThis.Element;
  return typeof ElementCtor === 'function' && node instanceof ElementCtor;
}

function isTransparentColor(value) {
  const normalized = String(value).trim().toLowerCase();
  if (!normalized || normalized === 'transparent') return true;
  const rgba = normalized.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/);
  return !!rgba && Number(rgba[1]) <= 0.01;
}

export function validateFeedEndpointForwardControlDefinition(definition) {
  if (
    !definition
    || typeof definition.selector !== 'string'
    || !definition.selector.trim()
    || definition.selector !== definition.selector.trim()
    || !SUPPORTED_FORWARD_CONTROL_KINDS.has(definition.controlKind)
    || !SUPPORTED_FORWARD_CONTROL_POLICIES.has(definition.policy)
  ) {
    throw new Error('FEED_ENDPOINT_FORWARD_CONTROL_DEFINITION_INVALID');
  }
  return definition;
}

export function validateFeedEndpointForwardControlContract(
  contract,
  documentRef,
) {
  const nativeButton = (
    contract?.controlKind
    === FEED_ENDPOINT_FORWARD_CONTROL_KINDS.NATIVE_BUTTON
  );
  const ariaButton = (
    contract?.controlKind
    === FEED_ENDPOINT_FORWARD_CONTROL_KINDS.ARIA_BUTTON
  );
  if (
    !contract
    || !isElement(contract.element, documentRef)
    || !contract.element.isConnected
    || !SUPPORTED_FORWARD_CONTROL_KINDS.has(contract.controlKind)
    || !SUPPORTED_FORWARD_CONTROL_POLICIES.has(contract.policy)
    || (
      nativeButton
      && (
        contract.element.tagName !== 'BUTTON'
        || !('disabled' in contract.element)
      )
    )
    || (
      ariaButton
      && contract.element.getAttribute('role') !== 'button'
    )
  ) {
    throw new Error('FEED_ENDPOINT_FORWARD_CONTROL_CONTRACT_INVALID');
  }
  return contract;
}

export function validateFeedEndpointSurfacePlanContract(plan) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('FEED_ENDPOINT_SURFACE_PLAN_REQUIRED');
  }
  if (!Number.isFinite(plan.inputCapturePosition) || plan.inputCapturePosition < 0
    || !Number.isFinite(plan.boundaryPosition) || plan.inputCapturePosition > plan.boundaryPosition) {
    throw new Error('FEED_ENDPOINT_INPUT_CAPTURE_POSITION_INVALID');
  }
  const boundaryMotionProfile = validateFeedEndpointBoundaryMotionProfile(
    plan.boundaryMotionProfile,
  );
  const tailPaintProfile = validateFeedEndpointTailPaintProfile(
    plan.tailPaintProfile,
  );
  if (
    boundaryMotionProfile.capability !== plan.capability
    || boundaryMotionProfile.surfaceMode !== plan.surfaceMode
    || tailPaintProfile.surfaceMode !== plan.surfaceMode
  ) {
    throw new Error('FEED_ENDPOINT_SURFACE_PROFILE_MISMATCH');
  }
  if (
    !Number.isSafeInteger(plan.tailHeightPx)
    || plan.tailHeightPx < 320
  ) {
    throw new Error('FEED_ENDPOINT_TAIL_HEIGHT_INVALID');
  }
  if (
    !plan.paint
    || typeof plan.paint.backgroundColor !== 'string'
    || !plan.paint.backgroundColor.trim()
    || typeof plan.paint.color !== 'string'
    || !plan.paint.color.trim()
  ) {
    throw new Error('FEED_ENDPOINT_PAINT_CONTRACT_INVALID');
  }
  if (
    tailPaintProfile.mode === FEED_ENDPOINT_TAIL_PAINT_MODES.INHERITED_OPAQUE
    && isTransparentColor(plan.paint.backgroundColor)
  ) {
    throw new Error('FEED_ENDPOINT_OPAQUE_PAINT_REQUIRED');
  }
  return plan;
}
