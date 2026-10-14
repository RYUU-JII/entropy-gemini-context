import { BUILD_INCLUDE_DEBUG_TOOLS } from '@/platform/build/releaseCapabilities.js';
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { resolveArtifactSimulationRuntime } from '@/themes/core/artifacts/runtime/simulationRuntime.js';
import { useZenArtifactRenderChannels } from './useZenArtifactRenderChannels.js';
import { useZenEnsoConstellation } from './useZenEnsoConstellation.js';
import { resolveDailyFurinMantra } from './recipes/zenFurinInscriptions.js';
import { resolveConnectedShishiOdoshiGround } from './recipes/zenShishiOdoshiRuntimeRecipe.js';
import { getZenArtifactMaterialKey, snapshotZenArtifactDescriptor } from '../../presentation/artifacts/engine/zenArtifactDescriptor.js';
import { loadZenArtifactGalleryClient } from '../../presentation/artifacts/engine/zenArtifactModules.js';
import { getZenArtifactGalleryGeometry, resolveZenArtifactGalleryResolution, ZEN_ARTIFACT_GALLERY_CANVAS_STYLE } from '../../presentation/artifacts/engine/zenArtifactGalleryGeometry.js';
import { useDevicePixelRatio } from '@/ui-kit/hooks/useDevicePixelRatio.js';

const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));

// Enso's stage is how many of its counted signals are veiled.
function requireEnsoStage(visual) {
  const { activeCount, stageCount } = visual || {};
  if (!Number.isInteger(stageCount) || stageCount < 1 || !Number.isInteger(activeCount)
    || activeCount < 0 || activeCount > stageCount) {
    throw new Error('ZEN_ARTIFACT_ENSO_STAGE_INVALID');
  }
  return activeCount;
}

// Gallery presentation only. Gate rituals, sound and protection actions remain
// with the standalone widgets/controllers. One canvas survives family changes.
export default function ZenArtifactGalleryVisual({ artifactRenderContext, isEnabled = true, onReady, onPrepared }) {
  if (typeof onPrepared !== 'function') throw new Error('ZEN_ARTIFACT_PRESENTATION_OWNER_REQUIRED');
  const channels = useZenArtifactRenderChannels({ artifactRenderContext });
  const { id, origin } = useMemo(() => getZenArtifactGalleryGeometry(artifactRenderContext.visualKey), [artifactRenderContext.visualKey]);
  const canvasRef = useRef(null), engineRef = useRef(null), readyRef = useRef(onReady);
  readyRef.current = onReady;
  const [failure, setFailure] = useState(null);
  const [instance, setInstance] = useState(null);
  const [prepared, setPrepared] = useState(null);
  const committedRef = useRef(null);
  const requestSequenceRef = useRef(0), previousRequestRef = useRef(null);
  const rawDevicePixelRatio = useDevicePixelRatio();
  // The fixed canvas's effective resolution owns its renderer lifetime. Moving
  // between capped monitors must not discard identical scenes and textures.
  const devicePixelRatio = resolveZenArtifactGalleryResolution(rawDevicePixelRatio).effectivePixelRatio;
  const { constellationDayKey, isConstellationVisible } = useZenEnsoConstellation(id === 'enso' && isEnabled && channels.isVisuallyActive);
  const mantraText = resolveDailyFurinMantra({ cycleState: channels.scene.cycleState }).join('');
  const mantra = useMemo(() => [...mantraText], [mantraText]);
  const visual = channels.visualState;
  const spiritualIntensity = clamp(visual?.overallIntensity ?? (
    clamp(visual?.children?.socialMetrics?.ratio) * .42 + clamp(visual?.children?.timeSignals?.ratio) * .34
    + clamp(visual?.children?.socialSurface?.ratio) * .24));
  const descriptorInput = useMemo(() => ({ id, color: channels.color, nightDepth: channels.nightDepth,
    isActive: channels.isVisuallyActive, visualWeight: channels.visualWeight,
    spiritualIntensity, dayKey: constellationDayKey, constellationVisible: isConstellationVisible, mantra,
  }), [id, channels.color, channels.nightDepth, channels.isVisuallyActive, channels.visualWeight,
    spiritualIntensity, constellationDayKey, isConstellationVisible, mantra]);
  const materialKey = getZenArtifactMaterialKey(descriptorInput);
  const descriptorConstellation = id === 'enso' ? isConstellationVisible : null;
  // The canonical material key owns scene construction inputs. Enso's visibility
  // also reaches configure(); other families cannot invalidate pixels through
  // unrelated activity, daily-state or material inputs.
  const descriptor = useMemo(() => snapshotZenArtifactDescriptor(descriptorInput),
    [materialKey, descriptorConstellation]);
  const { activityWeight, simulationMode, isSimulationLive, isSimulationSettling, isSimulationHalted,
    shouldRunSimulation, visualWeight } = resolveArtifactSimulationRuntime({ artifactActivity: channels.activity,
    artifactRenderState: channels.renderState, isActive: channels.isVisuallyActive,
    shouldAnimate: channels.renderState.shouldAnimate && channels.runtimeBudget.enabled,
    settleVisualFloor: id === 'furin' ? .1 : .12, settleVisualScale: id === 'furin' ? .85 : .9,
    liveWeightFloor: id === 'furin' ? 0 : 1 });
  const { groundTiltDeg, rippleAspect, rippleYAspectGain } = resolveConnectedShishiOdoshiGround(channels.scene.groundProjection);
  const ground = useMemo(() => ({ groundTiltDeg, rippleAspect, rippleYAspectGain }), [groundTiltDeg, rippleAspect, rippleYAspectGain]);
  const shouldAnimateAmbient = channels.shouldAnimateAmbient;
  const simulation = useMemo(() => ({ activityWeight, simulationMode, isSimulationLive, isSimulationSettling,
    isSimulationHalted, shouldRunSimulation, visualWeight }), [activityWeight, simulationMode, isSimulationLive,
    isSimulationSettling, isSimulationHalted, shouldRunSimulation, visualWeight]);
  // These are the inputs each scene's configure() actually consumes. The four
  // material-only scenes have no live presentation; their motion uses `animate`.
  const sceneSimulation = id === 'furin' || id === 'shishi-odoshi' ? simulation : null;
  const sceneGround = id === 'shishi-odoshi' ? ground : null;
  const sceneAmbient = id === 'furin' || id === 'shishi-odoshi' ? shouldAnimateAmbient : null;
  const sceneConstellation = id === 'enso' ? isConstellationVisible : null;
  const ensoStage = id === 'enso' ? requireEnsoStage(visual) : null;
  const ensoStageCount = id === 'enso' ? visual.stageCount : null;
  const ensoInstant = id === 'enso' ? !shouldAnimateAmbient : null;
  const presentation = useMemo(() => {
    switch (id) {
      case 'shoji': case 'great-wave': case 'tome-ishi': case 'ishidouro': return null;
      case 'enso': return { constellationVisible: sceneConstellation, stage: ensoStage, stageCount: ensoStageCount, instant: ensoInstant };
      case 'furin': return { ...sceneSimulation, shouldAnimateAmbient: sceneAmbient };
      case 'shishi-odoshi': return { ...sceneSimulation, shouldAnimateAmbient: sceneAmbient, ground: sceneGround };
      default: throw new Error('ZEN_ARTIFACT_SCENE_UNKNOWN');
    }
  }, [id, sceneSimulation, sceneGround, sceneAmbient, sceneConstellation, ensoStage, ensoStageCount, ensoInstant]);
  const animate = isEnabled && (id === 'furin' || id === 'shishi-odoshi'
    ? presentation.shouldRunSimulation
    : id === 'shoji' || id === 'tome-ishi' ? channels.shouldAnimateActiveVisual : channels.shouldAnimateAmbient);
  // Pixel inputs own preparation; the parent's publication callback still fences
  // the exact DOM candidate, but cannot invalidate identical Worker work.
  const frameRequest = useMemo(() => ({ descriptor, origin, animate, presentation, devicePixelRatio }),
    [descriptor, origin, animate, presentation, devicePixelRatio]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    let engine = null, cancelled = false;
    canvas.dataset.zenArtifactEngineStatus = 'preparing';
    const inspect = () => { canvas.dataset.zenArtifactEngineSnapshot = JSON.stringify(engine.snapshot()); };
    void loadZenArtifactGalleryClient().then(({ acquireZenArtifactGalleryClient }) => {
      if (cancelled) return;
      engine = acquireZenArtifactGalleryClient({ canvas, devicePixelRatio, onError: error => { if (!cancelled) setFailure(error); } });
      engineRef.current = engine;
      if (BUILD_INCLUDE_DEBUG_TOOLS) canvas.addEventListener('zen-artifact-engine-inspect', inspect);
      setInstance(engine);
    }).catch(error => { if (!cancelled) setFailure(error); });
    return () => {
      cancelled = true;
      engineRef.current = null;
      canvas.removeEventListener('zen-artifact-engine-inspect', inspect);
      if (!engine) return;
      engine.dispose();
      if (BUILD_INCLUDE_DEBUG_TOOLS) canvas.dispatchEvent(new CustomEvent('zen-artifact-engine-disposed', { bubbles: true, detail: engine.snapshot() }));
    };
  }, [devicePixelRatio]);

  useLayoutEffect(() => {
    if (!instance || instance !== engineRef.current || !isEnabled) return undefined;
    let current = true;
    const hostRequestId = ++requestSequenceRef.current;
    if (BUILD_INCLUDE_DEBUG_TOOLS) {
      const previous = previousRequestRef.current;
      const changedInputs = previous
        ? Object.keys(frameRequest).filter(key => frameRequest[key] !== previous[key]) : ['initial'];
      canvasRef.current.dispatchEvent(new CustomEvent('zen-artifact-frame', { bubbles: true, detail: {
        type: 'prepare', atMs: performance.now(), clockDomain: 'document', timeOriginMs: performance.timeOrigin,
        hostRequestId, changedInputs, reason: changedInputs.length ? 'inputs_changed' : 'reactivated', materialKey, devicePixelRatio,
      } }));
      previousRequestRef.current = frameRequest;
    }
    canvasRef.current.dataset.zenArtifactEngineStatus = 'preparing';
    // Render the entire current presentation before publishing its bitmap.
    // Material caching remains in the Worker and ignores geometry-only changes.
    void instance.prepareFrame(descriptor, { origin, animate, presentation }).then(ticket => {
      if (current && ticket.status === 'prepared') setPrepared({ instance, ticket, hostRequestId, request: frameRequest });
    }).catch(error => { if (current) setFailure(error); });
    return () => { current = false; };
  }, [instance, frameRequest, isEnabled]);

  useLayoutEffect(() => {
    if (!isEnabled) instance?.pause();
  }, [instance, isEnabled]);

  const submit = useCallback(() => {
    const receipt = committedRef.current === prepared
      ? instance.reuseDisplayedFrame(prepared.ticket) : instance.commitFrame(prepared.ticket);
    if (receipt.status === 'committed') {
      committedRef.current = prepared;
      const canvas = canvasRef.current;
      canvas.dataset.zenArtifactEngineStatus = 'ready';
      canvas.dataset.zenArtifactEngineScene = id;
      if (BUILD_INCLUDE_DEBUG_TOOLS) {
        canvas.dataset.zenArtifactEngineReceipt = JSON.stringify(receipt);
        canvas.dispatchEvent(new CustomEvent('zen-artifact-frame', { bubbles: true, detail: {
          type: 'commit', atMs: performance.now(), clockDomain: 'document', timeOriginMs: performance.timeOrigin,
          hostRequestId: prepared.hostRequestId, devicePixelRatio, receipt,
        } }));
      }
      readyRef.current?.();
    }
    return receipt;
  }, [instance, prepared, descriptor, origin, animate, presentation, id, devicePixelRatio]);

  useLayoutEffect(() => {
    if (isEnabled && prepared?.instance === instance && prepared.request === frameRequest && prepared.ticket.key === materialKey) onPrepared(submit);
  }, [prepared, instance, frameRequest, materialKey, isEnabled, onPrepared, submit]);

  if (failure) throw failure;
  return <div aria-hidden="true" className="relative h-full w-full pointer-events-none overflow-visible">
    <canvas ref={canvasRef} data-zen-artifact-engine="gallery" style={ZEN_ARTIFACT_GALLERY_CANVAS_STYLE} />
  </div>;
}
