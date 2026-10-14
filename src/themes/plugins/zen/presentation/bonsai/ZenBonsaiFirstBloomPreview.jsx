import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { generateZenBonsaiPlumeTopology } from '../../model/bonsai/plume/ZenBonsaiPlumeSpecies.js';
import { createZenBonsaiPlumeRenderPlanV1 } from '../../model/bonsai/plume/ZenBonsaiPlumeRenderPlan.js';
import { compileZenBonsaiPlumeBloomRegions } from '../../model/bonsai/plume/ZenBonsaiPlumeBloomRegions.js';
import { createZenBonsaiActivationPresentation } from '../../model/bonsai/presentation/ZenBonsaiActivationPresentation.js';
import { ZEN_BONSAI_FIRST_BLOOM_DURATION_MS, ZEN_BONSAI_FIRST_BLOOM_FULL_MASK,
  requireZenBonsaiFirstBloomRegionId } from '../../model/bonsai/plume/ZenBonsaiPlumeBloomPresentationContract.js';
import { createZenBonsaiPlumePixiRenderer } from '../../runtime/pixi/createZenBonsaiPlumePixiRenderer.js';
import { createZenBonsaiFirstBloomPlayback } from '../../runtime/worker/zenBonsaiFirstBloomPlayback.js';
import { getCurrentEnvironment } from '../../runtime/environment/zenWorldEnvironmentTimeline.js';
import './zenBonsaiFirstBloomPreview.css';

const WIDTH = 720, HEIGHT = 560, PIXEL_RATIO = 2, SEED = 151;
const PREVIEW_GLOBAL = '__ZEN_BONSAI_FIRST_BLOOM_PREVIEW__';
const LIFE = Object.freeze({ phase: 'mature', growth: 1, bloom: 1, vitality: 1,
  stress: 0, dryness: 0, branchSag: 0, windResponse: 0.8, dataDays: 5, analysisConfidence: 1 });
const admitted = () => document.visibilityState === 'visible' && document.hasFocus();

function createFixture() {
  const topology = generateZenBonsaiPlumeTopology({ seed: SEED, lifeState: LIFE, phenotype: {} });
  const renderPlan = createZenBonsaiPlumeRenderPlanV1({ topology,
    surface: { pixelWidth: WIDTH * PIXEL_RATIO, pixelHeight: HEIGHT * PIXEL_RATIO,
      treeViewport: { x: 0, y: 0, width: WIDTH * PIXEL_RATIO, height: HEIGHT * PIXEL_RATIO }, clipTreePaint: true },
    includePot: true, includeBackground: false, pixelRatio: PIXEL_RATIO,
    activationPresentation: createZenBonsaiActivationPresentation({ ratio: 1, reliability: 1 }) });
  const partition = compileZenBonsaiPlumeBloomRegions(renderPlan.scene.displayPlan);
  if (!partition.eligible) throw new Error(`ZEN_BONSAI_FIRST_BLOOM_PREVIEW_REGIONS:${partition.reason}`);
  return { topology, renderPlan, partition,
    renderOptions: { lifeState: LIFE, environmentState: getCurrentEnvironment(12.5), renderBackdrop: true } };
}

// A development-only render fixture. Anatomy, region membership, atlas poses,
// Pixi rendering and the five clocks are production owners. The local mask is
// intentionally detached from profile admission, claims and persistence.
export function ZenBonsaiFirstBloomPreview({ renderPrompt, onReady }) {
  if (typeof renderPrompt !== 'function' || typeof onReady !== 'function') {
    throw new Error('ZEN_BONSAI_FIRST_BLOOM_PREVIEW_HOST_REQUIRED');
  }
  const fixture = useMemo(createFixture, []);
  const canvasRef = useRef(null), engineRef = useRef(null), readyCallback = useRef(onReady);
  const [ready, setReady] = useState(false), [active, setActive] = useState(admitted);
  const [activatedMask, setActivatedMask] = useState(0), [complete, setComplete] = useState(false);
  const [projectionRevision, setProjectionRevision] = useState(0), [error, setError] = useState(null);
  if (error !== null) throw error;

  const regionTargets = useMemo(() => ({
    canvasRef, canvasCssWidth: WIDTH, canvasCssHeight: HEIGHT,
    renderPlanSignature: fixture.renderPlan.signature, projectionRevision,
    regions: fixture.partition.regions.map(region => ({ regionId: region.regionId,
      x: region.x / PIXEL_RATIO, y: region.y / PIXEL_RATIO })),
  }), [fixture, projectionRevision]);

  useEffect(() => {
    const canvas = canvasRef.current, playback = createZenBonsaiFirstBloomPlayback();
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let renderer = null, animationFrame = null, disposed = false, signalledReady = false;
    let session = 1, frameCount = 0, mask = 0, ended = false, lastMetrics = null, lastProgress = null;
    const eventId = () => `visual-bonsai-first-bloom-${session}`;
    const syncPresentation = () => {
      const isActive = admitted();
      playback.setWorkerActive(isActive);
      playback.setPresentation(ended ? null : { eventId: eventId(), phase: mask === 0 ? 'pending' : 'playing',
        activatedMask: mask, active: isActive, durationMs: ZEN_BONSAI_FIRST_BLOOM_DURATION_MS,
        reducedMotion: media.matches }, SEED);
      setActive(isActive);
      return isActive;
    };
    const cancelFrame = () => {
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      animationFrame = null;
    };
    const fail = failure => {
      cancelFrame();
      setError(failure);
    };
    const paint = now => {
      animationFrame = null;
      if (disposed) return;
      try {
        const isActive = admitted();
        if (!isActive) syncPresentation();
        lastProgress = playback.sample(now);
        lastMetrics = renderer.render({ scene: fixture, frameCount, windState: null,
          bloomPresentationProgress: lastProgress, bloomInvitation: playback.getInvitation() });
        const completion = playback.takeCompletion();
        if (completion !== null) {
          if (completion.completedMask !== ZEN_BONSAI_FIRST_BLOOM_FULL_MASK) {
            throw new Error('ZEN_BONSAI_FIRST_BLOOM_PREVIEW_PARTIAL_COMPLETION');
          }
          ended = true;
          playback.setPresentation(null, SEED);
          setComplete(true);
        }
        if (!signalledReady) {
          signalledReady = true;
          setReady(true);
          readyCallback.current();
        }
        if (isActive) {
          frameCount += 1;
          animationFrame = requestAnimationFrame(paint);
        }
      } catch (failure) { fail(failure); }
    };
    const scheduleFrame = () => {
      if (!disposed && animationFrame === null) animationFrame = requestAnimationFrame(paint);
    };
    const syncAdmission = () => {
      try {
        const isActive = syncPresentation();
        cancelFrame();
        // Commit the paused cue once, then leave no hidden/background clock.
        if (isActive) scheduleFrame();
        else paint(performance.now());
      } catch (failure) { fail(failure); }
    };
    const resizeProjection = () => setProjectionRevision(value => value + 1);
    const activate = regionId => {
      requireZenBonsaiFirstBloomRegionId(regionId);
      const bit = 1 << regionId;
      if (disposed || !signalledReady || ended || !admitted() || (mask & bit) !== 0) return;
      mask |= bit;
      setActivatedMask(mask);
      syncPresentation();
      scheduleFrame();
    };
    const reset = () => {
      if (disposed || !signalledReady || !admitted()) return;
      session += 1; mask = 0; ended = false;
      setActivatedMask(0); setComplete(false);
      syncPresentation(); scheduleFrame();
    };
    const api = Object.freeze({
      reset,
      read: () => ({ fixture: 'healthy_day_five_full_activation', seed: SEED,
        ready: signalledReady, active: admitted(), reducedMotion: media.matches,
        eventId: eventId(), activatedMask: mask, complete: ended,
        progress: lastProgress === null ? null : [...lastProgress],
        renderPlanSignature: fixture.renderPlan.signature,
        flowerCount: fixture.renderPlan.scene.displayPlan.flowerSprites.length,
        regions: fixture.partition.regions.map(region => ({ regionId: region.regionId,
          flowerId: region.flowerId, x: region.x / PIXEL_RATIO, y: region.y / PIXEL_RATIO })),
        renderer: lastMetrics, canvas: { cssWidth: WIDTH, cssHeight: HEIGHT,
          pixelWidth: canvas.width, pixelHeight: canvas.height } }),
    });
    try {
      if (Object.prototype.hasOwnProperty.call(window, PREVIEW_GLOBAL)) {
        throw new Error('ZEN_BONSAI_FIRST_BLOOM_PREVIEW_ALREADY_INSTALLED');
      }
      renderer = createZenBonsaiPlumePixiRenderer({ canvas });
      renderer.resize({ pixelWidth: WIDTH * PIXEL_RATIO, pixelHeight: HEIGHT * PIXEL_RATIO, pixelRatio: PIXEL_RATIO });
      engineRef.current = { activate, reset };
      Object.defineProperty(window, PREVIEW_GLOBAL, { configurable: true, value: api });
      window.addEventListener('focus', syncAdmission);
      window.addEventListener('blur', syncAdmission);
      window.addEventListener('resize', resizeProjection);
      document.addEventListener('visibilitychange', syncAdmission);
      media.addEventListener('change', syncAdmission);
      syncPresentation();
      paint(performance.now());
    } catch (failure) { fail(failure); }
    return () => {
      disposed = true;
      cancelFrame();
      playback.setWorkerActive(false); playback.setPresentation(null, SEED);
      window.removeEventListener('focus', syncAdmission);
      window.removeEventListener('blur', syncAdmission);
      window.removeEventListener('resize', resizeProjection);
      document.removeEventListener('visibilitychange', syncAdmission);
      media.removeEventListener('change', syncAdmission);
      if (window[PREVIEW_GLOBAL] === api) delete window[PREVIEW_GLOBAL];
      engineRef.current = null;
      if (renderer !== null) renderer.dispose();
    };
  }, [fixture]);

  const activate = useCallback(regionId => engineRef.current?.activate(regionId), []);
  return <main className="zen-bonsai-first-bloom-preview" data-visual-capture="bonsai-first-bloom">
    <div className="zen-bonsai-first-bloom-preview__surface">
      <canvas ref={canvasRef} width={WIDTH * PIXEL_RATIO} height={HEIGHT * PIXEL_RATIO}
        className="zen-bonsai-first-bloom-preview__canvas" aria-label="꽃피우기 체험용 분재" />
      {renderPrompt({ visible: ready && active && !complete, disabled: !active,
        activatedMask, error: null, onActivate: activate, regionTargets })}
      <button type="button" className="zen-bonsai-first-bloom-preview__reset" aria-label="봉오리부터 다시 체험하기"
        title="다시 체험하기" disabled={!ready || !active} onClick={() => engineRef.current?.reset()}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M4 10a8 8 0 1 1 1.7 7.1M4 4v6h6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  </main>;
}
