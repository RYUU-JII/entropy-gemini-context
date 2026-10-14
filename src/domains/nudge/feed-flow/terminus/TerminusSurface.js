/**
 * Silent feed-local horizon mounted inside the extension-owned endpoint tail.
 * It provides an intentional, serene breathing void with contemplative Zen copy
 * and captures renewed-demand gesture intent.
 */

const HOST_ID = 'entropy-feed-terminus';

export const SILENT_HORIZON_COPY = Object.freeze({
  ko: '피드가 여기에서 잠시 멈췄습니다.',
  en: 'The feed pauses here.',
  ja: 'フィードはここで静かに止まります。',
});

export const ZEN_CONTEMPLATIVE_PHRASES = Object.freeze({
  ko: Object.freeze([
    Object.freeze({
      title: '고요한 틈.',
      subtitle: '이어지던 흐름에 잠시 여백이 생깁니다.',
    }),
    Object.freeze({
      title: '잠시, 여백.',
      subtitle: '다음으로 넘어가기 전, 한 번의 숨.',
    }),
    Object.freeze({
      title: '숨 고르기.',
      subtitle: '지금 보던 것에 조금 더 머무는 시간.',
    }),
    Object.freeze({
      title: '바람이 멎는 곳.',
      subtitle: '이어지던 흐름에 작은 여백을 둡니다.',
    }),
    Object.freeze({
      title: '잠시, 이대로.',
      subtitle: '무언가로 채우지 않아도 괜찮은 시간.',
    }),
  ]),
  en: Object.freeze([
    Object.freeze({
      title: 'A quiet moment.',
      subtitle: 'A little space opens in the flow.',
    }),
    Object.freeze({
      title: 'A little room.',
      subtitle: 'One breath before what comes next.',
    }),
    Object.freeze({
      title: 'A pause to breathe.',
      subtitle: 'A little more time with what is already here.',
    }),
    Object.freeze({
      title: 'Where the wind rests.',
      subtitle: 'A little space in the flow of things.',
    }),
    Object.freeze({
      title: 'For a moment, just this.',
      subtitle: 'A little time with nothing more to add.',
    }),
  ]),
  ja: Object.freeze([
    Object.freeze({
      title: '静かなひととき。',
      subtitle: '続いていた流れに、少し余白が生まれます。',
    }),
    Object.freeze({
      title: 'ひとときの余白。',
      subtitle: '次へ進む前に、ひと呼吸。',
    }),
    Object.freeze({
      title: 'ひと呼吸。',
      subtitle: 'いま見ていたものに、もう少しとどまる時間。',
    }),
    Object.freeze({
      title: '風の止まる処。',
      subtitle: '続いていた流れに、小さな余白を。',
    }),
    Object.freeze({
      title: 'このまま、ひととき。',
      subtitle: '何も足さずに過ごしてもいい時間。',
    }),
  ]),
});

const STYLE = `
  :host {
    all: initial;
    display: block;
    width: 100%;
    min-height: var(--entropy-feed-endpoint-height, clamp(420px, 60vh, 720px));
    color: var(--entropy-feed-endpoint-color, currentColor);
  }
  .host {
    box-sizing: border-box;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    min-height: var(--entropy-feed-endpoint-height, clamp(420px, 60vh, 720px));
    pointer-events: none;
    touch-action: none;
    overscroll-behavior: contain;
    user-select: none;
  }
  .host[data-engaged="true"] { pointer-events: auto; }
  .end-face {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    width: 100%;
    height: var(--entropy-feed-horizon-reveal);
    padding: 18px 24px;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 480ms ease-out, transform 480ms ease-out;
  }
  :host([data-surface-mode="continuous"]) .end-face {
    border-top: 1px solid color-mix(in srgb, currentColor 7%, transparent);
  }
  .host[data-engaged="true"] .end-face {
    opacity: 1;
    transform: translateY(0);
  }
  .horizon-mark {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 10px;
    flex-shrink: 0;
    margin-bottom: 14px;
    color: inherit;
    opacity: 0.32;
  }
  .horizon-mark::before {
    content: "";
    position: absolute;
    top: 4px;
    left: 0;
    width: 56px;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      currentColor 28%,
      currentColor 72%,
      transparent 100%
    );
    transform: scaleX(0.88);
    transform-origin: center;
  }
  .horizon-mark::after {
    content: "";
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.55;
  }
  .zen-phrase {
    display: block;
    font-family: var(--font-theme-serif, "Noto Serif KR", "Yu Mincho", "Source Han Serif", Georgia, serif);
    font-size: 18px;
    font-weight: 400;
    line-height: 1.6;
    letter-spacing: 0.05em;
    color: inherit;
    opacity: 1;
    margin: 0;
    max-width: 100%;
    word-break: keep-all;
    overflow-wrap: anywhere;
    text-wrap: balance;
  }
  .zen-subphrase {
    display: block;
    font-family: var(--font-theme-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
    font-size: 13px;
    font-weight: 400;
    line-height: 1.6;
    letter-spacing: 0.02em;
    color: inherit;
    opacity: 1;
    margin: 8px 0 0;
    max-width: min(100%, 32ch);
    word-break: keep-all;
    overflow-wrap: anywhere;
    text-wrap: balance;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @media (prefers-reduced-motion: reduce) {
    .end-face {
      transition: none;
      transform: none;
    }
  }
  @media (max-height: 480px) {
    .end-face { padding: 12px 20px; }
    .horizon-mark { margin-bottom: 8px; }
    .zen-phrase { font-size: 16px; line-height: 1.5; }
    .zen-subphrase { font-size: 12px; line-height: 1.5; }
  }
`;

function isElement(node, documentRef) {
  const ElementCtor = documentRef?.defaultView?.Element || globalThis.Element;
  return typeof ElementCtor === 'function' && node instanceof ElementCtor;
}

function resolveLocale(documentRef) {
  const language = String(
    documentRef?.documentElement?.lang
    || documentRef?.defaultView?.navigator?.language
    || 'en',
  ).toLowerCase();
  if (language.startsWith('ko')) return 'ko';
  if (language.startsWith('ja')) return 'ja';
  return 'en';
}

export class TerminusSurface {
  constructor({ documentRef = typeof document !== 'undefined' ? document : null } = {}) {
    this._document = documentRef;
    this._host = null;
    this._root = null;
    this._shell = null;
    this._status = null;
    this._phraseTitle = null;
    this._phraseSubtitle = null;
    this._phraseIndex = null;
    this._copy = null;
    this._renderSignature = null;
    this._callbacks = {};
    this._boundPointerDown = (event) => this._handlePointerDown(event);
    this._boundPointerMove = (event) => this._handlePointerMove(event);
    this._boundPointerEnd = (event) => this._handlePointerEnd(event);
    this._pointerGestureId = 0;
    this._pointerStartedAt = 0;
    this._pointerId = null;
    this._pointerType = '';
    this._lastPointerY = null;
    this._engaged = false;
    this._controlsLive = false;
  }

  mount({
    mountTarget = null,
    paint = null,
    tailHeightPx = null,
    revealHeightPx,
    surfaceMode = null,
    phraseIndex = null,
    ...callbacks
  } = {}) {
    this._callbacks = callbacks || {};
    if (this._host) return true;
    if (!isElement(mountTarget, this._document) || !mountTarget.isConnected) return false;
    if (!['continuous', 'paged'].includes(surfaceMode)) {
      throw new Error('FEED_TERMINUS_SURFACE_MODE_REQUIRED');
    }
    if (!Number.isFinite(revealHeightPx) || revealHeightPx <= 0) {
      throw new Error('FEED_TERMINUS_REVEAL_HEIGHT_REQUIRED');
    }
    const locale = resolveLocale(this._document);
    const phrases = ZEN_CONTEMPLATIVE_PHRASES[locale];
    this._phraseIndex = Number.isSafeInteger(phraseIndex) && phraseIndex >= 0
      ? phraseIndex % phrases.length
      : Math.floor(Math.random() * phrases.length);
    this._copy = { ...phrases[this._phraseIndex], status: SILENT_HORIZON_COPY[locale] };
    let host = null;
    let root = null;
    try {
      host = this._document.createElement('div');
      host.id = HOST_ID;
      host.tabIndex = -1;
      host.dataset.surfaceMode = surfaceMode;
      host.style.setProperty('--entropy-feed-horizon-reveal', `${revealHeightPx}px`);
      if (paint?.color) host.style.setProperty('--entropy-feed-endpoint-color', paint.color);
      if (Number.isFinite(Number(tailHeightPx))) {
        host.style.setProperty('--entropy-feed-endpoint-height', `${Math.max(320, Number(tailHeightPx))}px`);
      }
      root = host.attachShadow?.({ mode: 'open' }) || null;
      if (!root) return false;

      const style = this._document.createElement('style');
      style.textContent = STYLE;
      const shell = this._document.createElement('div');
      shell.className = 'host';
      shell.dataset.stage = 'idle';
      shell.dataset.controls = 'false';
      shell.dataset.engaged = 'false';
      shell.setAttribute('aria-hidden', 'true');

      const endFace = this._document.createElement('div');
      endFace.className = 'end-face';

      const mark = this._document.createElement('span');
      mark.className = 'horizon-mark';
      mark.setAttribute('aria-hidden', 'true');

      const phraseTitle = this._document.createElement('p');
      phraseTitle.className = 'zen-phrase';
      phraseTitle.dataset.k = 'phrase-title';

      const phraseSubtitle = this._document.createElement('p');
      phraseSubtitle.className = 'zen-subphrase';
      phraseSubtitle.dataset.k = 'phrase-subtitle';

      const status = this._document.createElement('span');
      status.className = 'sr-only';
      status.dataset.k = 'status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.setAttribute('aria-atomic', 'true');

      endFace.append(mark, phraseTitle, phraseSubtitle, status);
      shell.appendChild(endFace);

      root.appendChild(style);
      root.appendChild(shell);
      root.addEventListener('pointerdown', this._boundPointerDown);
      root.addEventListener('pointermove', this._boundPointerMove);
      root.addEventListener('pointerup', this._boundPointerEnd);
      root.addEventListener('pointercancel', this._boundPointerEnd);
      mountTarget.appendChild(host);

      this._host = host;
      this._root = root;
      this._shell = shell;
      this._status = status;
      this._phraseTitle = phraseTitle;
      this._phraseSubtitle = phraseSubtitle;
      this.render({ stage: 'idle' });
      return true;
    } catch (error) {
      try {
        root?.removeEventListener?.('pointerdown', this._boundPointerDown);
        root?.removeEventListener?.('pointermove', this._boundPointerMove);
        root?.removeEventListener?.('pointerup', this._boundPointerEnd);
        root?.removeEventListener?.('pointercancel', this._boundPointerEnd);
        host?.remove?.();
      } catch (cleanupError) {
        if (error && typeof error === 'object') error.mountCleanupError = cleanupError;
      }
      this._reset();
      throw error;
    }
  }

  unmount() {
    try {
      if (this._root) {
        this._root.removeEventListener('pointerdown', this._boundPointerDown);
        this._root.removeEventListener('pointermove', this._boundPointerMove);
        this._root.removeEventListener('pointerup', this._boundPointerEnd);
        this._root.removeEventListener('pointercancel', this._boundPointerEnd);
      }
      this._host?.remove?.();
      return true;
    } finally {
      this._reset();
    }
  }

  isMounted() {
    return !!this._host;
  }

  getHostElement() {
    return this._host;
  }

  focusBoundary() {
    if (!this._engaged) return false;
    if (typeof this._host?.focus !== 'function') return false;
    this._host.focus({ preventScroll: true });
    return true;
  }

  render(state = {}) {
    if (!this._shell) return;
    const stage = state.stage || 'idle';
    const engaged = stage === 'terminus';
    const controlsLive = engaged && state.controlsLive === true;
    const signature = `${stage}:${controlsLive}`;
    if (this._renderSignature === signature) return;
    this._renderSignature = signature;
    this._controlsLive = controlsLive;
    this._engaged = engaged;

    this._shell.dataset.stage = stage;
    this._shell.dataset.engaged = engaged ? 'true' : 'false';
    this._shell.dataset.controls = controlsLive ? 'true' : 'false';
    this._shell.setAttribute('aria-hidden', engaged ? 'false' : 'true');

    if (this._status) {
      const text = engaged ? this._copy.status : '';
      if (this._status.textContent !== text) this._status.textContent = text;
    }

    if (this._phraseTitle && this._phraseSubtitle) {
      if (engaged) {
        if (this._phraseTitle.textContent !== this._copy.title) {
          this._phraseTitle.textContent = this._copy.title;
          this._phraseSubtitle.textContent = this._copy.subtitle;
        }
      } else {
        this._phraseTitle.textContent = '';
        this._phraseSubtitle.textContent = '';
      }
    }
  }

  _handlePointerDown(event) {
    if (!this._engaged) return;
    if (event.isPrimary === false) return;
    if (event.button !== undefined && event.button !== 0) return;
    this._pointerGestureId += 1;
    this._pointerStartedAt = Date.now();
    this._pointerId = Number.isFinite(Number(event.pointerId)) ? Number(event.pointerId) : 0;
    this._pointerType = typeof event.pointerType === 'string' ? event.pointerType : '';
    this._lastPointerY = Number.isFinite(Number(event.clientY))
      ? Number(event.clientY)
      : null;
    event.preventDefault?.();
    event.stopPropagation?.();
  }

  _handlePointerMove(event) {
    const pointerId = Number.isFinite(Number(event.pointerId)) ? Number(event.pointerId) : 0;
    if (this._pointerId === null || pointerId !== this._pointerId) return;
    const currentY = Number(event.clientY);
    if (!Number.isFinite(currentY) || !Number.isFinite(this._lastPointerY)) return;
    const deltaY = this._lastPointerY - currentY;
    const forwardPx = Math.max(0, deltaY);
    this._lastPointerY = currentY;
    event.preventDefault?.();
    event.stopPropagation?.();
    if (forwardPx > 0) {
      const pointerScale = this._pointerType === 'touch' ? 2 : 1;
      this._callbacks.onPull?.(forwardPx * pointerScale, Date.now(), {
        kind: 'pointer', gestureId: this._pointerGestureId, startedAt: this._pointerStartedAt,
      });
    } else if (deltaY < 0) {
      this._callbacks.onPullInterrupted?.(Date.now());
    }
  }

  _handlePointerEnd(event) {
    const pointerId = Number.isFinite(Number(event.pointerId)) ? Number(event.pointerId) : 0;
    if (this._pointerId === null || pointerId !== this._pointerId) return;
    this._callbacks.onPullInterrupted?.(Date.now());
    this._pointerId = null;
    this._pointerType = '';
    this._lastPointerY = null;
  }

  _reset() {
    this._host = null;
    this._root = null;
    this._shell = null;
    this._status = null;
    this._phraseTitle = null;
    this._phraseSubtitle = null;
    this._phraseIndex = null;
    this._copy = null;
    this._renderSignature = null;
    this._callbacks = {};
    this._pointerId = null;
    this._pointerType = '';
    this._lastPointerY = null;
    this._engaged = false;
    this._controlsLive = false;
  }
}

export default TerminusSurface;
