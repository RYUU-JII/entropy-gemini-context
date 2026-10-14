import React, {
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    createRefinementAssetCache,
    REFINEMENT_ATLAS_RESOLUTIONS,
    REFINEMENT_CACHE_VERSION,
} from '@/themes/plugins/zen/model/sakura/lab/ZenSakuraRefinementAssetCache.js';
import {
    PROJECTED_BLOSSOM_ATLAS_OPENNESS,
    PROJECTED_BLOSSOM_ATLAS_VIEWS,
} from '@/themes/plugins/zen/model/sakura/lab/ZenSakuraProjectedBlossom.js';
import { createSakuraRetainedTerminalGraph } from '@/themes/plugins/zen/model/sakura/lab/ZenSakuraRetainedTerminalGraph.js';
import { createSakuraTerminalCompactionScheduler } from '@/themes/plugins/zen/model/sakura/lab/ZenSakuraTerminalCompactionScheduler.js';
import {
    SAKURA_TERMINAL_BRANCHING_DEFAULTS,
    SAKURA_TERMINAL_CLUSTER_COVERAGE_DEFAULT,
    SAKURA_TERMINAL_ORGAN_POSE_CONTRACT,
    drawSakuraTwigPedicelStudy,
    SAKURA_TERMINAL_SOCKET_FIXTURES,
} from '@/themes/plugins/zen/model/sakura/lab/ZenSakuraTwigPedicelStudy.js';

const PREVIEW_PIXEL_RATIO = 3;
const SINGLE_STAGE_SIZE = Object.freeze({ width: 388, height: 388 });
const BRANCH_STAGE_SIZE = Object.freeze({ width: 540, height: 388 });
const VIEW_LABELS = Object.freeze({
    front: 'Front',
    'three-quarter': '3/4',
    profile: 'Profile',
    back: 'Back',
});

const OPENNESS_LABELS = Object.freeze({
    half: 'Half',
    cupped: 'Cupped',
    open: 'Open',
});

function preparePreviewCanvas(canvas, logicalSize) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(
        canvas.width / logicalSize.width,
        0,
        0,
        canvas.height / logicalSize.height,
        0,
        0,
    );
    return ctx;
}

function createProjectedFlowerDescriptor(organ) {
    const pose = organ?.blossomPose;
    if (!pose || pose.contract !== SAKURA_TERMINAL_ORGAN_POSE_CONTRACT) {
        throw new Error('ZEN_SAKURA_LAB_FLOWER_POSE_INVALID');
    }
    return {
        projectionMode: 'projected',
        bloomStage: 'full',
        openness: organ.openness,
        facingYaw: pose.facingYaw,
        facingPitch: pose.facingPitch,
    };
}

export default function ZenSakuraVisualRefinementLab() {
    const [removeDotSpecks, setRemoveDotSpecks] = useState(true);
    const [assetResolution, setAssetResolution] = useState(96);
    const [structureOnly, setStructureOnly] = useState(false);
    const [fixtureId, setFixtureId] = useState('pad-interior');
    const [density, setDensity] = useState(1);
    const [forkFrequency, setForkFrequency] = useState(
        SAKURA_TERMINAL_BRANCHING_DEFAULTS.forkFrequency,
    );
    const [forkSpread, setForkSpread] = useState(
        SAKURA_TERMINAL_BRANCHING_DEFAULTS.forkSpread,
    );
    const [lateralVigor, setLateralVigor] = useState(
        SAKURA_TERMINAL_BRANCHING_DEFAULTS.lateralVigor,
    );
    const [interiorFill, setInteriorFill] = useState(0.65);
    const [clusterCoverage, setClusterCoverage] = useState(
        SAKURA_TERMINAL_CLUSTER_COVERAGE_DEFAULT,
    );
    const [growthProgress, setGrowthProgress] = useState(1);
    const [idleCompaction, setIdleCompaction] = useState(true);
    const [compactedEpoch, setCompactedEpoch] = useState(null);
    const [compactionError, setCompactionError] = useState(null);
    const [compactionDiagnostics, setCompactionDiagnostics] = useState(null);
    const [planUsage, setPlanUsage] = useState(null);

    const singleBlossomCanvasRef = useRef(null);
    const branchClusterCanvasRef = useRef(null);
    const assetCache = useMemo(() => createRefinementAssetCache({
        removeDotSpecks,
        assetSize: assetResolution,
    }), [assetResolution, removeDotSpecks]);
    const branching = useMemo(() => ({
        forkFrequency,
        forkSpread,
        lateralVigor,
    }), [forkFrequency, forkSpread, lateralVigor]);
    const retainedGraph = useMemo(() => createSakuraRetainedTerminalGraph({
        fixtureId,
        density,
        branching,
        interiorFill,
        clusterCoverage,
    }), [branching, clusterCoverage, density, fixtureId, interiorFill]);
    const compactionSignature = [
        retainedGraph.signature,
        `growth:${growthProgress.toFixed(3)}`,
        `atlas:${REFINEMENT_CACHE_VERSION}:${assetResolution}`,
        `speckles:${removeDotSpecks ? 'off' : 'on'}`,
    ].join('|');
    const compactionScheduler = useMemo(() => createSakuraTerminalCompactionScheduler({
        yieldControl: () => new Promise((resolve) => {
            window.requestAnimationFrame(() => resolve());
        }),
        bakeJob: async (job) => {
            const canvas = document.createElement('canvas');
            canvas.width = job.payload.width;
            canvas.height = job.payload.height;
            const ctx = canvas.getContext('2d', { alpha: true });
            if (!ctx) {
                throw new Error('ZEN_SAKURA_LAB_COMPACTION_CONTEXT_UNAVAILABLE');
            }
            job.payload.paint(ctx);
            return Object.freeze({
                id: job.id,
                signature: job.signature,
                canvas,
                pixels: canvas.width * canvas.height,
            });
        },
        discardOutput: (output) => {
            if (output?.canvas) {
                output.canvas.width = 0;
                output.canvas.height = 0;
            }
        },
    }), []);

    useEffect(() => {
        if (!idleCompaction || structureOnly) return undefined;
        let cancelled = false;
        const timer = window.setTimeout(async () => {
            const resolveFlowerSprite = (organ) => assetCache.resolveFlowerSprite({
                color: '#FFCDD2',
                blossom: createProjectedFlowerDescriptor(organ),
            });
            const leafSprite = assetCache.resolveLeafSprite('#6B7D52');
            const result = await compactionScheduler.requestEpoch({
                signature: compactionSignature,
                generation: retainedGraph.signature,
                jobs: [{
                    id: retainedGraph.socket.terminalId,
                    signature: compactionSignature,
                    payload: {
                        width: BRANCH_STAGE_SIZE.width,
                        height: BRANCH_STAGE_SIZE.height,
                        paint: (ctx) => drawSakuraTwigPedicelStudy({
                            ctx,
                            width: BRANCH_STAGE_SIZE.width,
                            height: BRANCH_STAGE_SIZE.height,
                            resolveFlowerSprite,
                            leafSprite,
                            spriteDisplaySize: assetCache.logicalAssetSize * 4,
                            retainedGraph,
                            growthProgress,
                            structureOnly: false,
                        }),
                    },
                }],
            });
            if (cancelled) return;
            setCompactionDiagnostics(compactionScheduler.readDiagnostics());
            if (result.status === 'failed') {
                setCompactionError(result.error?.message || 'ZEN_SAKURA_LAB_COMPACTION_FAILED');
                return;
            }
            if (result.status === 'committed' || result.status === 'deduped') {
                setCompactionError(null);
                setCompactedEpoch(result);
            }
        }, 520);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [
        assetCache,
        compactionScheduler,
        compactionSignature,
        growthProgress,
        idleCompaction,
        retainedGraph,
        structureOnly,
    ]);

    useEffect(() => {
        // 1. Draw Single Zoomed Blossom
        const singleCanvas = singleBlossomCanvasRef.current;
        if (singleCanvas) {
            const ctx = preparePreviewCanvas(singleCanvas, SINGLE_STAGE_SIZE);
            const w = SINGLE_STAGE_SIZE.width;
            const h = SINGLE_STAGE_SIZE.height;
            if (!ctx) return;

            // Subtle Japanese paper background
            const bg = ctx.createLinearGradient(0, 0, w, h);
            bg.addColorStop(0, '#F9F6F0');
            bg.addColorStop(1, '#EFE8DC');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);

            ctx.fillStyle = '#796D66';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            PROJECTED_BLOSSOM_ATLAS_VIEWS.forEach((sample, columnIndex) => {
                ctx.fillText(VIEW_LABELS[sample.id], 64 + (columnIndex * 87), 22);
            });
            PROJECTED_BLOSSOM_ATLAS_OPENNESS.forEach((openSample, rowIndex) => {
                ctx.save();
                ctx.translate(13, 82 + (rowIndex * 103));
                ctx.rotate(-Math.PI / 2);
                ctx.fillText(OPENNESS_LABELS[openSample.id], 0, 0);
                ctx.restore();
                PROJECTED_BLOSSOM_ATLAS_VIEWS.forEach((yawSample, columnIndex) => {
                    const sprite = assetCache.resolveFlowerSprite({
                        color: '#FFCDD2',
                        blossom: {
                            projectionMode: 'projected',
                            openness: openSample.value,
                            facingYaw: yawSample.yaw,
                            facingPitch: 0,
                        },
                    });
                    const centerX = 64 + (columnIndex * 87);
                    const centerY = 80 + (rowIndex * 103);
                    const drawSize = 126;
                    ctx.drawImage(
                        sprite,
                        centerX - (drawSize / 2),
                        centerY - (drawSize / 2),
                        drawSize,
                        drawSize,
                    );
                });
            });
        }

        // 2. Draw reference-informed twig, spur, pedicel, and blossom attachments
        const branchCanvas = branchClusterCanvasRef.current;
        if (branchCanvas) {
            const ctx = preparePreviewCanvas(branchCanvas, BRANCH_STAGE_SIZE);
            const w = BRANCH_STAGE_SIZE.width;
            const h = BRANCH_STAGE_SIZE.height;
            if (!ctx) return;

            // Soft background
            const bg = ctx.createLinearGradient(0, 0, w, h);
            bg.addColorStop(0, '#1E242B');
            bg.addColorStop(1, '#14181F');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, w, h);

            const resolveFlowerSprite = (organ) => assetCache.resolveFlowerSprite({
                color: '#FFCDD2',
                blossom: createProjectedFlowerDescriptor(organ),
            });
            const leafSprite = assetCache.resolveLeafSprite('#6B7D52');
            const spriteDisplaySize = assetCache.logicalAssetSize * 4;

            const drawStudy = (targetContext, diagnosticMode) => drawSakuraTwigPedicelStudy({
                ctx: targetContext,
                width: w,
                height: h,
                resolveFlowerSprite,
                leafSprite,
                spriteDisplaySize,
                retainedGraph,
                growthProgress,
                structureOnly: diagnosticMode,
            });
            const compactedOutput = idleCompaction
                && compactedEpoch?.signature === compactionSignature
                ? compactedEpoch.outputs[0]
                : null;
            const plan = retainedGraph;
            if (!structureOnly && compactedOutput?.canvas) {
                ctx.drawImage(compactedOutput.canvas, 0, 0, w, h);
            } else {
                drawStudy(ctx, structureOnly);
            }
            const diagnostics = assetCache.readDiagnostics();
            setPlanUsage({
                terminalId: plan.socket.terminalId,
                description: plan.socket.description,
                usage: plan.usage,
                budget: plan.socket.budget,
                clusterZoneUsage: plan.clusterZoneUsage,
                clusterTemplateUsage: plan.clusterTemplateUsage,
                attachmentUsage: plan.attachmentUsage,
                diagnostics,
                retainedDiagnostics: plan.diagnostics,
                renderMode: compactedOutput ? 'compacted' : 'retained',
            });
        }
    }, [
        assetCache,
        compactedEpoch,
        compactionSignature,
        growthProgress,
        idleCompaction,
        retainedGraph,
        structureOnly,
    ]);

    return (
        <div style={{
            padding: '24px',
            backgroundColor: '#0F1216',
            color: '#E1E7ED',
            minHeight: '100vh',
            fontFamily: 'sans-serif',
        }}>
            <div style={{ marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#F3F6F8', marginBottom: '8px' }}>
                    🌸 벚꽃 말단 가지·spur·클러스터 연구소
                </h2>
                <p style={{ fontSize: '13px', color: '#9AA7B3', lineHeight: '1.5' }}>
                    골격 생성기와 분리된 TerminalSocket fixture에서 분화, 선택적 개화,
                    pedicel과 꽃 자세, retained growth를 독립적으로 점검합니다.
                </p>
            </div>

            {/* Controls Bar */}
            <div style={{
                display: 'flex',
                gap: '24px',
                alignItems: 'center',
                backgroundColor: '#181D24',
                padding: '16px 20px',
                borderRadius: '8px',
                border: '1px solid #28313D',
                marginBottom: '24px',
                flexWrap: 'wrap',
            }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                        type="checkbox"
                        checked={removeDotSpecks}
                        onChange={(e) => setRemoveDotSpecks(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: '#E8A0BF' }}
                    />
                    <span style={{ fontWeight: '500', color: removeDotSpecks ? '#FFD6E8' : '#A0ABB6' }}>
                        끝단 점 하이라이트 제거 (Speckle Filter) {removeDotSpecks ? '✅ [ON]' : '❌ [OFF - 기존 점 찍힘]'}
                    </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <span>Terminal socket:</span>
                    <select
                        value={fixtureId}
                        onChange={(event) => setFixtureId(event.target.value)}
                        style={{
                            color: '#E1E7ED',
                            background: '#10151B',
                            border: '1px solid #34404D',
                            borderRadius: '5px',
                            padding: '5px 8px',
                        }}
                    >
                        {SAKURA_TERMINAL_SOCKET_FIXTURES.map((fixture) => (
                            <option key={fixture.id} value={fixture.id}>
                                {fixture.label}
                            </option>
                        ))}
                    </select>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                    <span>Budget 사용률:</span>
                    <input
                        type="range"
                        min="0.35"
                        max="1"
                        step="0.05"
                        value={density}
                        onChange={(event) => setDensity(parseFloat(event.target.value))}
                        style={{ width: '100px', accentColor: '#74C9A5' }}
                    />
                    <span>{Math.round(density * 100)}%</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                    <span>분기 발생률:</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={forkFrequency}
                        onChange={(event) => setForkFrequency(parseFloat(event.target.value))}
                        style={{ width: '100px', accentColor: '#D9AE72' }}
                    />
                    <span>{forkFrequency.toFixed(2)}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                    <span>Y 벌어짐:</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={forkSpread}
                        onChange={(event) => setForkSpread(parseFloat(event.target.value))}
                        style={{ width: '100px', accentColor: '#E4C383' }}
                    />
                    <span>{forkSpread.toFixed(2)}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                    <span>측지 활력:</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={lateralVigor}
                        onChange={(event) => setLateralVigor(parseFloat(event.target.value))}
                        style={{ width: '100px', accentColor: '#C99663' }}
                    />
                    <span>{lateralVigor.toFixed(2)}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                    <span>내부 채움:</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={interiorFill}
                        onChange={(event) => setInteriorFill(parseFloat(event.target.value))}
                        style={{ width: '100px', accentColor: '#A78BD4' }}
                    />
                    <span>{interiorFill.toFixed(2)}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                    <span>클러스터 개화율:</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={clusterCoverage}
                        onChange={(event) => setClusterCoverage(parseFloat(event.target.value))}
                        style={{ width: '100px', accentColor: '#E8A0BF' }}
                    />
                    <span>{clusterCoverage.toFixed(2)}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                    <span>Retained 성장:</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={growthProgress}
                        onChange={(event) => setGrowthProgress(Number(event.target.value))}
                        style={{ width: '140px', accentColor: '#E8A0BF' }}
                    />
                    <span>{Math.round(growthProgress * 100)}%</span>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                        type="checkbox"
                        checked={structureOnly}
                        onChange={(e) => setStructureOnly(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: '#74C9A5' }}
                    />
                    <span style={{ fontWeight: '500', color: structureOnly ? '#9DE8C8' : '#A0ABB6' }}>
                        Twig/꽃대 구조 진단 {structureOnly ? '✅ [STRUCTURE]' : '🌸 [PAINT]'}
                    </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                    <input
                        type="checkbox"
                        checked={idleCompaction}
                        onChange={(event) => setIdleCompaction(event.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: '#74C9A5' }}
                    />
                    <span style={{ color: idleCompaction ? '#9DE8C8' : '#A0ABB6' }}>
                        입력 정지 후 선택적 compaction
                    </span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                    <span>꽃 Atlas:</span>
                    <select
                        value={assetResolution}
                        onChange={(event) => setAssetResolution(Number(event.target.value))}
                        style={{
                            color: '#E1E7ED',
                            background: '#10151B',
                            border: '1px solid #34404D',
                            borderRadius: '5px',
                            padding: '5px 8px',
                        }}
                    >
                        {REFINEMENT_ATLAS_RESOLUTIONS.map((resolution) => (
                            <option key={resolution} value={resolution}>{resolution}px</option>
                        ))}
                    </select>
                </label>
            </div>

            {/* Canvases Side by Side */}
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Single Zoomed Blossom Canvas */}
                <div style={{
                    backgroundColor: '#181D24',
                    border: '1px solid #28313D',
                    borderRadius: '8px',
                    padding: '16px',
                    width: '422px',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    flex: '0 1 422px',
                }}>
                    <h3 style={{ fontSize: '14px', color: '#D2DBE2', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>🔍 1. 각도 × 개화도 투사 Atlas</span>
                        <span style={{ color: '#E8A0BF', fontSize: '12px' }}>고정 12종 · {assetResolution}px</span>
                    </h3>
                    <canvas
                        ref={singleBlossomCanvasRef}
                        width={SINGLE_STAGE_SIZE.width * PREVIEW_PIXEL_RATIO}
                        height={SINGLE_STAGE_SIZE.height * PREVIEW_PIXEL_RATIO}
                        style={{
                            width: '100%',
                            height: 'auto',
                            aspectRatio: `${SINGLE_STAGE_SIZE.width} / ${SINGLE_STAGE_SIZE.height}`,
                            boxSizing: 'border-box',
                            borderRadius: '6px',
                            border: '1px solid #333F4E',
                            display: 'block',
                        }}
                    />
                    <div style={{ fontSize: '12px', color: '#8896A4', marginTop: '10px', lineHeight: '1.4' }}>
                        연속 각도를 정면·3/4·측면·후면으로 압축하고 좌우는 반전 재사용합니다. 개화도 3단계를 합쳐 실제 texture는 정확히 12종입니다.
                    </div>
                </div>

                {/* Branch & Cluster Canvas */}
                <div style={{
                    backgroundColor: '#181D24',
                    border: '1px solid #28313D',
                    borderRadius: '8px',
                    padding: '16px',
                    width: '574px',
                    maxWidth: '100%',
                    boxSizing: 'border-box',
                    flex: '0 1 574px',
                    minWidth: '0',
                }}>
                    <h3 style={{ fontSize: '14px', color: '#D2DBE2', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                        <span>🌿 2. Mature Graph → Retained Growth Projection</span>
                        <span style={{ color: '#82E0AA', fontSize: '12px' }}>
                            {structureOnly ? 'Attachment Diagnostic' : 'Reference-Informed Paint'}
                        </span>
                    </h3>
                    <canvas
                        ref={branchClusterCanvasRef}
                        width={BRANCH_STAGE_SIZE.width * PREVIEW_PIXEL_RATIO}
                        height={BRANCH_STAGE_SIZE.height * PREVIEW_PIXEL_RATIO}
                        style={{
                            width: '100%',
                            height: 'auto',
                            aspectRatio: `${BRANCH_STAGE_SIZE.width} / ${BRANCH_STAGE_SIZE.height}`,
                            boxSizing: 'border-box',
                            borderRadius: '6px',
                            border: '1px solid #333F4E',
                            display: 'block',
                        }}
                    />
                    <div style={{ fontSize: '12px', color: '#8896A4', marginTop: '10px', lineHeight: '1.4' }}>
                        {planUsage
                            ? `${planUsage.description} · twig ${planUsage.usage.twig}/${planUsage.budget.twig}, spur ${planUsage.usage.spur}/${planUsage.budget.spur}, cluster ${planUsage.usage.cluster}/${planUsage.budget.cluster}`
                            : 'Terminal socket fixture를 준비하고 있습니다.'}
                        {planUsage?.clusterZoneUsage ? (
                            <>
                                {' '}
                                · 내부 {planUsage.clusterZoneUsage.inner}
                                {' / '}중간 {planUsage.clusterZoneUsage.middle}
                                {' / '}외곽 {planUsage.clusterZoneUsage.edge}
                            </>
                        ) : null}
                        {planUsage?.attachmentUsage ? (
                            <>
                                {' '}
                                · 말단 개화 {planUsage.attachmentUsage.tipClusterCount}
                                /{planUsage.attachmentUsage.terminalAxisCount}
                                {' · '}영양 말단 {planUsage.attachmentUsage.vegetativeTipCount}
                                {' · '}Y 중앙 {planUsage.attachmentUsage.forkBloomCount}
                                {' · '}개화 spur {planUsage.attachmentUsage.floweringSpurCount}
                                {' · '}영양 spur {planUsage.attachmentUsage.vegetativeSpurCount}
                            </>
                        ) : null}
                        {planUsage?.clusterTemplateUsage ? (
                            <>
                                <br />
                                템플릿 {Object.keys(planUsage.clusterTemplateUsage).length}/8종
                                {' · '}Atlas {planUsage.diagnostics.atlasEntries}/12
                                {' · '}raw {(planUsage.diagnostics.atlasRawBytes / 1048576).toFixed(2)} MiB
                                {' · '}stable organ {planUsage.retainedDiagnostics.stableOrganIds}
                                {' · '}표시 {planUsage.renderMode}
                            </>
                        ) : null}
                        {compactionDiagnostics ? (
                            <>
                                <br />
                                compaction 요청 {compactionDiagnostics.requested}
                                {' · '}완료 {compactionDiagnostics.committed}
                                {' · '}중복 {compactionDiagnostics.deduped}
                                {' · '}대체 {compactionDiagnostics.superseded}
                                {' · '}stale 폐기 {compactionDiagnostics.staleDiscarded}
                            </>
                        ) : null}
                        {compactionError ? (
                            <>
                                <br />
                                <span style={{ color: '#F1948A' }}>{compactionError}</span>
                            </>
                        ) : null}
                        <br />
                        성장 슬라이더는 mature graph와 texture를 다시 만들지 않고 stable entity의 reveal만 투영합니다.
                    </div>
                </div>
            </div>
        </div>
    );
}
