import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useAppTranslation } from '../../../ui-kit/hooks/useAppTranslation.js';
import { createAppSoundRuntime } from '../../../domains/sound/runtime/appSoundRuntime.js';
import { SOUND_CUE_IDS } from '../../../domains/sound/catalog/soundCueIds.js';
import { getInstallationPresentation } from '../../../themes/core/presentation/installationPresentation.js';
import {
  assertInstallationPresentationInput,
  buildInstallationPresentationFrame,
  INSTALLATION_PRESENTATION_DURATION_MS,
  INSTALLATION_PRESENTATION_ID,
} from '../../../themes/core/presentation/installationPresentationContract.js';
import './FurinInstallationPresentation.css';

const FRAME_INTERVAL_MS = 1000 / 30;
const SHOT_COPY_KEYS = Object.freeze({
  prepare: 'installation.phase.prepare',
  hang: 'installation.phase.hang',
  quiet: 'installation.phase.quiet',
  chime: 'installation.phase.chime',
  return: 'installation.phase.return',
});

/** Presentation only. The guidance owner validates committed settings and claims. */
export function FurinInstallationPresentation({ installation, onPresented, onComplete, onDismiss, replay = false }) {
  assertInstallationPresentationInput(installation);
  const { t, themeId } = useAppTranslation('guidance');
  const presentationThemeRef = useRef(themeId);
  const { Scene, palette } = getInstallationPresentation(presentationThemeRef.current);
  const reducedMotion = useReducedMotion() === true;
  const [elapsedMs, setElapsedMs] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const frame = buildInstallationPresentationFrame(elapsedMs, reducedMotion);
  const sceneRef = useRef(null);
  const callbacksRef = useRef({ onPresented, onComplete, onDismiss });
  const presentedRef = useRef(false);
  const endedRef = useRef(false);
  const soundEnabledRef = useRef(false);
  const chimePlayedRef = useRef(false);
  const soundStopRef = useRef({});
  const soundRuntimeRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useLayoutEffect(() => {
    callbacksRef.current = { onPresented, onComplete, onDismiss };
  }, [onPresented, onComplete, onDismiss]);

  function endPresentation(kind) {
    if (endedRef.current) return;
    endedRef.current = true;
    soundStopRef.current.stop?.();
    if (kind === 'complete') callbacksRef.current.onComplete?.();
    else callbacksRef.current.onDismiss?.();
  }

  useLayoutEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape' && sceneRef.current.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        if (!endedRef.current) {
          endedRef.current = true;
          soundStopRef.current.stop?.();
          callbacksRef.current.onDismiss?.();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  useEffect(() => {
    let animationFrameId = 0;
    let paintCount = 0;
    let lastTimestamp = null;
    let lastPublishAt = 0;
    let visibleElapsedMs = 0;
    const tick = timestamp => {
      if (endedRef.current) return;
      if (document.visibilityState !== 'visible') { lastTimestamp = null; return; }
      // Two committed visible frames precede the first-frame receipt.
      if (!presentedRef.current) {
        paintCount += 1;
        if (paintCount >= 2) {
          presentedRef.current = true;
          callbacksRef.current.onPresented?.();
        }
      } else if (!reducedMotion) {
        if (lastTimestamp !== null) visibleElapsedMs += Math.min(250, Math.max(0, timestamp - lastTimestamp));
        if (timestamp - lastPublishAt >= FRAME_INTERVAL_MS) {
          setElapsedMs(Math.min(visibleElapsedMs, INSTALLATION_PRESENTATION_DURATION_MS));
          lastPublishAt = timestamp;
        }
        if (visibleElapsedMs >= INSTALLATION_PRESENTATION_DURATION_MS) {
          endedRef.current = true;
          soundStopRef.current.stop?.();
          callbacksRef.current.onComplete?.();
          return;
        }
      }
      lastTimestamp = timestamp;
      animationFrameId = requestAnimationFrame(tick);
    };
    const handleVisibilityChange = () => {
      cancelAnimationFrame(animationFrameId);
      lastTimestamp = null;
      soundStopRef.current.stop?.();
      if (document.visibilityState === 'visible' && !endedRef.current) animationFrameId = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    animationFrameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      soundStopRef.current.stop?.();
      soundRuntimeRef.current?.stopAll();
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (!reducedMotion && elapsedMs >= 5000 && soundEnabledRef.current && !chimePlayedRef.current) {
      chimePlayedRef.current = true;
      soundRuntimeRef.current.playCue(SOUND_CUE_IDS.DASHBOARD_INSTALLATION_CHIME, {
        themeId: presentationThemeRef.current, stopRef: soundStopRef.current,
      });
    }
  }, [elapsedMs, reducedMotion]);

  const toggleSound = () => {
    const enabled = !soundEnabledRef.current;
    soundEnabledRef.current = enabled;
    setSoundEnabled(enabled);
    if (!enabled) { soundStopRef.current.stop?.(); return; }
    if (!soundRuntimeRef.current) soundRuntimeRef.current = createAppSoundRuntime();
    soundRuntimeRef.current.prepareAudio();
    // Opt-in itself is a trusted audio gesture. No hidden preference is saved.
    if (reducedMotion || elapsedMs >= 5000) {
      chimePlayedRef.current = true;
      soundRuntimeRef.current.playCue(SOUND_CUE_IDS.DASHBOARD_INSTALLATION_CHIME, {
        themeId: presentationThemeRef.current, stopRef: soundStopRef.current,
      });
    }
  };

  return <div className="furin-installation-presentation" data-presentation-id={INSTALLATION_PRESENTATION_ID}
    data-installation-phase={frame.phase} data-installation-replay={replay ? 'true' : 'false'}>
    <section ref={sceneRef} className="installation-dialog" role="region"
      style={{ '--installation-surface': palette.surface, '--installation-ink': palette.ink, '--installation-border': palette.border }}
      aria-labelledby={titleId} aria-describedby={descriptionId}>
      <Scene frame={frame} globalGoalMinutes={installation.globalGoalMinutes}/>
      <div className="installation-vignette" aria-hidden="true"/>
      <header className="installation-header">
        <p className="installation-heading" id={titleId}>{replay ? t('installation.replay') : t('installation.title')}</p>
        <button type="button" className="installation-control" onClick={() => endPresentation('dismiss')}>{t('installation.close')}</button>
      </header>
      <div className="installation-commit" style={{ opacity: reducedMotion ? 1 : frame.installed * (1 - frame.returning * .35) }}>
        <span className="installation-time">{t('installation.time', { minutes: installation.globalGoalMinutes })}</span>
        <span className="installation-phase" aria-hidden="true">{t(SHOT_COPY_KEYS[frame.phase])}</span>
      </div>
      <footer className="installation-footer">
        <div className="installation-copy" style={{ opacity: reducedMotion ? 1 : .45 + .55 * frame.response }}>
          <p className="installation-promise" id={descriptionId}>{t('installation.promise')}</p>
          <p className="installation-active">{t('installation.active')}</p>
        </div>
        <div className="installation-actions">
          <button type="button" className="installation-control" aria-pressed={soundEnabled} onClick={toggleSound}>
            {soundEnabled ? t('installation.soundOff') : t('installation.soundOn')}
          </button>
          {reducedMotion && <button type="button" className="installation-control installation-complete" onClick={() => endPresentation('complete')}>{t('installation.finish')}</button>}
        </div>
      </footer>
      {!reducedMotion && <div className="installation-duration" aria-hidden="true"><span style={{ transform: `scaleX(${elapsedMs / INSTALLATION_PRESENTATION_DURATION_MS})` }}/></div>}
    </section>
  </div>;
}

export default FurinInstallationPresentation;
