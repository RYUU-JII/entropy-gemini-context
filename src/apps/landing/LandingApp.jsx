import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  resolveZenLandingPresentation,
  ZenLandingArtifactPlane,
  ZenLandingStage,
} from '../../themes/plugins/zen/api/landing.js';
import {
  createLandingExperienceController,
  LANDING_MOTION_MODES,
  LANDING_READING_PHASE_IDS,
  LANDING_READING_PHASES,
  LANDING_SHISHI_GATE_CONTRACT,
  LANDING_SOUND_MODES,
  resolveLandingExperienceSnapshot,
  resolveLandingScrollProgressForGlobalProgress,
} from './experience/index.js';
import { createLandingAudioEngine } from './audio/landingAudio.js';
import LandingArtifactTrace from './components/LandingArtifactTrace.jsx';
import { LandingChapter } from './components/LandingChapter.jsx';
import LandingDebugHud from './components/LandingDebugHud.jsx';
import LandingGateMeasure from './components/LandingGateMeasure.jsx';
import LandingInterferenceLine from './components/LandingInterferenceLine.jsx';
import LandingInvitation from './components/LandingInvitation.jsx';
import LandingSoundControl from './components/LandingSoundControl.jsx';
import { getLandingCopy, resolveLandingLocale } from './content/landingCopy.js';

const LANDING_SCROLL_SPAN_SVH = 760;
const REACT_STAGE_FRAME_INTERVAL_MS = 1000 / 30;
const MAX_AUDIO_EDGE_CROSSING_DISTANCE = 0.07;
const LANDING_DEBUG_BUILD_ENABLED = (
  typeof __ENTROPY_LANDING_DEBUG_ENABLED__ !== 'undefined'
  && __ENTROPY_LANDING_DEBUG_ENABLED__ === true
);

const PHASE_COPY_KEYS = Object.freeze({
  [LANDING_READING_PHASE_IDS.THRESHOLD]: 'threshold',
  [LANDING_READING_PHASE_IDS.MANIFESTO]: 'manifesto',
  [LANDING_READING_PHASE_IDS.FRICTION]: 'friction',
  [LANDING_READING_PHASE_IDS.PAUSE]: 'pause',
  [LANDING_READING_PHASE_IDS.REFLECTION]: 'reflection',
  [LANDING_READING_PHASE_IDS.INVITATION]: 'invitation',
});

function resolveInitialLocale() {
  const queryLocale = new URLSearchParams(window.location.search).get('lang');
  return resolveLandingLocale(queryLocale || window.navigator.language);
}

function resolveInitialMotionMode() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? LANDING_MOTION_MODES.REDUCED
    : LANDING_MOTION_MODES.FULL;
}

function createInitialSnapshot(motionMode) {
  return resolveLandingExperienceSnapshot({
    scrollProgress: 0,
    wind: { x: 0, strength: 0 },
    stillnessMs: 0,
    scrollPressure: 0,
    furinTriggered: false,
    furinSignalProgress: 0,
    motionMode,
    soundMode: LANDING_SOUND_MODES.MUTED,
  });
}

function resolvePhaseHeight(phase, motionMode) {
  const rawStart = resolveLandingScrollProgressForGlobalProgress(phase.start, motionMode);
  const rawEnd = resolveLandingScrollProgressForGlobalProgress(phase.end, motionMode);
  const phaseSpanSvh = (rawEnd - rawStart) * LANDING_SCROLL_SPAN_SVH;
  return phase.id === LANDING_READING_PHASE_IDS.INVITATION
    ? `calc(${phaseSpanSvh}svh + 100svh)`
    : `${phaseSpanSvh}svh`;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value) {
  const t = clamp01(value);
  return t * t * (3 - (2 * t));
}

function recede(progress, start, end) {
  return 1 - smoothstep((progress - start) / (end - start));
}

function resolveReadingPresence(phaseId, phaseProgress) {
  if (phaseId === LANDING_READING_PHASE_IDS.INVITATION) return 1;
  if (phaseId === LANDING_READING_PHASE_IDS.PAUSE) return recede(phaseProgress, 0.76, 0.96);
  return recede(phaseProgress, 0.72, 0.94);
}

function crossedAudioEdge(previousProgress, nextProgress, edge) {
  return previousProgress < edge
    && nextProgress >= edge
    && nextProgress - previousProgress <= MAX_AUDIO_EDGE_CROSSING_DISTANCE;
}

function resolveActiveArtifactId(snapshot) {
  if (snapshot.artifactEffects.shoji.presence > 0.06) return 'shoji';
  if (snapshot.shishiGate.presence > 0.06 && !snapshot.shishiGate.passed) return 'shishi';
  if (snapshot.artifactEffects.furin.presence > 0.06) return 'furin';
  return null;
}

function reportLandingAudioError(error, setAudioError) {
  const message = String(error?.message || error || 'LANDING_AUDIO_FAILED');
  console.warn('[landing audio]', message);
  setAudioError(message);
}

function resolvePhaseDetail(phaseId, copy, snapshot) {
  if (phaseId === LANDING_READING_PHASE_IDS.THRESHOLD) {
    return (
      <div className="landing-scroll-inscription" aria-hidden="true">
        <span />
      </div>
    );
  }
  if (phaseId === LANDING_READING_PHASE_IDS.FRICTION) {
    return (
      <LandingInterferenceLine
        label={copy.interferenceLabel}
        progress={snapshot.artifactEffects.shoji.shuffle}
        sourceText={copy.body}
      />
    );
  }
  if (phaseId === LANDING_READING_PHASE_IDS.PAUSE) {
    return <LandingGateMeasure copy={copy} gate={snapshot.shishiGate} />;
  }
  return null;
}

export default function LandingApp() {
  const locale = useMemo(resolveInitialLocale, []);
  const copy = useMemo(() => getLandingCopy(locale), [locale]);
  const [motionMode, setMotionMode] = useState(resolveInitialMotionMode);
  const [snapshot, setSnapshot] = useState(() => createInitialSnapshot(motionMode));
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [audioError, setAudioError] = useState(null);
  const presentation = useMemo(
    () => resolveZenLandingPresentation(snapshot),
    [snapshot],
  );

  const appRef = useRef(null);
  const journeyRef = useRef(null);
  const controllerRef = useRef(null);
  const audioEngineRef = useRef(null);
  const soundEnabledRef = useRef(false);
  const firstMeasuredSnapshotRef = useRef(false);
  const layoutReadyDispatchedRef = useRef(false);
  const lastStageFrameAtRef = useRef(-Infinity);
  const lastScrollProgressRef = useRef(0);
  const lastActivePhaseRef = useRef(LANDING_READING_PHASE_IDS.THRESHOLD);
  const furinTriggeredRef = useRef(false);
  const shishiCuePlayedRef = useRef(false);
  const debugEnabled = useMemo(
    () => LANDING_DEBUG_BUILD_ENABLED
      && new URLSearchParams(window.location.search).get('landingDebug') === '1',
    [],
  );

  const playCue = (cueName) => {
    if (!soundEnabledRef.current) return;
    const engine = audioEngineRef.current;
    if (!engine || typeof engine[cueName] !== 'function') {
      throw new Error(`LANDING_AUDIO_CUE_REQUIRED:${cueName}`);
    }
    void engine[cueName]().catch((error) => reportLandingAudioError(error, setAudioError));
  };

  useLayoutEffect(() => {
    if (!firstMeasuredSnapshotRef.current || layoutReadyDispatchedRef.current) return;
    layoutReadyDispatchedRef.current = true;
    document.dispatchEvent(new CustomEvent('entropy:landing-layout-ready'));
  }, [snapshot]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = copy.documentTitle;
  }, [copy.documentTitle, locale]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionModeChange = (event) => {
      const nextMode = event.matches
        ? LANDING_MOTION_MODES.REDUCED
        : LANDING_MOTION_MODES.FULL;
      setMotionMode(nextMode);
      controllerRef.current?.setMotionMode(nextMode);
    };
    mediaQuery.addEventListener('change', handleMotionModeChange);
    return () => mediaQuery.removeEventListener('change', handleMotionModeChange);
  }, []);

  useEffect(() => {
    const journeyElement = journeyRef.current;
    if (!journeyElement) {
      throw new Error('LANDING_JOURNEY_ELEMENT_REQUIRED');
    }

    const controller = createLandingExperienceController({
      journeyElement,
      initialMotionMode: motionMode,
      onSnapshot(nextSnapshot) {
        appRef.current?.style.setProperty(
          '--landing-global-progress',
          String(nextSnapshot.globalProgress),
        );

        const activePhaseChanged = lastActivePhaseRef.current !== nextSnapshot.phase;
        const previousScrollProgress = lastScrollProgressRef.current;
        if (
          soundEnabledRef.current
          && !furinTriggeredRef.current
          && nextSnapshot.artifactEffects.furin.triggered
        ) {
          playCue('playFurin');
        }
        if (
          !shishiCuePlayedRef.current
          && crossedAudioEdge(
            previousScrollProgress,
            nextSnapshot.scrollProgress,
            LANDING_SHISHI_GATE_CONTRACT.fillEnd,
          )
        ) {
          shishiCuePlayedRef.current = true;
          playCue('playShishi');
        }
        furinTriggeredRef.current = nextSnapshot.artifactEffects.furin.triggered;
        lastScrollProgressRef.current = nextSnapshot.scrollProgress;
        lastActivePhaseRef.current = nextSnapshot.phase;

        const frameNow = window.performance.now();
        if (
          !firstMeasuredSnapshotRef.current
          || activePhaseChanged
          || frameNow - lastStageFrameAtRef.current >= REACT_STAGE_FRAME_INTERVAL_MS
        ) {
          firstMeasuredSnapshotRef.current = true;
          lastStageFrameAtRef.current = frameNow;
          setSnapshot(nextSnapshot);
        }
      },
    });
    controllerRef.current = controller;
    controller.start();

    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => () => {
    const engine = audioEngineRef.current;
    audioEngineRef.current = null;
    if (engine) {
      void engine.dispose().catch((error) => console.warn('[landing audio] dispose failed', error));
    }
  }, []);

  const handleSoundToggle = async () => {
    if (soundEnabled) {
      soundEnabledRef.current = false;
      setSoundEnabled(false);
      controllerRef.current?.setSoundMode(LANDING_SOUND_MODES.MUTED);
      return;
    }

    try {
      const engine = audioEngineRef.current || createLandingAudioEngine();
      audioEngineRef.current = engine;
      await engine.enable();
      soundEnabledRef.current = true;
      setSoundEnabled(true);
      setAudioError(null);
      controllerRef.current?.setSoundMode(LANDING_SOUND_MODES.ENABLED);
    } catch (error) {
      soundEnabledRef.current = false;
      setSoundEnabled(false);
      controllerRef.current?.setSoundMode(LANDING_SOUND_MODES.MUTED);
      reportLandingAudioError(error, setAudioError);
    }
  };

  const handleSkipToInvitation = (event) => {
    event.preventDefault();
    const invitation = document.getElementById(
      `landing-phase-${LANDING_READING_PHASE_IDS.INVITATION}`,
    );
    if (!invitation) throw new Error('LANDING_INVITATION_TARGET_REQUIRED');
    invitation.scrollIntoView({ behavior: 'auto', block: 'start' });
    invitation.focus({ preventScroll: true });
  };

  const shoji = presentation.artifactEffects.shoji;
  const activeArtifactId = resolveActiveArtifactId(snapshot);

  return (
    <div
      ref={appRef}
      className="landing-app"
      data-phase={snapshot.phase}
      data-motion={motionMode}
      data-active-artifact={activeArtifactId || 'none'}
      data-gate-holding={snapshot.shishiGate.holding ? 'true' : 'false'}
      style={{
        '--landing-copy-color': presentation.palette.copyInk,
        '--landing-invitation-presence': presentation.layers.invitation,
        '--landing-night-depth': snapshot.environment.nightDepth,
        '--landing-shoji-presence': shoji.presence,
        '--landing-shoji-desaturation': shoji.desaturation,
        '--landing-shoji-tracking': shoji.tracking,
      }}
    >
      <header className="landing-chrome">
        <a
          className="landing-skip-link"
          href="#landing-phase-invitation"
          onClick={handleSkipToInvitation}
        >
          {copy.skipToInvitation}
        </a>
        <p className="landing-wordmark">ENTROPY</p>
        <LandingSoundControl
          enabled={soundEnabled}
          copy={copy.sound}
          onToggle={handleSoundToggle}
        />
      </header>

      <main>
        <div ref={journeyRef} className="landing-journey">
          <div className="landing-stage-shell">
            <ZenLandingStage presentation={presentation} />
          </div>
          <div className="landing-artifact-plane-shell">
            <ZenLandingArtifactPlane presentation={presentation} />
          </div>

          <LandingArtifactTrace
            activeArtifactId={activeArtifactId}
            copy={copy}
            trace={presentation.artifactTrace}
          />

          <div className="landing-reading-stream">
            {LANDING_READING_PHASES.map((phase) => {
              const copyKey = PHASE_COPY_KEYS[phase.id];
              if (!copyKey) throw new Error(`LANDING_PHASE_COPY_KEY_REQUIRED:${phase.id}`);
              const phaseCopy = copy.phases[copyKey];
              let detail = resolvePhaseDetail(phase.id, phaseCopy, snapshot);
              if (phase.id === LANDING_READING_PHASE_IDS.INVITATION) {
                detail = (
                  <LandingInvitation
                    copy={phaseCopy}
                    chromeStoreUrl={__ENTROPY_LANDING_CHROME_STORE_URL__}
                  />
                );
              }

              return (
                <LandingChapter
                  key={phase.id}
                  phaseId={phase.id}
                  activePhase={snapshot.phase}
                  copy={phaseCopy}
                  headingLevel={phase.id === LANDING_READING_PHASE_IDS.THRESHOLD ? 1 : 2}
                  contentPresence={resolveReadingPresence(phase.id, snapshot.phaseProgress)}
                  style={{ minHeight: resolvePhaseHeight(phase, motionMode) }}
                >
                  {detail}
                </LandingChapter>
              );
            })}
          </div>
        </div>
      </main>

      <div
        className="landing-progress"
        role="progressbar"
        aria-label={copy.progressLabel}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={Math.round(snapshot.globalProgress * 100)}
        aria-valuetext={copy.phases[PHASE_COPY_KEYS[snapshot.phase]].eyebrow}
      />
      {motionMode === LANDING_MOTION_MODES.REDUCED ? (
        <p className="landing-reduced-motion-notice">{copy.reducedMotionNotice}</p>
      ) : null}
      {audioError ? <p className="sr-only" role="alert">{audioError}</p> : null}
      {LANDING_DEBUG_BUILD_ENABLED ? (
        <LandingDebugHud snapshot={snapshot} enabled={debugEnabled} />
      ) : null}
    </div>
  );
}
