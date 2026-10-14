import {
  applyInlineStyles,
  setAttribute,
  toggleClass,
} from '../visual/FastStyleEngine.js';
import { NUDGE_GAME_TEMPLATE } from '../nudge/nudgeGameTemplate.js';
import { SITE_FURIN_CHIME_STYLES } from '../nudge/siteFurinChimeStyles.js';

// This owner mounts only its shipped template. Runtime copy uses DOM text APIs.
function mountNudgeOverlayTemplate(shadow) {
  shadow.innerHTML = NUDGE_GAME_TEMPLATE;
}

class NudgeOverlayHost {
  constructor({
    onContinue = null,
    onLeave = null,
    onRiftEnter = null,
    onSiteFurinAction = null,
    onGlobalSentinelAction = null,
    onCanvasPointerDown = null,
    onCanvasPointerMove = null,
    onCanvasPointerHover = null,
    onCanvasPointerUp = null,
    onCanvasPointerCancel = null,
    getPrimaryChoiceAction = () => 'continue',
  } = {}) {
    this.onContinue = onContinue;
    this.onLeave = onLeave;
    this.onRiftEnter = onRiftEnter;
    this.onSiteFurinAction = onSiteFurinAction;
    this.onGlobalSentinelAction = onGlobalSentinelAction;
    this.onCanvasPointerDown = onCanvasPointerDown;
    this.onCanvasPointerMove = onCanvasPointerMove;
    this.onCanvasPointerHover = onCanvasPointerHover;
    this.onCanvasPointerUp = onCanvasPointerUp;
    this.onCanvasPointerCancel = onCanvasPointerCancel;
    this.getPrimaryChoiceAction = getPrimaryChoiceAction;
    this.root = null;
    this.shadow = null;
    this.refs = null;
  }

  ensure() {
    if (!this.root) {
      this.#createRoot();
    }
    if (this.root && !this.root.isConnected) {
      document.documentElement.appendChild(this.root);
    }
    this.syncRefs();
    return this.getRefs();
  }

  syncRefs() {
    if (!this.shadow) return null;
    this.refs = {
      scene: this.shadow.getElementById('nudgeScene'),
      scrim: this.shadow.getElementById('nudgeScrim'),
      canvas: this.shadow.getElementById('nudgeCanvas'),
      siteFurinAction: this.shadow.getElementById('nudgeSiteFurinAction'),
      globalSentinelAction: this.shadow.getElementById('nudgeGlobalSentinelAction'),
      globalSentinelStatus: this.shadow.getElementById('nudgeGlobalSentinelStatus'),
      ritualGuide: this.shadow.getElementById('nudgeRitualGuide'),
      ritualTitle: this.shadow.getElementById('nudgeRitualTitle'),
      ritualBody: this.shadow.getElementById('nudgeRitualBody'),
      ritualHint: this.shadow.getElementById('nudgeRitualHint'),
      ritualMeter: this.shadow.getElementById('nudgeRitualMeter'),
      hud: this.shadow.getElementById('nudgeHud'),
      hudTitle: this.shadow.getElementById('nudgeHudTitle'),
      hudStatus: this.shadow.getElementById('nudgeHudStatus'),
      hudHint: this.shadow.getElementById('nudgeHudHint'),
      hudMeter: this.shadow.getElementById('nudgeHudMeter'),
      hudMeterLabel: this.shadow.getElementById('nudgeHudMeterLabel'),
      hudTelemetry: this.shadow.getElementById('nudgeHudTelemetry'),
      riftInvite: this.shadow.getElementById('nudgeRiftInvite'),
      riftInviteButton: this.shadow.getElementById('nudgeRiftInviteButton'),
      riftInviteCaption: this.shadow.getElementById('nudgeRiftInviteCaption'),
      backdrop: this.shadow.getElementById('nudgeModalBackdrop'),
      continueBtn: this.shadow.getElementById('nudgeContinueBtn'),
      leaveBtn: this.shadow.getElementById('nudgeLeaveBtn'),
      choiceDrift: this.shadow.getElementById('nudgeChoiceDrift'),
      choiceEscape: this.shadow.getElementById('nudgeChoiceEscape'),
    };
    return this.refs;
  }

  getRefs() {
    const refs = this.refs || this.syncRefs() || {};
    return {
      root: this.root,
      shadow: this.shadow,
      ...refs,
    };
  }

  prepareForPresentation() {
    if (!this.root) return;
    this.root.style.visibility = 'hidden';
    this.root.style.opacity = '0';
    this.root.setAttribute('aria-hidden', 'true');
    this.root.style.display = '';
  }

  show() {
    if (!this.root) return;
    this.root.style.visibility = '';
    this.root.style.opacity = '1';
    this.root.removeAttribute('aria-hidden');
    this.root.style.display = '';
    this.focusGlobalSentinelAction();
  }

  prepareSiteFurinChime({ label }) {
    if (!this.root?.isConnected) throw new Error('site_furin_overlay_required');
    this.root.dataset.siteFurinChime = '';
    this.root.setAttribute('aria-label', label);
    const style = document.createElement('style');
    style.textContent = SITE_FURIN_CHIME_STYLES;
    this.shadow.appendChild(style);
    const refs = this.getRefs();
    for (const className of ['furin-distance']) {
      const node = document.createElement('div');
      node.className = className;
      node.setAttribute('aria-hidden','true');
      refs.scene.prepend(node);
    }
    const composition = document.createElement('div');
    composition.className = 'furin-composition';
    const frame = document.createElement('div');
    frame.className = 'furin-stage-frame';
    const stage = document.createElement('div');
    stage.className = 'furin-stage';
    stage.id = 'nudgeFurinStage';
    frame.appendChild(stage);
    composition.appendChild(frame);
    refs.scene.appendChild(composition);
    return stage;
  }

  setChoicePending(pending) {
    for (const button of [this.refs?.choiceDrift, this.refs?.choiceEscape, this.refs?.continueBtn, this.refs?.leaveBtn]) {
      if (button) button.disabled = pending;
    }
  }

  hide() {
    if (!this.root) return;
    this.root.style.display = 'none';
    this.setRiftInviteOpen(false);
    this.setModalOpen(false, { activeThemeId: 'zen' });
  }

  destroy() {
    if (this.root?.isConnected) {
      this.root.remove();
    }
    this.refs = null;
    this.shadow = null;
    this.root = null;
  }

  setModalAriaLabel(label) {
    const refs = this.refs || this.syncRefs();
    if (!refs?.backdrop) return;
    setAttribute(refs.backdrop, 'aria-label', label);
  }

  setRiftInviteOpen(isOpen) {
    const refs = this.refs || this.syncRefs();
    const open = isOpen === true;
    if (refs?.riftInvite) {
      refs.riftInvite.hidden = !open;
      refs.riftInvite.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
    if (refs?.riftInviteButton) {
      refs.riftInviteButton.disabled = !open;
      refs.riftInviteButton.tabIndex = open ? 0 : -1;
    }
  }

  setRiftInviteAriaLabel(label = '') {
    const refs = this.refs || this.syncRefs();
    if (!refs?.riftInviteButton) return false;
    refs.riftInviteButton.setAttribute('aria-label', String(label));
    if (!refs.riftInviteCaption) throw new Error('sentinel_rift_invite_caption_required');
    refs.riftInviteCaption.textContent = String(label);
    return true;
  }

  setRiftInviteGeometry({ contour, width, height }) {
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0
      || !Array.isArray(contour) || contour.length < 3
      || contour.some(point => !Array.isArray(point) || point.length !== 2
        || point.some(value => !Number.isFinite(value)))) {
      throw new Error('sentinel_rift_invite_geometry_invalid');
    }
    const refs = this.refs || this.syncRefs();
    if (!refs?.riftInviteButton) return false;
    const minX = Math.min(...contour.map(point => point[0]));
    const maxX = Math.max(...contour.map(point => point[0]));
    const minY = Math.min(...contour.map(point => point[1]));
    const maxY = Math.max(...contour.map(point => point[1]));
    if (maxX <= minX || maxY <= minY) throw new Error('sentinel_rift_invite_geometry_empty');
    const visibleLeft = Math.max(0, minX);
    const visibleTop = Math.max(0, minY);
    const visibleRight = Math.min(width, maxX);
    const visibleBottom = Math.min(height, maxY);
    if (visibleRight <= visibleLeft || visibleBottom <= visibleTop) {
      throw new Error('sentinel_rift_invite_geometry_outside_viewport');
    }
    const targetWidth = Math.min(width, Math.max(44, visibleRight - visibleLeft));
    const targetHeight = Math.min(height, Math.max(44, visibleBottom - visibleTop));
    const targetLeft = Math.max(0, Math.min(width - targetWidth, (visibleLeft + visibleRight - targetWidth) / 2));
    const targetTop = Math.max(0, Math.min(height - targetHeight, (visibleTop + visibleBottom - targetHeight) / 2));
    const expanded = targetWidth > visibleRight - visibleLeft || targetHeight > visibleBottom - visibleTop;
    const button = refs.riftInviteButton;
    button.style.left = `${targetLeft / width * 100}%`;
    button.style.top = `${targetTop / height * 100}%`;
    button.style.width = `${targetWidth / width * 100}%`;
    button.style.height = `${targetHeight / height * 100}%`;
    button.style.transform = 'none';
    // A transparent minimum target is independent of the canvas fracture size.
    button.style.clipPath = expanded ? 'none' : `polygon(${contour.map(point => (
      `${((point[0] - targetLeft) / targetWidth * 100).toFixed(4)}% ${((point[1] - targetTop) / targetHeight * 100).toFixed(4)}%`
    )).join(', ')})`;
    const caption = refs.riftInviteCaption;
    if (!caption) throw new Error('sentinel_rift_invite_caption_required');
    const above = targetTop + targetHeight > height - 64;
    caption.style.setProperty('--nudge-rift-caption-x', `${(targetLeft + targetWidth / 2) / width * 100}%`);
    caption.style.top = `${above ? Math.max(12, targetTop - 12) : targetTop + targetHeight + 12}px`;
    caption.style.transform = above ? 'translate(-50%, -100%)' : 'translateX(-50%)';
    return true;
  }

  focusGlobalSentinelAction() {
    const refs = this.refs || this.syncRefs();
    const action = refs?.globalSentinelAction;
    if (!action || action.hidden || action.disabled || action.tabIndex < 0) return false;
    action.focus({ preventScroll: true });
    return this.shadow?.activeElement === action;
  }

  focusSiteFurinAction() {
    const refs = this.refs || this.syncRefs();
    const action = refs?.siteFurinAction;
    if (!action || action.hidden || action.disabled || action.tabIndex < 0) return false;
    action.focus({ preventScroll: true });
    return this.shadow?.activeElement === action;
  }

  setModalOpen(isOpen, { activeThemeId = null } = {}) {
    const refs = this.refs || this.syncRefs();
    if (!refs?.backdrop) return;
    toggleClass(refs.backdrop, 'is-open', !!isOpen);
    if (!isOpen) return;
    const focusTarget = activeThemeId === 'zen'
      ? refs.choiceDrift
      : refs.continueBtn;
    focusTarget?.focus?.();
  }

  #createRoot() {
    this.root = document.createElement('div');
    this.root.id = 'friction-nudge-root';
    applyInlineStyles(this.root, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      pointerEvents: 'none',
      display: 'none',
      // Page div rules can override normal :host declarations. Keep the shell
      // opaque; transparency belongs to individual worker pixels and scrims.
      opacity: '1',
    });

    this.shadow = this.root.attachShadow({ mode: 'open' });
    mountNudgeOverlayTemplate(this.shadow);
    this.syncRefs();
    this.#bindListeners();
  }

  #bindListeners() {
    const refs = this.refs || this.syncRefs();
    refs?.continueBtn?.addEventListener('click', () => {
      if (typeof this.onContinue === 'function') {
        void this.onContinue();
      }
    });
    refs?.leaveBtn?.addEventListener('click', () => {
      if (typeof this.onLeave === 'function') {
        void this.onLeave();
      }
    });
    refs?.riftInviteButton?.addEventListener('click', () => {
      if (typeof this.onRiftEnter === 'function') {
        void this.onRiftEnter();
      }
    });
    refs?.siteFurinAction?.addEventListener('click', () => {
      if (typeof this.onSiteFurinAction === 'function') {
        void this.onSiteFurinAction();
      }
    });
    refs?.globalSentinelAction?.addEventListener('click', () => {
      if (typeof this.onGlobalSentinelAction === 'function') {
        void this.onGlobalSentinelAction();
      }
    });
    refs?.backdrop?.addEventListener('click', (event) => {
      if (event.target !== refs.backdrop) return;
      refs.choiceDrift?.focus?.();
    });
    refs?.choiceDrift?.addEventListener('click', () => {
      const action = this.getPrimaryChoiceAction?.() === 'leave' ? this.onLeave : this.onContinue;
      if (typeof action === 'function') {
        void action();
      }
    });
    refs?.choiceEscape?.addEventListener('click', () => {
      const action = this.getPrimaryChoiceAction?.() === 'leave' ? this.onContinue : this.onLeave;
      if (typeof action === 'function') {
        void action();
      }
    });
    [refs?.choiceDrift, refs?.choiceEscape].forEach((card) => {
      if (!card) return;
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width * 100).toFixed(1);
        const y = ((event.clientY - rect.top) / rect.height * 100).toFixed(1);
        card.style.setProperty('--ripple-x', `${x}%`);
        card.style.setProperty('--ripple-y', `${y}%`);
      });
    });
    refs?.canvas?.addEventListener('pointerdown', (event) => {
      refs.canvas?.setPointerCapture?.(event.pointerId);
      if (typeof this.onCanvasPointerDown === 'function') {
        this.onCanvasPointerDown(event);
      }
    });
    refs?.canvas?.addEventListener('pointermove', (event) => {
      if (typeof this.onCanvasPointerMove === 'function') {
        this.onCanvasPointerMove(event);
      }
      if (typeof this.onCanvasPointerHover === 'function') {
        this.onCanvasPointerHover(event);
      }
    });
    refs?.canvas?.addEventListener('pointerup', (event) => {
      refs.canvas?.releasePointerCapture?.(event.pointerId);
      if (typeof this.onCanvasPointerUp === 'function') {
        this.onCanvasPointerUp(event);
      }
    });
    refs?.canvas?.addEventListener('pointercancel', (event) => {
      refs.canvas?.releasePointerCapture?.(event.pointerId);
      if (typeof this.onCanvasPointerCancel === 'function') {
        this.onCanvasPointerCancel(event);
      }
    });
  }
}

export default NudgeOverlayHost;
