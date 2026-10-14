import { useEffect, useRef, useState } from 'react';

export const ZEN_HOME_FIRST_VIEWPORT_BOOT_FRAME_SOURCES = Object.freeze({
  LIVE: 'live',
  BOOT_VISUAL_FRAME: 'boot_visual_frame',
  UNCAPTURED_LIVE: 'uncaptured_live',
});

const EMPTY_CAPTURED_FRAME = Object.freeze({
  pond: null,
  bonsai: null,
  rhythm: null,
});

const EMPTY_CAPTURED_SIGNATURE = Object.freeze({
  pond: '',
  bonsai: '',
  rhythm: '',
});

const createEmptyCapturedFrame = () => ({ ...EMPTY_CAPTURED_FRAME });
const createEmptyCapturedSignature = () => ({ ...EMPTY_CAPTURED_SIGNATURE });

const requireFrameGenerationKey = (value) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    throw new Error('ZEN_HOME_FIRST_VIEWPORT_FRAME_GENERATION_KEY_REQUIRED');
  }
  return normalized;
};

const hasCapturedBootFrame = (frame) => (
  frame?.pond !== null
  || frame?.bonsai !== null
  || frame?.rhythm !== null
);

const resolveFrameSignature = (value) => (typeof value === 'string' ? value : '');

const resolveCapturedParts = (frame) => ({
  pond: frame?.pond !== null && frame?.pond !== undefined,
  bonsai: frame?.bonsai !== null && frame?.bonsai !== undefined,
  rhythm: frame?.rhythm !== null && frame?.rhythm !== undefined,
});

function resolveBootFramePartMatch({
  capturedFrame,
  liveFrame,
  capturedSignature,
  liveSignature,
} = {}) {
  if (capturedFrame === null || capturedFrame === undefined) return true;
  const normalizedCapturedSignature = resolveFrameSignature(capturedSignature);
  const normalizedLiveSignature = resolveFrameSignature(liveSignature);
  if (normalizedCapturedSignature || normalizedLiveSignature) {
    return normalizedCapturedSignature === normalizedLiveSignature;
  }
  return capturedFrame === liveFrame;
}

function resolveBootFrameMatch({
  capturedFrame,
  capturedSignature,
  pondFrame,
  pondFrameSignature,
  bonsaiFrame,
  bonsaiFrameSignature,
  rhythmFrame,
  rhythmFrameSignature,
} = {}) {
  return {
    pond: resolveBootFramePartMatch({
      capturedFrame: capturedFrame?.pond,
      liveFrame: pondFrame,
      capturedSignature: capturedSignature?.pond,
      liveSignature: pondFrameSignature,
    }),
    bonsai: resolveBootFramePartMatch({
      capturedFrame: capturedFrame?.bonsai,
      liveFrame: bonsaiFrame,
      capturedSignature: capturedSignature?.bonsai,
      liveSignature: bonsaiFrameSignature,
    }),
    rhythm: resolveBootFramePartMatch({
      capturedFrame: capturedFrame?.rhythm,
      liveFrame: rhythmFrame,
      capturedSignature: capturedSignature?.rhythm,
      liveSignature: rhythmFrameSignature,
    }),
  };
}

export function isZenHomePondBootFrameReady(candidate) {
  return (
    candidate?.pondRuntimeMountReady === true
    && (
      candidate.requirePondRosterForRuntimeMount !== true
      || candidate.scannerDomainCandidateCount > 0
      || candidate.signalScannerTargetCount > 0
    )
  );
}

export function isZenHomeBonsaiBootFrameReady(candidate) {
  const lifecycleInputSignature = resolveFrameSignature(candidate?.bonsaiLifecycleInputSignature);
  const materializationInputSignature = resolveFrameSignature(
    candidate?.bonsaiMaterializationInputSignature,
  );
  const sceneCommitKey = resolveFrameSignature(candidate?.presentationSceneCommitKey);
  const bonsaiMaterializationKey = resolveFrameSignature(candidate?.bonsaiMaterializationKey);
  return candidate?.bonsaiLifecycleInput !== null
    && candidate?.bonsaiLifecycleInput !== undefined
    && candidate?.bonsaiMaterializationPrepared === true
    && Boolean(sceneCommitKey)
    && Boolean(bonsaiMaterializationKey)
    && Boolean(lifecycleInputSignature)
    && materializationInputSignature === lifecycleInputSignature;
}

export function isZenHomeRhythmBootFrameReady(candidate) {
  return candidate !== null && typeof candidate === 'object';
}

export function isZenHomeLiveFirstViewportReady({
  pondFrame,
  bonsaiFrame,
  rhythmFrame,
} = {}) {
  return isZenHomePondBootFrameReady(pondFrame)
    && isZenHomeBonsaiBootFrameReady(bonsaiFrame)
    && isZenHomeRhythmBootFrameReady(rhythmFrame);
}

export function resolveZenHomeFirstViewportBootFramePart({
  holdActive,
  liveFrame,
  capturedFrame,
} = {}) {
  if (holdActive !== true) {
    return {
      frame: liveFrame,
      source: ZEN_HOME_FIRST_VIEWPORT_BOOT_FRAME_SOURCES.LIVE,
      captured: false,
    };
  }

  if (capturedFrame === null || capturedFrame === undefined) {
    return {
      frame: liveFrame,
      source: ZEN_HOME_FIRST_VIEWPORT_BOOT_FRAME_SOURCES.UNCAPTURED_LIVE,
      captured: false,
    };
  }

  return {
    frame: capturedFrame,
    source: capturedFrame === liveFrame
      ? ZEN_HOME_FIRST_VIEWPORT_BOOT_FRAME_SOURCES.LIVE
      : ZEN_HOME_FIRST_VIEWPORT_BOOT_FRAME_SOURCES.BOOT_VISUAL_FRAME,
    captured: true,
  };
}

export function useZenHomeFirstViewportBootFrame({
  enabled,
  captureEnabled = enabled,
  frameGenerationKey,
  pondFrame,
  pondFrameSignature,
  bonsaiFrame,
  bonsaiFrameSignature,
  rhythmFrame,
  rhythmFrameSignature,
} = {}) {
  const capturedFrameRef = useRef(createEmptyCapturedFrame());
  const capturedSignatureRef = useRef(createEmptyCapturedSignature());
  const capturedGenerationKeyRef = useRef('');
  const lastDiscardedGenerationRef = useRef(null);
  const releaseAfterPaintRef = useRef(false);
  const [, bumpReleaseRevision] = useState(0);
  const generationKeyRequired = enabled === true
    || captureEnabled === true
    || hasCapturedBootFrame(capturedFrameRef.current);
  const resolvedFrameGenerationKey = generationKeyRequired
    ? requireFrameGenerationKey(frameGenerationKey)
    : '';

  if (
    capturedGenerationKeyRef.current
    && capturedGenerationKeyRef.current !== resolvedFrameGenerationKey
  ) {
    lastDiscardedGenerationRef.current = Object.freeze({
      capturedGenerationKey: capturedGenerationKeyRef.current,
      currentGenerationKey: resolvedFrameGenerationKey,
      reason: 'scene_generation_changed',
    });
    capturedFrameRef.current = createEmptyCapturedFrame();
    capturedSignatureRef.current = createEmptyCapturedSignature();
    capturedGenerationKeyRef.current = '';
    releaseAfterPaintRef.current = false;
  }

  useEffect(() => {
    if (releaseAfterPaintRef.current !== true) return;
    releaseAfterPaintRef.current = false;
    capturedFrameRef.current = createEmptyCapturedFrame();
    capturedSignatureRef.current = createEmptyCapturedSignature();
    capturedGenerationKeyRef.current = '';
    bumpReleaseRevision((revision) => revision + 1);
  });

  if (enabled !== true) {
    const capturedFrame = capturedFrameRef.current;
    const capturedSignature = capturedSignatureRef.current;
    if (hasCapturedBootFrame(capturedFrame) && releaseAfterPaintRef.current !== true) {
      const releaseFrameMatch = resolveBootFrameMatch({
        capturedFrame,
        capturedSignature,
        pondFrame,
        pondFrameSignature,
        bonsaiFrame,
        bonsaiFrameSignature,
        rhythmFrame,
        rhythmFrameSignature,
      });
      const capturedParts = resolveCapturedParts(capturedFrame);
      // Once boot hold ends, renderers own retained paint and current-input ACKs.
      // Preserve this captured commit, then let newer canonical inputs reach them.
      releaseAfterPaintRef.current = true;
      return {
        pond: resolveZenHomeFirstViewportBootFramePart({
          holdActive: true,
          liveFrame: pondFrame,
          capturedFrame: capturedFrame.pond,
        }),
        bonsai: resolveZenHomeFirstViewportBootFramePart({
          holdActive: true,
          liveFrame: bonsaiFrame,
          capturedFrame: capturedFrame.bonsai,
        }),
        rhythm: resolveZenHomeFirstViewportBootFramePart({
          holdActive: true,
          liveFrame: rhythmFrame,
          capturedFrame: capturedFrame.rhythm,
        }),
        lifecycle: {
          frameGenerationKey: resolvedFrameGenerationKey,
          discardedGeneration: lastDiscardedGenerationRef.current,
          holdActive: true,
          captureActive: false,
          releaseAfterPaint: true,
          releaseBlockedBySignatureMismatch: false,
          releaseFrameMatch,
          ready: capturedParts.pond && capturedParts.bonsai && capturedParts.rhythm,
          capturedParts,
        },
      };
    }
    capturedFrameRef.current = createEmptyCapturedFrame();
    capturedSignatureRef.current = createEmptyCapturedSignature();
    capturedGenerationKeyRef.current = '';
    return {
      pond: resolveZenHomeFirstViewportBootFramePart({
        holdActive: false,
        liveFrame: pondFrame,
        capturedFrame: null,
      }),
      bonsai: resolveZenHomeFirstViewportBootFramePart({
        holdActive: false,
        liveFrame: bonsaiFrame,
        capturedFrame: null,
      }),
      rhythm: resolveZenHomeFirstViewportBootFramePart({
        holdActive: false,
        liveFrame: rhythmFrame,
        capturedFrame: null,
      }),
      lifecycle: {
        frameGenerationKey: resolvedFrameGenerationKey,
        discardedGeneration: lastDiscardedGenerationRef.current,
        holdActive: false,
        captureActive: false,
        releaseAfterPaint: false,
        releaseBlockedBySignatureMismatch: false,
        releaseFrameMatch: {
          pond: true,
          bonsai: true,
          rhythm: true,
        },
        ready: false,
        capturedParts: {
          pond: false,
          bonsai: false,
          rhythm: false,
        },
      },
    };
  }

  releaseAfterPaintRef.current = false;
  const capturedFrame = capturedFrameRef.current;
  const capturedSignature = capturedSignatureRef.current;
  const captureActive = captureEnabled === true;
  if (captureActive) {
    capturedGenerationKeyRef.current = resolvedFrameGenerationKey;
  }
  if (captureActive && isZenHomePondBootFrameReady(pondFrame)) {
    capturedFrame.pond = pondFrame;
    capturedSignature.pond = resolveFrameSignature(pondFrameSignature);
  }
  if (
    captureActive
    && capturedFrame.bonsai !== null
    && resolveFrameSignature(capturedFrame.bonsai.bonsaiLifecycleInputSignature)
      !== resolveFrameSignature(bonsaiFrame?.bonsaiLifecycleInputSignature)
  ) {
    // The renderer must receive the new input before it can prepare its token.
    // Holding the previous input here would deadlock the current-input ACK gate.
    capturedFrame.bonsai = null;
    capturedSignature.bonsai = '';
  }
  if (captureActive && isZenHomeBonsaiBootFrameReady(bonsaiFrame)) {
    capturedFrame.bonsai = bonsaiFrame;
    capturedSignature.bonsai = resolveFrameSignature(bonsaiFrameSignature);
  }
  if (captureActive && isZenHomeRhythmBootFrameReady(rhythmFrame)) {
    capturedFrame.rhythm = rhythmFrame;
    capturedSignature.rhythm = resolveFrameSignature(rhythmFrameSignature);
  }

  const capturedParts = resolveCapturedParts(capturedFrame);

  return {
    pond: resolveZenHomeFirstViewportBootFramePart({
      holdActive: true,
      liveFrame: pondFrame,
      capturedFrame: capturedFrame.pond,
    }),
    bonsai: resolveZenHomeFirstViewportBootFramePart({
      holdActive: true,
      liveFrame: bonsaiFrame,
      capturedFrame: capturedFrame.bonsai,
    }),
    rhythm: resolveZenHomeFirstViewportBootFramePart({
      holdActive: true,
      liveFrame: rhythmFrame,
      capturedFrame: capturedFrame.rhythm,
    }),
    lifecycle: {
      frameGenerationKey: resolvedFrameGenerationKey,
      discardedGeneration: lastDiscardedGenerationRef.current,
      holdActive: true,
      captureActive,
      releaseAfterPaint: false,
      releaseBlockedBySignatureMismatch: false,
      releaseFrameMatch: {
        pond: true,
        bonsai: true,
        rhythm: true,
      },
      ready: capturedParts.pond && capturedParts.bonsai && capturedParts.rhythm,
      capturedParts,
    },
  };
}

export default useZenHomeFirstViewportBootFrame;
