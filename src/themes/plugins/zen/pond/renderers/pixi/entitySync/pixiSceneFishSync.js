import { clamp as clampValue } from '../../../model/koi/koiMotion.js';
import { PixiKoiFish } from '../PixiKoiFish.js';
import { resolvePixiKoiShadowLightingState, resolveZenKoiMoonlightPresence } from '../koiFishMaterialExecutor.js';
import { resolveArray } from '../pixiSceneHelpers.js';
import { toRgbHex } from '../../../runtime/zenColorMath.js';
import { projectZenPondSubmergedShadow, sampleZenKoiShadowBottomDepth } from '../../../runtime/zenPondShadowProjection.js';
import { resolveZenPondShadowGeometry } from '../../../contracts/zenPondShadowGeometry.js';
import { isZenKoiShadowSentinel, ZEN_SHADOW_SENTINEL_PROJECTION } from '../zenKoiShadowSentinelPresentation.js';
import { resolveZenKoiWaterMaterial, ZEN_KOI_SILHOUETTE_WATER_MATERIAL } from '../zenKoiWaterMaterial.js';

const KOI_FIRST_FRAME_VISIBLE_ALPHA_THRESHOLD = 0.05;

const nowMs = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);

const resolveSceneChromaChannels = (frameChannels = null) => {
    const source = frameChannels?.sceneChromaChannels;
    const r = Number(source?.r);
    const g = Number(source?.g);
    const b = Number(source?.b);
    return {
        r: Number.isFinite(r) ? clampValue(r, 0, 255) : 214,
        g: Number.isFinite(g) ? clampValue(g, 0, 255) : 220,
        b: Number.isFinite(b) ? clampValue(b, 0, 255) : 222,
    };
};

const blendSceneTintToPigment = (tint, mix) => {
    if (mix <= 0) return tint;
    const r = (tint >> 16) & 0xff;
    const g = (tint >> 8) & 0xff;
    const b = tint & 0xff;
    return toRgbHex(
        r + (255 - r) * mix,
        g + (255 - g) * mix,
        b + (255 - b) * mix,
    );
};

const resolveSharedFishLighting = (
    frameChannels = null,
    surfaceMaterialLightingActive = false,
) => {
    const safeFrameChannels = frameChannels && typeof frameChannels === 'object'
        ? frameChannels
        : {};
    const rawSceneBrightness = Number(safeFrameChannels.sceneBrightness);
    const sceneBrightness = clampValue(
        Number.isFinite(rawSceneBrightness) ? rawSceneBrightness : 0.5,
        0,
        1,
    );
    const daylightRaw = Number(safeFrameChannels.daylight ?? safeFrameChannels.diurnalPhase);
    const daylight = clampValue(
        Number.isFinite(daylightRaw) ? daylightRaw : sceneBrightness,
        0,
        1,
    );
    const nightDepthRaw = Number(safeFrameChannels.nightDepth);
    const nightDepth = clampValue(
        Number.isFinite(nightDepthRaw) ? nightDepthRaw : (1 - daylight),
        0,
        1,
    );
    const lightChannels = resolveSceneChromaChannels(safeFrameChannels);
    const fishBaseTint = lightChannels
        ? toRgbHex(
            clampValue(lightChannels.r * (0.42 + sceneBrightness * 0.88), 36, 255),
            clampValue(lightChannels.g * (0.44 + sceneBrightness * 0.86), 40, 255),
            clampValue(lightChannels.b * (0.48 + sceneBrightness * 0.82), 46, 255),
        )
        : toRgbHex(
            78 + sceneBrightness * 172,
            84 + sceneBrightness * 168,
            94 + sceneBrightness * 160,
        );
    const fishHighlightTint = lightChannels
        ? toRgbHex(
            clampValue(lightChannels.r * (0.56 + sceneBrightness * 0.74), 60, 255),
            clampValue(lightChannels.g * (0.58 + sceneBrightness * 0.72), 64, 255),
            clampValue(lightChannels.b * (0.62 + sceneBrightness * 0.68), 72, 255),
        )
        : toRgbHex(
            112 + sceneBrightness * 148,
            118 + sceneBrightness * 144,
            126 + sceneBrightness * 138,
        );
    // The attached canonical surface pass owns moonlit material illumination.
    // Remove the duplicate scene tint continuously with the shared night phase;
    // daylight and renderers without that pass retain their established tint.
    const surfaceMaterialMix = surfaceMaterialLightingActive === true ? nightDepth : 0;
    return {
        daylight,
        nightDepth,
        moonlitPresence: surfaceMaterialLightingActive === true
            ? resolveZenKoiMoonlightPresence(safeFrameChannels) : 0,
        fishBaseTint: blendSceneTintToPigment(fishBaseTint, surfaceMaterialMix),
        fishHighlightTint: blendSceneTintToPigment(fishHighlightTint, surfaceMaterialMix),
    };
};

const roundDiagnosticNumber = (value, digits = 5, fallback = 0) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Number(numeric.toFixed(digits));
};

const createKoiRenderDiagnostics = (sharedFishShadowLighting) => ({
    fishCount: 0,
    visibleFishCount: 0,
    focusHoveredCount: 0,
    focusSelectedCount: 0,
    focusGlowVisibleCount: 0,
    firstSiteRevealCount: 0,
    firstSiteMaterialPresence: 1,
    invitationEnteringCount: 0,
    shadowSentinelCount: 0,
    createdFishCount: 0,
    creationTotalMs: 0,
    updateTotalMs: 0,
    slowestCreationMs: 0,
    slowestCreationUid: '',
    materialSignatureUpdates: 0,
    materialWrites: 0,
    materialSkipCount: 0,
    shadowRequestedCount: 0,
    shadowEnabledCount: 0,
    shadowTextureAllocatedCount: 0,
    shadowGeometryUpdateCount: 0,
    shadowPointWriteCount: 0,
    shadowAlphaWrites: 0,
    shadowAlphaSum: 0,
    shadowAlphaMin: Number.POSITIVE_INFINITY,
    shadowAlphaMax: 0,
    shadowAlphaSamples: 0,
    shadowLighting: sharedFishShadowLighting,
});

const recordKoiRenderDiagnostics = (diagnostics, updateResult = null, createdThisFrame = false) => {
    if (!diagnostics) return;
    diagnostics.fishCount += 1;
    if (createdThisFrame) diagnostics.createdFishCount += 1;
    if (!updateResult) return;
    if (updateResult.shadowRequested === true) {
        diagnostics.shadowRequestedCount += 1;
    }
    if (updateResult.shadowTextureAllocated === true) {
        diagnostics.shadowTextureAllocatedCount += 1;
    }
    diagnostics.shadowGeometryUpdateCount += Math.max(
        0,
        Math.floor(
            Number(updateResult.shadowGeometryUpdateCount) || 0,
        ),
    );
    diagnostics.shadowPointWriteCount += Math.max(
        0,
        Math.floor(
            Number(updateResult.shadowPointWriteCount) || 0,
        ),
    );
    if (updateResult.visible !== true) return;
    if (Number(updateResult.effectiveOpacity) <= KOI_FIRST_FRAME_VISIBLE_ALPHA_THRESHOLD) return;
    diagnostics.visibleFishCount += 1;
    if (updateResult.shadowSentinel === true && updateResult.shadowEnabled === true
        && updateResult.shadowOpacity > KOI_FIRST_FRAME_VISIBLE_ALPHA_THRESHOLD) {
        diagnostics.shadowSentinelCount += 1;
    }
    if (updateResult.firstSiteRevealProgress > 0) {
        diagnostics.firstSiteRevealCount += 1;
        diagnostics.firstSiteMaterialPresence = Math.min(diagnostics.firstSiteMaterialPresence, updateResult.firstSiteMaterialPresence);
    }
    if (updateResult.materialSignatureChanged === true) {
        diagnostics.materialSignatureUpdates += 1;
    } else {
        diagnostics.materialSkipCount += 1;
    }
    diagnostics.materialWrites += Math.max(0, Math.floor(Number(updateResult.materialWriteCount) || 0));
    if (updateResult.shadowEnabled === true) {
        diagnostics.shadowEnabledCount += 1;
        diagnostics.shadowAlphaWrites += Math.max(0, Math.floor(Number(updateResult.shadowAlphaWriteCount) || 0));
        const alpha = Number(updateResult.shadowOpacity);
        if (Number.isFinite(alpha)) {
            diagnostics.shadowAlphaSum += alpha;
            diagnostics.shadowAlphaMin = Math.min(diagnostics.shadowAlphaMin, alpha);
            diagnostics.shadowAlphaMax = Math.max(diagnostics.shadowAlphaMax, alpha);
            diagnostics.shadowAlphaSamples += 1;
        }
    }
};

const finalizeKoiRenderDiagnostics = (
    diagnostics,
    {
        fishShadowRequested = false,
        textureCacheDiagnostics = null,
    } = {},
) => {
    const samples = Math.max(0, Math.floor(Number(diagnostics?.shadowAlphaSamples) || 0));
    return {
        fishCount: Math.max(0, Math.floor(Number(diagnostics?.fishCount) || 0)),
        firstSiteRevealCount: diagnostics.firstSiteRevealCount,
        firstSiteMaterialPresence: diagnostics.firstSiteMaterialPresence,
        invitationEnteringCount: diagnostics.invitationEnteringCount,
        shadowSentinelCount: diagnostics.shadowSentinelCount,
        visibleFishCount: Math.max(0, Math.floor(Number(diagnostics?.visibleFishCount) || 0)),
        focusHoveredCount: diagnostics.focusHoveredCount,
        focusSelectedCount: diagnostics.focusSelectedCount,
        focusGlowVisibleCount: diagnostics.focusGlowVisibleCount,
        createdFishCount: Math.max(0, Math.floor(Number(diagnostics?.createdFishCount) || 0)),
        creationTotalMs: roundDiagnosticNumber(diagnostics?.creationTotalMs, 3),
        updateTotalMs: roundDiagnosticNumber(diagnostics?.updateTotalMs, 3),
        slowestCreationMs: roundDiagnosticNumber(diagnostics?.slowestCreationMs, 3),
        slowestCreationUid: String(diagnostics?.slowestCreationUid || ''),
        bodyCacheEntryCount: Math.max(
            0,
            Math.floor(Number(textureCacheDiagnostics?.bodyEntryCount) || 0),
        ),
        bodyCacheReferencedEntryCount: Math.max(
            0,
            Math.floor(Number(textureCacheDiagnostics?.bodyReferencedEntryCount) || 0),
        ),
        bodyCacheReferenceCount: Math.max(
            0,
            Math.floor(Number(textureCacheDiagnostics?.bodyReferenceCount) || 0),
        ),
        materialSignatureUpdates: Math.max(0, Math.floor(Number(diagnostics?.materialSignatureUpdates) || 0)),
        materialWrites: Math.max(0, Math.floor(Number(diagnostics?.materialWrites) || 0)),
        materialSkipCount: Math.max(0, Math.floor(Number(diagnostics?.materialSkipCount) || 0)),
        fishShadowRequested: fishShadowRequested === true,
        shadowRequestedCount: Math.max(
            0,
            Math.floor(
                Number(diagnostics?.shadowRequestedCount) || 0,
            ),
        ),
        shadowEnabledCount: Math.max(0, Math.floor(Number(diagnostics?.shadowEnabledCount) || 0)),
        shadowTextureAllocatedCount: Math.max(
            0,
            Math.floor(
                Number(
                    diagnostics?.shadowTextureAllocatedCount,
                ) || 0,
            ),
        ),
        shadowGeometryUpdateCount: Math.max(
            0,
            Math.floor(
                Number(
                    diagnostics?.shadowGeometryUpdateCount,
                ) || 0,
            ),
        ),
        shadowPointWriteCount: Math.max(
            0,
            Math.floor(
                Number(diagnostics?.shadowPointWriteCount) || 0,
            ),
        ),
        shadowCacheEntryCount: Math.max(
            0,
            Math.floor(
                Number(
                    textureCacheDiagnostics?.shadowEntryCount,
                ) || 0,
            ),
        ),
        shadowCacheReferencedEntryCount: Math.max(
            0,
            Math.floor(
                Number(
                    textureCacheDiagnostics
                        ?.shadowReferencedEntryCount,
                ) || 0,
            ),
        ),
        shadowCacheReferenceCount: Math.max(
            0,
            Math.floor(
                Number(
                    textureCacheDiagnostics?.shadowReferenceCount,
                ) || 0,
            ),
        ),
        shadowAlphaWrites: Math.max(0, Math.floor(Number(diagnostics?.shadowAlphaWrites) || 0)),
        shadowAlphaAvg: samples > 0
            ? roundDiagnosticNumber(diagnostics.shadowAlphaSum / samples)
            : 0,
        shadowAlphaMin: samples > 0
            ? roundDiagnosticNumber(diagnostics.shadowAlphaMin)
            : 0,
        shadowAlphaMax: samples > 0
            ? roundDiagnosticNumber(diagnostics.shadowAlphaMax)
            : 0,
        shadowLighting: diagnostics?.shadowLighting || null,
    };
};

const syncFish = ({
    fishRef,
    webGLVersion,
    pixiFishPool,
    fishContainer,
    hoveredDomainRef,
    lockedTargetRef,
    selectedFishUidRef,
    rendererDebugToggles,
    rendererDebugTogglesRef,
    frameCount,
    frameChannels = null,
    koiCausticReceiver = null,
    surfaceMaterialLightingActive = false,
    renderTimeMs = null,
    fishShadowProfile,
    bathymetryFieldRef,
    koiTextureCache,
    aliveSet = null,
}) => {
    const safeFrameChannels = frameChannels && typeof frameChannels === 'object'
        ? frameChannels
        : {};
    const fishes = resolveArray(fishRef);
    const sharedFishLighting = resolveSharedFishLighting(safeFrameChannels, surfaceMaterialLightingActive);
    const sharedFishShadowLighting = resolvePixiKoiShadowLightingState(safeFrameChannels);
    const diagnostics = createKoiRenderDiagnostics(sharedFishShadowLighting);

    const aliveFish = aliveSet || new Set();
    aliveFish.clear();
    for (let i = 0; i < fishes.length; i += 1) {
        const fish = fishes[i];
        if (!fish) continue;
        aliveFish.add(fish.uid);

        let pixiFish = pixiFishPool.get(fish.uid);
        let createdThisFrame = false;
        if (!pixiFish) {
            const creationStartedMs = nowMs();
            pixiFish = new PixiKoiFish(fish, koiTextureCache, webGLVersion);
            const creationMs = Math.max(0, nowMs() - creationStartedMs);
            diagnostics.creationTotalMs += creationMs;
            if (creationMs > diagnostics.slowestCreationMs) {
                diagnostics.slowestCreationMs = creationMs;
                diagnostics.slowestCreationUid = fish.uid;
            }
            pixiFishPool.set(fish.uid, pixiFish);
            fishContainer.addChild(pixiFish.container);
            createdThisFrame = true;
        }

        const hovered = (fish.domain === hoveredDomainRef?.current && !!fish.domain)
            || fish.invitationAttending === true;
        const domainSelected = !!fish.domain && fish.domain === lockedTargetRef?.current;
        const localSelected = selectedFishUidRef?.current !== null && fish.uid === selectedFishUidRef?.current;
        const wasVisible = pixiFish.container.visible !== false;
        pixiFish.container.visible = true;
        fish.shadowRenderProfile = fishShadowProfile;
        const firstSiteMaterialPresence = fish.firstSiteReveal?.domain === fish.domain && fish.domain
            ? pixiFish.prepareFirstSiteMaterial(fish) : 1;
        let pondShadowProjection = null;
        let waterMaterial = ZEN_KOI_SILHOUETTE_WATER_MATERIAL;
        if (isZenKoiShadowSentinel(fish)) {
            pondShadowProjection = ZEN_SHADOW_SENTINEL_PROJECTION;
        } else {
            const bottomDepth = sampleZenKoiShadowBottomDepth(bathymetryFieldRef?.current, fish);
            waterMaterial = resolveZenKoiWaterMaterial({
                depth: fish.depth, bottomDepth, turbidity: safeFrameChannels.waterTurbidity,
                submergedSunZ: safeFrameChannels.shadowLight.submergedSunZ,
            });
            if (fishShadowProfile.enabled === true && fishShadowProfile.cadence > 0) {
                const geometry = resolveZenPondShadowGeometry({
                    kind: 'koi', size: fish.baseSize,
                    sourceDepth: fish.depth, bottomDepth,
                });
                pondShadowProjection = projectZenPondSubmergedShadow({
                    light: safeFrameChannels.shadowLight,
                    heightAboveReceiver: geometry.heightAboveReceiver,
                    maxReach: fish.baseSize * 2.2,
                });
                pondShadowProjection.penumbra += waterMaterial.shadowSoftness;
            }
        }
        if (!isZenKoiShadowSentinel(fish) && firstSiteMaterialPresence < 1) {
            const natural = pondShadowProjection;
            pondShadowProjection = {
                offsetX: natural ? natural.offsetX * firstSiteMaterialPresence : 0,
                offsetY: natural ? natural.offsetY * firstSiteMaterialPresence : 0,
                penumbra: natural ? 1.8 + (natural.penumbra - 1.8) * firstSiteMaterialPresence : 1.8,
            };
        }

        const updateStartedMs = createdThisFrame ? nowMs() : null;
        const updateResult = pixiFish.update(
            fish,
            frameCount,
            domainSelected || localSelected,
            hovered,
            sharedFishLighting,
            {
                forceFullUpdate: createdThisFrame || !wasVisible,
                renderTimeMs,
                firstSiteMaterialPresence,
                rendererDebugToggles: rendererDebugTogglesRef?.current || rendererDebugToggles,
                sharedFishShadowLighting,
                pondShadowProjection,
                koiCausticReceiver,
                pondShadowLight: safeFrameChannels.shadowLight,
                waterMaterial,
            },
        );
        if (updateStartedMs !== null) {
            diagnostics.updateTotalMs += Math.max(0, nowMs() - updateStartedMs);
        }
        recordKoiRenderDiagnostics(diagnostics, updateResult, createdThisFrame);
        if (fish.entityKind === 'invitation' && fish.rosterTransit?.kind === 'entering') {
            diagnostics.invitationEnteringCount += 1;
        }
        if (updateResult?.visible === true
            && updateResult.effectiveOpacity > KOI_FIRST_FRAME_VISIBLE_ALPHA_THRESHOLD) {
            if (hovered) diagnostics.focusHoveredCount += 1;
            if (domainSelected || localSelected) diagnostics.focusSelectedCount += 1;
            if (pixiFish.glowSprite?.visible === true && pixiFish.glowSprite.alpha > 0.01) {
                diagnostics.focusGlowVisibleCount += 1;
            }
        }
    }

    for (const [uid, pixiFish] of pixiFishPool.entries()) {
        if (aliveFish.has(uid)) continue;
        pixiFish.destroy();
        pixiFishPool.delete(uid);
    }
    return finalizeKoiRenderDiagnostics(diagnostics, {
        fishShadowRequested: (
            fishShadowProfile?.enabled === true
            && Number(fishShadowProfile?.cadence) > 0
        ),
        textureCacheDiagnostics:
            koiTextureCache?.getDiagnostics?.() || null,
    });
};

export {
    resolveSharedFishLighting,
    resolvePixiKoiShadowLightingState,
    syncFish,
};
