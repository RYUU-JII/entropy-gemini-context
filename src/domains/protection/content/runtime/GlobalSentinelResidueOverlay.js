const RESIDUE_ROOT_ID = 'entropy-global-sentinel-residue';
const RESYNC_RELEASE_REASON = 'global_sentinel_resynchronized';

let residueRoot = null;
let residueExpiryTimer = null;

function clearResidueExpiryTimer() {
  if (!residueExpiryTimer) return;
  clearTimeout(residueExpiryTimer);
  residueExpiryTimer = null;
}

function resolveExpiryMs(outcome = null, now = Date.now()) {
  const until = Math.floor(Number(outcome?.until) || 0);
  if (!until) return 0;
  return Math.max(0, until - now);
}

function isResynchronizedRelease({ releaseReason = '', globalSentinelOutcome = null } = {}) {
  return releaseReason === RESYNC_RELEASE_REASON
    && globalSentinelOutcome?.status === 'resynchronized'
    && globalSentinelOutcome?.protectionMode === 'release';
}

function createResidueRoot(documentRef = document) {
  const root = documentRef.createElement('div');
  root.id = RESIDUE_ROOT_ID;
  root.setAttribute('aria-hidden', 'true');
  root.style.position = 'fixed';
  root.style.inset = '0';
  root.style.zIndex = '2147483645';
  root.style.pointerEvents = 'none';
  const shadow = root.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      @keyframes sentinelResidueDrift {
        0%, 100% { opacity: 0.42; transform: translate3d(0, 0, 0); }
        28% { opacity: 0.5; transform: translate3d(-0.7%, 0.2%, 0); }
        56% { opacity: 0.36; transform: translate3d(0.5%, -0.3%, 0); }
        72% { opacity: 0.58; transform: translate3d(-0.2%, 0.4%, 0); }
      }
      @keyframes sentinelResidueGlitch {
        0%, 82%, 100% { clip-path: inset(0 0 0 0); opacity: 0; transform: translate3d(0, 0, 0); }
        83% { clip-path: inset(8% 0 84% 0); opacity: 0.3; transform: translate3d(-0.8%, 0, 0); }
        84% { clip-path: inset(63% 0 27% 0); opacity: 0.22; transform: translate3d(0.6%, 0, 0); }
        85% { clip-path: inset(32% 0 56% 0); opacity: 0.34; transform: translate3d(-0.2%, 0, 0); }
        86% { clip-path: inset(0 0 0 0); opacity: 0; transform: translate3d(0, 0, 0); }
      }
      @keyframes sentinelResidueSink {
        0%, 100% { opacity: 0.12; transform: translate3d(0, 0, 0) scale(1); }
        18% { opacity: 0.2; transform: translate3d(-0.4%, 0.2%, 0) scale(1.025); }
        43% { opacity: 0.08; transform: translate3d(0.5%, -0.2%, 0) scale(0.985); }
        71% { opacity: 0.18; transform: translate3d(-0.1%, 0.3%, 0) scale(1.012); }
      }
      .residue {
        position: fixed;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
        opacity: 1;
      }
      .residue::before,
      .residue::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .residue::before {
        background:
          radial-gradient(ellipse at 50% 45%, rgba(255, 255, 255, 0) 38%, rgba(10, 12, 18, 0.26) 100%),
          linear-gradient(90deg, rgba(255, 255, 255, 0.08), transparent 18%, transparent 82%, rgba(0, 0, 0, 0.11));
        mix-blend-mode: multiply;
        animation: sentinelResidueDrift 7.8s ease-in-out infinite;
      }
      .residue::after {
        background:
          repeating-linear-gradient(180deg, rgba(17, 24, 39, 0.15) 0 1px, transparent 1px 7px),
          linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(17, 24, 39, 0.28), rgba(255, 255, 255, 0));
        mix-blend-mode: multiply;
        animation: sentinelResidueGlitch 5.6s steps(1, end) infinite;
      }
      .trace {
        position: absolute;
        width: 26vmin;
        height: 9vmin;
        border-radius: 50%;
        background:
          radial-gradient(ellipse at 42% 50%, rgba(2, 6, 23, 0.3) 0 12%, rgba(2, 6, 23, 0.12) 28%, transparent 70%),
          linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
        filter: blur(1.4px);
        mix-blend-mode: multiply;
        animation: sentinelResidueSink 11s ease-in-out infinite;
      }
      .trace.a {
        left: 7%;
        top: 18%;
        transform: rotate(-12deg);
        animation-delay: -1.8s;
      }
      .trace.b {
        right: 12%;
        top: 47%;
        width: 21vmin;
        height: 7vmin;
        transform: rotate(9deg);
        animation-delay: -5.2s;
      }
      .trace.c {
        left: 39%;
        bottom: 14%;
        width: 18vmin;
        height: 6vmin;
        transform: rotate(4deg);
        animation-delay: -8.4s;
      }
    </style>
    <div class="residue">
      <span class="trace a"></span>
      <span class="trace b"></span>
      <span class="trace c"></span>
    </div>
  `;
  return root;
}

export function removeGlobalSentinelResidueOverlay() {
  clearResidueExpiryTimer();
  residueRoot?.remove();
  residueRoot = null;
}

export function updateGlobalSentinelResidueOverlay({
  releaseReason = '',
  globalSentinelOutcome = null,
  documentRef = document,
  now = Date.now(),
} = {}) {
  if (!isResynchronizedRelease({ releaseReason, globalSentinelOutcome })) {
    removeGlobalSentinelResidueOverlay();
    return false;
  }

  const expiresInMs = resolveExpiryMs(globalSentinelOutcome, now);
  if (expiresInMs <= 0) {
    removeGlobalSentinelResidueOverlay();
    return false;
  }

  if (!residueRoot) {
    residueRoot = createResidueRoot(documentRef);
    documentRef.documentElement.appendChild(residueRoot);
  }
  clearResidueExpiryTimer();
  residueExpiryTimer = setTimeout(removeGlobalSentinelResidueOverlay, expiresInMs);
  return true;
}

export function getGlobalSentinelResidueOverlayRootForTest() {
  return residueRoot;
}
