import React, { useEffect, useMemo, useRef } from 'react';
import { runRenderLoop } from '@/platform/rendering/renderLoop.js';
import { resolveRenderResolution } from '@/platform/rendering/renderBudgetContract.js';
import { observeDevicePixelRatio, readDevicePixelRatio } from '@/platform/rendering/devicePixelRatio.js';
import { useZenWorldEnvironmentAuthority } from '../../runtime/environment/useZenWorldEnvironmentAuthority.js';
import { sampleZenWorldEnvironment } from '../../runtime/environment/zenWorldEnvironmentKernel.js';
import { buildZenWeatherAuthoritySnapshot, normalizeZenWeatherAuthority, resolveZenSceneEnvironmentPolicy } from '../../runtime/environment/zenWorldWeatherAuthority.js';
import { createZenAppPetalField } from '../../runtime/petals/zenAppPetalField.js';
import { ZEN_APP_PETAL_PRESENTATIONS, requireZenAppPetalPresentation } from '../../runtime/petals/zenAppPetalPresentation.js';
import { ZEN_APP_PETAL_RENDER_BUDGET, MAX_ZEN_PETAL_LANDING_BATCH } from '../../runtime/petals/zenAppPetalBudget.js';
import { isZenPetalReceiverCancellation, submitZenPetalLandings } from '../../runtime/petals/zenPetalFieldBridge.js';
import { ZEN_PETAL_SPRITE_SIZE } from '../../runtime/petals/zenPetalMaterial.js';
import { createZenPetalSpriteCache } from '../../runtime/petals/zenPetalSpriteCache.js';
import { resolveZenWorldBotanicalMaterialLighting } from '../../runtime/environment/zenWorldBotanicalMaterialLighting.js';

let nextGeneration = 0;

export const ZenAppPetalLayer = ({ enabled, sourceSignal, solarLocationProfile, environmentMode, weatherAuthority = null,
    presentation = ZEN_APP_PETAL_PRESENTATIONS.AMBIENT }) => {
    requireZenAppPetalPresentation(presentation);
    const canvasRef = useRef(null);
    const policy = useMemo(() => resolveZenSceneEnvironmentPolicy({ environmentMode }), [environmentMode]);
    const resolvedWeather = useMemo(() => weatherAuthority === null
        ? buildZenWeatherAuthoritySnapshot({ mode: policy.weatherAuthorityMode })
        : normalizeZenWeatherAuthority(weatherAuthority), [weatherAuthority, policy.weatherAuthorityMode]);
    const { envAuthority, timeContext } = useZenWorldEnvironmentAuthority({
        solarLocationProfile,
        weatherAuthority: resolvedWeather,
        presentationHour: policy.presentationHour,
        minimumRealtimeSyncIntervalMs: 60_000,
    });
    const worldPresentation = useMemo(() => {
        const { environment } = sampleZenWorldEnvironment({ authority: envAuthority, now: timeContext.timestampMs });
        return {
            sampleTimeMs: timeContext.timestampMs,
            wind: { intensity: environment.windIntensity, direction: environment.windDirection, gust: environment.gustEnvelope },
            atmosphere: { petals: environment.petals, rainIntensity: environment.rainIntensity,
                weatherEventId: environment.weatherEventId, weatherEventPhase: environment.weatherEventPhase },
            materialLighting: resolveZenWorldBotanicalMaterialLighting(environment),
        };
    }, [envAuthority, timeContext.timestampMs]);
    const inputs = useRef({ sourceSignal, ...worldPresentation, presentation });
    inputs.current = { sourceSignal, ...worldPresentation, presentation };
    const wakeRef = useRef(null);
    const syncInputsRef = useRef(null);

    useEffect(() => {
        syncInputsRef.current?.();
        wakeRef.current?.();
    }, [sourceSignal, presentation, worldPresentation]);

    useEffect(() => {
        if (!enabled) return undefined;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d', { alpha: true });
        if (!context) throw new Error('ZEN_APP_PETAL_CONTEXT_UNAVAILABLE');
        const generation = ++nextGeneration;
        const field = createZenAppPetalField({ generation: `zen-app-petal-${generation}`, seed: generation * 7919 });
        canvas.dataset.petalFieldId = `zen-app-petal-${generation}`;
        let landedCount = 0;
        canvas.dataset.landedPetalCount = '0';
        const cache = createZenPetalSpriteCache(() => document.createElement('canvas'), inputs.current.materialLighting);
        canvas.dataset.petalTextureCount = '0';
        canvas.dataset.blurredPetalTextureCount = '0';
        let lastTextureCount = 0;
        let disposed = false;
        let faulted = false;
        let resolution = null;

        const syncInputs = () => {
            if (resolution === null) return;
            field.setInputs({ width: resolution.cssWidth, height: resolution.cssHeight,
                sourceSignal: inputs.current.sourceSignal, wind: inputs.current.wind,
                sampleTimeMs: inputs.current.sampleTimeMs,
                atmosphere: inputs.current.atmosphere, presentation: inputs.current.presentation });
        };
        syncInputsRef.current = syncInputs;

        const resize = () => {
            const { width, height } = canvas.getBoundingClientRect();
            if (width <= 0 || height <= 0) return;
            const next = resolveRenderResolution({
                cssWidth: width, cssHeight: height,
                devicePixelRatio: readDevicePixelRatio(), renderBudget: ZEN_APP_PETAL_RENDER_BUDGET,
            });
            if (!resolution || next.pixelWidth !== resolution.pixelWidth || next.pixelHeight !== resolution.pixelHeight) {
                canvas.width = next.pixelWidth;
                canvas.height = next.pixelHeight;
            }
            resolution = next;
            syncInputs();
        };
        const clear = () => {
            context.setTransform(1, 0, 0, 1, 0, 0);
            context.clearRect(0, 0, canvas.width, canvas.height);
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(canvas);
        const stopDpr = observeDevicePixelRatio({ onChange: resize });
        const stopLoop = runRenderLoop({
            targetFps: ZEN_APP_PETAL_RENDER_BUDGET.targetFps,
            simHz: 60,
            maxCatchUpSteps: 3,
            maxElapsedMs: 50,
            pauseWhenDocumentHidden: true,
            respectReducedMotion: true,
            renderReducedMotionFrame: false,
            pausedFrameIntervalMs: 1_000,
            isPaused: () => faulted || resolution === null || inputs.current.presentation.mode === 'covered'
                || (inputs.current.presentation.mode === 'ambient' && inputs.current.sourceSignal === null && field.isIdle()),
            onPause: () => {
                if (inputs.current.presentation.mode === 'covered') field.retirePendingLandings();
                else field.clear();
                canvas.dataset.petalCount = String(field.particles.length);
                clear();
            },
            onSimStep: ({ simStepSec }) => {
                try {
                    const candidates = field.step({ dtSec: simStepSec });
                    for (let offset = 0; offset < candidates.length; offset += MAX_ZEN_PETAL_LANDING_BATCH) {
                        const batch = candidates.slice(offset, offset + MAX_ZEN_PETAL_LANDING_BATCH);
                        void submitZenPetalLandings(batch).then((acceptedIds) => {
                            if (!disposed) {
                                field.settleLandings(batch, acceptedIds);
                                landedCount += acceptedIds.length;
                                canvas.dataset.landedPetalCount = String(landedCount);
                            }
                        }).catch((error) => {
                            // ACK failure is terminal for this attempted handoff. It
                            // must not re-emit or replay a potentially landed particle.
                            if (!disposed) field.settleLandings(batch, batch.map(({ id }) => id));
                            if (!isZenPetalReceiverCancellation(error)) {
                                console.error('[ZenAppPetalLayer] landing handoff failed', error);
                            }
                        });
                    }
                    canvas.dataset.petalCount = String(field.particles.length);
                    const diagnostics = field.getDiagnostics();
                    canvas.dataset.suppressedPetalCount = String(diagnostics.suppressedCount);
                    canvas.dataset.petalReleasePhase = diagnostics.releasePhase;
                    canvas.dataset.petalPolicyRevision = String(diagnostics.policyRevision);
                } catch (error) {
                    faulted = true;
                    canvas.dataset.petalStatus = 'failed';
                    field.clear();
                    clear();
                    console.error('[ZenAppPetalLayer] field failed', error);
                }
            },
            onRender: () => {
                cache.setMaterialLighting(inputs.current.materialLighting);
                clear();
                context.setTransform(resolution.effectivePixelRatio, 0, 0, resolution.effectivePixelRatio, 0, 0);
                // Far petals paint first without reordering simulation/ACK state.
                for (const petal of field.particles.slice().sort((a, b) => a.depth - b.depth)) {
                    const sprite = cache.get(petal.color, petal.shapeType, petal.blurIndex);
                    const spriteWidth = sprite.width * petal.size / ZEN_PETAL_SPRITE_SIZE;
                    context.save();
                    context.translate(petal.x, petal.y);
                    context.rotate(petal.rotation);
                    context.scale(petal.tumbleX, petal.tumbleY);
                    context.globalAlpha = petal.opacity;
                    context.drawImage(sprite, -spriteWidth / 2, -spriteWidth / 2, spriteWidth, spriteWidth);
                    context.restore();
                }
                const textureStats = cache.getDiagnostics();
                if (textureStats.textureCount !== lastTextureCount) {
                    lastTextureCount = textureStats.textureCount;
                    canvas.dataset.petalTextureCount = String(textureStats.textureCount);
                    canvas.dataset.blurredPetalTextureCount = String(textureStats.blurredTextureCount);
                }
            },
        });
        wakeRef.current = stopLoop.wake;
        canvas.dataset.petalStatus = 'ready';
        return () => {
            disposed = true;
            syncInputsRef.current = null;
            wakeRef.current = null;
            stopLoop();
            stopDpr();
            observer.disconnect();
            cache.dispose();
            canvas.width = 0;
            canvas.height = 0;
        };
    }, [enabled]);

    return <canvas ref={canvasRef} aria-hidden="true" data-zen-app-petal-field="true"
        data-petal-mode={presentation.mode} data-petal-landings-enabled={presentation.landingEnabled}
        style={{ position: 'fixed', inset: 0, zIndex: 20, width: '100%', height: '100%', pointerEvents: 'none' }} />;
};

export default ZenAppPetalLayer;
