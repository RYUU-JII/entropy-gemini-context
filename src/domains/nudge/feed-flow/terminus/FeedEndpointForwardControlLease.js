import {
  FEED_ENDPOINT_FORWARD_CONTROL_KINDS,
  FEED_ENDPOINT_FORWARD_CONTROL_POLICIES,
  validateFeedEndpointForwardControlContract,
} from '../contracts/feedEndpointPlanContract.js';

const TERMINAL_MARKER = 'data-entropy-feed-endpoint-forward-control';
const OWNED_STYLE_PROPERTIES = Object.freeze([
  'opacity',
  'cursor',
  'filter',
]);
const TERMINAL_INPUT_EVENTS = Object.freeze([
  'pointerdown',
  'mousedown',
  'touchstart',
  'click',
  'keydown',
]);

function readAttribute(element, name) {
  return Object.freeze({
    present: element.hasAttribute(name),
    value: element.getAttribute(name),
  });
}

function restoreAttribute(element, name, snapshot) {
  if (snapshot?.present) {
    element.setAttribute(name, snapshot.value ?? '');
  } else {
    element.removeAttribute(name);
  }
}

function readStyle(element, property) {
  return Object.freeze({
    value: element.style.getPropertyValue(property),
    priority: element.style.getPropertyPriority(property),
  });
}

function restoreStyle(element, property, snapshot) {
  if (snapshot?.value) {
    element.style.setProperty(property, snapshot.value, snapshot.priority);
  } else {
    element.style.removeProperty(property);
  }
}

export class FeedEndpointForwardControlLease {
  constructor({
    documentRef = typeof document !== 'undefined' ? document : null,
  } = {}) {
    this._document = documentRef;
    this._element = null;
    this._controlKind = null;
    this._policy = null;
    this._terminal = false;
    this._snapshot = null;
    this._inputGuardAttached = false;
    this._boundBlockTerminalInput = (event) => this._blockTerminalInput(event);
  }

  acquire(contract = null) {
    if (this._element) {
      throw new Error('FEED_ENDPOINT_FORWARD_CONTROL_ALREADY_ACQUIRED');
    }
    validateFeedEndpointForwardControlContract(contract, this._document);
    this._element = contract.element;
    this._controlKind = contract.controlKind;
    this._policy = contract.policy;
    return true;
  }

  setTerminal(terminal) {
    if (!this._element) return false;
    if (!this._element.isConnected) {
      throw new Error('FEED_ENDPOINT_FORWARD_CONTROL_DISCONNECTED');
    }
    const nextTerminal = terminal === true;
    if (!nextTerminal) {
      this._detachInputGuard();
      this._restore();
      this._terminal = false;
      return true;
    }
    if (!this._terminal) this._snapshot = this._capture();
    this._terminal = true;
    this._apply();
    this._attachInputGuard();
    return true;
  }

  validate() {
    if (!this._element) return true;
    if (!this._element.isConnected) return false;
    if (this._terminal) {
      this._apply();
      this._attachInputGuard();
    }
    return true;
  }

  release() {
    if (!this._element) return true;
    this._detachInputGuard();
    this._restore();
    this._element = null;
    this._controlKind = null;
    this._policy = null;
    this._terminal = false;
    this._snapshot = null;
    return true;
  }

  getState() {
    return Object.freeze({
      acquired: !!this._element,
      terminal: this._terminal,
      controlKind: this._controlKind,
      policy: this._policy,
    });
  }

  _capture() {
    return Object.freeze({
      disabled: (
        this._controlKind === FEED_ENDPOINT_FORWARD_CONTROL_KINDS.NATIVE_BUTTON
      )
        ? this._element.disabled === true
        : null,
      disabledAttribute: readAttribute(this._element, 'disabled'),
      ariaDisabled: readAttribute(this._element, 'aria-disabled'),
      tabIndex: readAttribute(this._element, 'tabindex'),
      marker: readAttribute(this._element, TERMINAL_MARKER),
      styles: Object.freeze(Object.fromEntries(
        OWNED_STYLE_PROPERTIES.map((property) => [
          property,
          readStyle(this._element, property),
        ]),
      )),
    });
  }

  _apply() {
    if (
      this._policy
      !== FEED_ENDPOINT_FORWARD_CONTROL_POLICIES.NATIVE_DISABLED_DIMMED
    ) {
      throw new Error('FEED_ENDPOINT_FORWARD_CONTROL_POLICY_INVALID');
    }
    if (
      this._controlKind === FEED_ENDPOINT_FORWARD_CONTROL_KINDS.NATIVE_BUTTON
    ) {
      this._element.disabled = true;
    } else if (
      this._controlKind === FEED_ENDPOINT_FORWARD_CONTROL_KINDS.ARIA_BUTTON
    ) {
      this._element.setAttribute('tabindex', '-1');
    } else {
      throw new Error('FEED_ENDPOINT_FORWARD_CONTROL_KIND_INVALID');
    }
    this._element.setAttribute('aria-disabled', 'true');
    this._element.setAttribute(TERMINAL_MARKER, 'true');
    this._element.style.setProperty('opacity', '0.42', 'important');
    this._element.style.setProperty('cursor', 'default', 'important');
    this._element.style.setProperty('filter', 'saturate(0.35)', 'important');
  }

  _restore() {
    if (!this._element || !this._snapshot) return;
    if (
      this._controlKind === FEED_ENDPOINT_FORWARD_CONTROL_KINDS.NATIVE_BUTTON
    ) {
      this._element.disabled = this._snapshot.disabled;
    }
    restoreAttribute(
      this._element,
      'disabled',
      this._snapshot.disabledAttribute,
    );
    restoreAttribute(
      this._element,
      'aria-disabled',
      this._snapshot.ariaDisabled,
    );
    restoreAttribute(
      this._element,
      'tabindex',
      this._snapshot.tabIndex,
    );
    restoreAttribute(
      this._element,
      TERMINAL_MARKER,
      this._snapshot.marker,
    );
    OWNED_STYLE_PROPERTIES.forEach((property) => {
      restoreStyle(
        this._element,
        property,
        this._snapshot.styles[property],
      );
    });
    this._snapshot = null;
  }

  _attachInputGuard() {
    if (this._inputGuardAttached || !this._element) return;
    TERMINAL_INPUT_EVENTS.forEach((type) => {
      this._element.addEventListener(type, this._boundBlockTerminalInput, {
        capture: true,
        passive: false,
      });
    });
    this._inputGuardAttached = true;
  }

  _detachInputGuard() {
    if (!this._inputGuardAttached || !this._element) return;
    TERMINAL_INPUT_EVENTS.forEach((type) => {
      this._element.removeEventListener(type, this._boundBlockTerminalInput, {
        capture: true,
      });
    });
    this._inputGuardAttached = false;
  }

  _blockTerminalInput(event) {
    if (!this._terminal) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
  }
}

export default FeedEndpointForwardControlLease;
