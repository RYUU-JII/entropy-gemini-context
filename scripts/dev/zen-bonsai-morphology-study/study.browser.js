import { CANONICAL_LEARNING_STAGE } from '../../../src/themes/plugins/zen/model/ZenCoreConfig.js';
import { SakuraSpecies } from '../../../src/themes/plugins/zen/model/SakuraSpecies.js';
import {
    BonsaiStructuralCandidateEvaluator,
} from '../../../src/themes/plugins/zen/model/bonsai/evaluation/BonsaiStructuralCandidateEvaluator.js';
import {
    BranchGeometryModel,
} from '../../../src/themes/plugins/zen/model/bonsai/geometry/branchGeometryModel.js';
import {
    SAKURA_BRANCH_ORDER,
} from '../../../src/themes/plugins/zen/model/bonsai/generation/shapePriorModel.js';
import {
    measureBonsaiStructuralComparisonSceneBoundsV1,
    resolveBonsaiStructuralScreenDistanceV1,
} from '../../../src/themes/plugins/zen/model/bonsai/rendering/BonsaiStructuralComparisonPlan.js';
import {
    renderBonsaiStructuralPreview,
} from '../../../src/themes/plugins/zen/model/bonsai/rendering/renderBonsaiStructuralPreview.js';
import {
    resolveBonsaiCamera,
} from '../../../src/themes/plugins/zen/model/bonsai/rendering/resolveBonsaiCamera.js';
import {
    createSakuraMacroSpineGuideV1,
} from '../../../src/themes/plugins/zen/model/sakura/sakuraMacroSpineGuide.js';
import {
    createSakuraSpineReferenceFamilyV1,
} from '../../../src/themes/plugins/zen/model/sakura/sakuraSpineReferenceFamily.js';
import {
    compileSakuraPhenotypeFromLatent,
} from '../../../src/themes/plugins/zen/model/v2/SakuraCompiler.js';
import {
    getDefaultSakuraLatent,
} from '../../../src/themes/plugins/zen/model/v2/SakuraLatentSchema.js';

const STUDY_GLOBAL = '__ENTROPY_ZEN_BONSAI_MORPHOLOGY_STUDY__';
const STUDY_VERSION = 1;
const STRUCTURE_DEPTH = 6;
const TOPOLOGY_REFERENCE_HEIGHT = 360;
const CANVAS_CSS_SIZE = Object.freeze({ width: 320, height: 360 });
const TRUNK_SAMPLE_INTERVALS_PER_SPAN = 12;
const TRUNK_PROFILE_INTERVALS = 64;
const EPSILON = 1e-8;

const round = (value, digits = 4) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Number(numeric.toFixed(digits)) : 0;
};

const normalizeAngle = (value) => Math.atan2(Math.sin(value), Math.cos(value));

const distance = (left, right) => Math.hypot(
    Number(right?.x) - Number(left?.x),
    Number(right?.y) - Number(left?.y),
);

const requireStudyCase = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_STUDY_CASE_REQUIRED');
    }
    if (typeof value.id !== 'string' || !value.id.trim()) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_STUDY_CASE_ID_REQUIRED');
    }
    if (!Number.isSafeInteger(value.seed)) {
        throw new Error(`ZEN_BONSAI_MORPHOLOGY_STUDY_CASE_SEED_INVALID:${value.id}`);
    }
    return value;
};

const resolveGenerationOptions = (studyCase) => {
    const generation = studyCase.generation;
    if (!generation || generation.kind === 'procedural') {
        return studyCase.form
            ? {
                formId: studyCase.form.id,
                formVariantSeed: studyCase.form.variantSeed,
            }
            : {};
    }
    const guide = createSakuraMacroSpineGuideV1({
        anchors: generation.anchors,
        adherence: generation.adherence,
        source: 'authored',
    });
    const condition = generation.kind === 'reference_family'
        ? {
            spineReferenceFamily: createSakuraSpineReferenceFamilyV1({
                referenceGuide: guide,
                likeness: generation.likeness,
            }),
        }
        : { spineGuide: guide };
    return {
        ...condition,
        ...(studyCase.form ? {
            formId: studyCase.form.id,
            formVariantSeed: studyCase.form.variantSeed,
        } : {}),
    };
};

const evaluator = new BonsaiStructuralCandidateEvaluator({
    treeType: 'sakura',
    species: SakuraSpecies,
    stageProfiles: [{
        id: 'stage_bloom',
        stage: {
            ...CANONICAL_LEARNING_STAGE,
            depth: STRUCTURE_DEPTH,
        },
    }],
    topologyHeight: TOPOLOGY_REFERENCE_HEIGHT,
});

const evaluateStudyCase = (rawCase) => {
    const studyCase = requireStudyCase(rawCase);
    const latent = {
        ...getDefaultSakuraLatent(),
        ...(studyCase.latentOverrides || {}),
    };
    const phenotype = compileSakuraPhenotypeFromLatent(latent);
    const candidate = evaluator.evaluate({
        seed: studyCase.seed,
        phenotype,
        modelInput: { latent },
        generationOptions: resolveGenerationOptions(studyCase),
    });
    const sceneBounds = measureBonsaiStructuralComparisonSceneBoundsV1({
        topology: candidate.topology,
        species: SakuraSpecies,
        strictStructural: true,
    });
    return {
        studyCase,
        latent,
        phenotype,
        candidate,
        sceneBounds,
    };
};

const collectTrunkPolyline = (topology) => {
    const points = [];
    const spanWidths = [];
    let node = topology;
    let startX = 0;
    let startY = 0;
    let angle = Number.isFinite(Number(topology?.initialAngle))
        ? Number(topology.initialAngle)
        : -Math.PI / 2;
    let spanIndex = 0;
    while (node && Number(node.branchOrder) === SAKURA_BRANCH_ORDER.TRUNK) {
        const geometry = BranchGeometryModel.createSegment({
            startX,
            startY,
            angle,
            length: Number(node.length),
            curve: Number(node.curve) || 0,
            curveIn: node.curveIn,
            curveOut: node.curveOut,
            exactCubicControl: node.exactCubicControl,
        });
        for (let sampleIndex = spanIndex === 0 ? 0 : 1;
            sampleIndex <= TRUNK_SAMPLE_INTERVALS_PER_SPAN;
            sampleIndex += 1) {
            const point = BranchGeometryModel.pointAt(
                geometry,
                sampleIndex / TRUNK_SAMPLE_INTERVALS_PER_SPAN,
            );
            points.push({ x: point.x, y: point.y });
            spanWidths.push(Number(node.width));
        }
        const child = (Array.isArray(node.branches) ? node.branches : []).find((entry) => (
            entry?.obj
            && Number(entry.obj.branchOrder) === SAKURA_BRANCH_ORDER.TRUNK
        ));
        if (!child) break;
        const attachT = Number.isFinite(Number(child.t))
            ? Math.min(1, Math.max(0, Number(child.t)))
            : 1;
        const attachment = BranchGeometryModel.pointAndAngleAt(geometry, attachT);
        startX = attachment.x;
        startY = attachment.y;
        angle = attachment.angle + (Number(child.angleOffset) || 0);
        node = child.obj;
        spanIndex += 1;
    }
    return { points, spanWidths, spanCount: spanIndex + 1 };
};

const resamplePolyline = ({ points, spanWidths }) => {
    if (points.length < 2) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_STUDY_TRUNK_POLYLINE_REQUIRED');
    }
    const lookup = [{ arc: 0, point: points[0], width: spanWidths[0] }];
    let totalArc = 0;
    for (let index = 1; index < points.length; index += 1) {
        totalArc += distance(points[index - 1], points[index]);
        lookup.push({
            arc: totalArc,
            point: points[index],
            width: spanWidths[index],
        });
    }
    if (totalArc <= EPSILON) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_STUDY_TRUNK_ARC_INVALID');
    }
    let cursor = 1;
    const samples = Array.from(
        { length: TRUNK_PROFILE_INTERVALS + 1 },
        (_, sampleIndex) => {
            const targetArc = totalArc * (sampleIndex / TRUNK_PROFILE_INTERVALS);
            while (cursor < lookup.length - 1 && lookup[cursor].arc < targetArc) {
                cursor += 1;
            }
            const right = lookup[cursor];
            const left = lookup[Math.max(0, cursor - 1)];
            const ratio = Math.min(
                1,
                Math.max(
                    0,
                    (targetArc - left.arc) / Math.max(EPSILON, right.arc - left.arc),
                ),
            );
            return {
                x: left.point.x + ((right.point.x - left.point.x) * ratio),
                y: left.point.y + ((right.point.y - left.point.y) * ratio),
                width: left.width + ((right.width - left.width) * ratio),
            };
        },
    );
    return { samples, totalArc };
};

const resolveTrunkDiagnostic = (topology) => {
    const raw = collectTrunkPolyline(topology);
    const { samples, totalArc } = resamplePolyline(raw);
    const headings = [];
    for (let index = 1; index < samples.length; index += 1) {
        headings.push(Math.atan2(
            samples[index].y - samples[index - 1].y,
            samples[index].x - samples[index - 1].x,
        ));
    }
    const turns = headings.slice(1).map((heading, index) => normalizeAngle(
        heading - headings[index],
    ));
    const absoluteTurns = turns.map((turn) => Math.abs(turn));
    const absoluteTurn = absoluteTurns.reduce((sum, value) => sum + value, 0);
    const turnThreshold = (1.5 * Math.PI) / 180;
    let longestStraightRun = 0;
    let currentStraightRun = 0;
    turns.forEach((turn) => {
        if (Math.abs(turn) <= turnThreshold) {
            currentStraightRun += 1;
            longestStraightRun = Math.max(longestStraightRun, currentStraightRun);
        } else {
            currentStraightRun = 0;
        }
    });
    const jerk = turns.slice(1).map((turn, index) => Math.abs(turn - turns[index]));
    let inflectionCount = 0;
    let previousSign = 0;
    turns.forEach((turn) => {
        if (Math.abs(turn) <= turnThreshold) return;
        const sign = Math.sign(turn);
        if (previousSign && sign !== previousSign) inflectionCount += 1;
        previousSign = sign;
    });
    const baseWidth = samples[0].width;
    const width80 = samples[Math.round(TRUNK_PROFILE_INTERVALS * 0.8)].width;
    const penultimateWidth = samples[Math.max(0, samples.length - 2)].width;
    const tipWidth = samples.at(-1).width;
    return Object.freeze({
        spanCount: raw.spanCount,
        totalArc: round(totalArc, 3),
        pathToChordRatio: round(
            totalArc / Math.max(EPSILON, distance(samples[0], samples.at(-1))),
            5,
        ),
        absoluteTurnDeg: round(absoluteTurn * (180 / Math.PI), 3),
        maxLocalTurnDeg: round(
            Math.max(0, ...absoluteTurns) * (180 / Math.PI),
            3,
        ),
        curvatureConcentration: round(
            absoluteTurn > EPSILON ? Math.max(0, ...absoluteTurns) / absoluteTurn : 0,
            5,
        ),
        longestStraightRunRatio: round(
            longestStraightRun / Math.max(1, turns.length),
            5,
        ),
        meanJerkDeg: round(
            (jerk.reduce((sum, value) => sum + value, 0) / Math.max(1, jerk.length))
                * (180 / Math.PI),
            3,
        ),
        inflectionCount,
        tipWidthToBase: round(tipWidth / Math.max(EPSILON, baseWidth), 5),
        width80ToBase: round(width80 / Math.max(EPSILON, baseWidth), 5),
        finalWidthStepRetention: round(
            tipWidth / Math.max(EPSILON, penultimateWidth),
            5,
        ),
    });
};

const resizeCanvas = (canvas) => {
    const deviceScaleFactor = Math.max(1, Number(window.devicePixelRatio) || 1);
    const pixelWidth = Math.round(CANVAS_CSS_SIZE.width * deviceScaleFactor);
    const pixelHeight = Math.round(CANVAS_CSS_SIZE.height * deviceScaleFactor);
    canvas.style.width = `${CANVAS_CSS_SIZE.width}px`;
    canvas.style.height = `${CANVAS_CSS_SIZE.height}px`;
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    return { deviceScaleFactor, pixelWidth, pixelHeight };
};

const renderEvaluatedCase = ({ evaluated, canvas, sharedScale }) => {
    const canvasMetrics = resizeCanvas(canvas);
    const camera = resolveBonsaiCamera({
        viewportWidth: canvasMetrics.pixelWidth,
        viewportHeight: canvasMetrics.pixelHeight,
        sceneBounds: evaluated.sceneBounds,
        preset: 'ab',
        scaleCap: sharedScale,
    });
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_STUDY_CONTEXT_REQUIRED');
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const preview = renderBonsaiStructuralPreview({
        ctx,
        topology: evaluated.candidate.topology,
        camera,
        sceneBounds: evaluated.sceneBounds,
        strictStructural: true,
        options: {
            hidePot: false,
            showBranchTierDebug: true,
        },
    });
    return {
        camera,
        canvasMetrics,
        preview,
    };
};

const fitScale = (evaluated, canvasMetrics) => resolveBonsaiCamera({
    viewportWidth: canvasMetrics.pixelWidth,
    viewportHeight: canvasMetrics.pixelHeight,
    sceneBounds: evaluated.sceneBounds,
    preset: 'ab',
}).scale;

const summarizeCandidate = (evaluated, rendered) => {
    const structuralMorphology = evaluated.candidate.analysis.structuralMorphology;
    const descriptor = structuralMorphology.descriptor;
    const classification = structuralMorphology.classification;
    return Object.freeze({
        caseId: evaluated.studyCase.id,
        title: evaluated.studyCase.title,
        seed: evaluated.studyCase.seed,
        topologySeed: evaluated.candidate.render.topologySeed,
        generation: evaluated.studyCase.generation,
        formInput: evaluated.studyCase.form,
        formProvenance: evaluated.candidate.render.formComposition || null,
        spineGuideConditionId:
            evaluated.candidate.render.spineGuideConditionId || null,
        spineReferenceFamilyConditionId:
            evaluated.candidate.render.spineReferenceFamilyConditionId || null,
        spineReferenceVariantGuideId:
            evaluated.candidate.render.spineReferenceVariantGuideId || null,
        topologyProvenance: {
            trunkPlannerId:
                evaluated.candidate.topology.trunkDepthModel?.trunkPlannerId || null,
            trunkMorphologyIntentPlannerId:
                evaluated.candidate.topology.trunkDepthModel
                    ?.trunkMorphologyIntentPlannerId || null,
            trunkAdaptivePolicyId:
                evaluated.candidate.topology.trunkDepthModel
                    ?.trunkAdaptivePolicyId || null,
            trunkAdaptiveSpanCount:
                evaluated.candidate.topology.trunkDepthModel
                    ?.trunkAdaptiveSpanCount || 0,
            scaffoldStationCount:
                evaluated.candidate.topology.trunkDepthModel
                    ?.trunkScaffoldStationCount || 0,
        },
        render: {
            evaluationProfile: evaluated.candidate.render.evaluationProfile,
            generationDetail: evaluated.candidate.render.generationDetail,
            renderer: rendered.preview.profile,
            viewportCss: CANVAS_CSS_SIZE,
            deviceScaleFactor: rendered.canvasMetrics.deviceScaleFactor,
            cameraScaleCss:
                round(rendered.camera.scale / rendered.canvasMetrics.deviceScaleFactor, 6),
        },
        descriptor,
        classification,
        trunkDiagnostic: resolveTrunkDiagnostic(evaluated.candidate.topology),
        structuralComparisonPlan: evaluated.candidate.structuralComparisonPlan,
    });
};

const formatMetric = (observation) => {
    const trunk = observation.trunkDiagnostic;
    const form = observation.classification.primaryFormId || 'unclassified';
    return [
        `${form} · ${round(observation.classification.primaryScore, 2)}`,
        `arc/chord ${trunk.pathToChordRatio}`,
        `turn ${trunk.absoluteTurnDeg}° · max ${trunk.maxLocalTurnDeg}°`,
        `straight ${round(trunk.longestStraightRunRatio * 100, 1)}%`,
        `tip/base ${trunk.tipWidthToBase}`,
    ].join(' · ');
};

const appendGalleryPair = ({ pairId, leftCanvas, rightCanvas, left, right, distanceResult }) => {
    const template = document.querySelector('#study-pair-template');
    if (!(template instanceof HTMLTemplateElement)) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_STUDY_TEMPLATE_REQUIRED');
    }
    const fragment = template.content.cloneNode(true);
    const article = fragment.querySelector('[data-study-pair]');
    article.dataset.studyPair = pairId;
    article.querySelector('[data-study-pair-title]').textContent = pairId;
    article.querySelector('[data-study-pair-distance]').textContent = (
        `visible ${distanceResult.visibleDistancePx}px · `
        + `${distanceResult.passed ? 'PASS' : 'TOO SIMILAR'} `
        + `(min ${distanceResult.minimumVisibleDistancePx}px)`
    );
    [
        { side: 'left', sourceCanvas: leftCanvas, observation: left },
        { side: 'right', sourceCanvas: rightCanvas, observation: right },
    ].forEach(({ side, sourceCanvas, observation }) => {
        const caseCard = article.querySelector(`[data-study-side="${side}"]`);
        caseCard.dataset.studyCaseId = observation.caseId;
        caseCard.querySelector('[data-study-case-title]').textContent = (
            `${observation.title} · seed ${observation.seed}`
        );
        caseCard.querySelector('[data-study-case-metrics]').textContent = (
            formatMetric(observation)
        );
        const canvas = caseCard.querySelector('canvas');
        canvas.width = sourceCanvas.width;
        canvas.height = sourceCanvas.height;
        canvas.style.width = sourceCanvas.style.width;
        canvas.style.height = sourceCanvas.style.height;
        canvas.getContext('2d').drawImage(sourceCanvas, 0, 0);
    });
    document.querySelector('#study-gallery').append(article);
};

const state = {
    version: STUDY_VERSION,
    status: 'ready',
    observations: [],
    comparisons: [],
    feedbackDrafts: [],
};

const renderPair = (rawPair) => {
    if (!rawPair || typeof rawPair !== 'object' || Array.isArray(rawPair)) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_STUDY_PAIR_REQUIRED');
    }
    if (typeof rawPair.id !== 'string' || !rawPair.id.trim()) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_STUDY_PAIR_ID_REQUIRED');
    }
    state.status = 'rendering';
    const leftEvaluated = evaluateStudyCase(rawPair.left);
    const rightEvaluated = evaluateStudyCase(rawPair.right);
    const leftCanvas = document.querySelector('#study-left-canvas');
    const rightCanvas = document.querySelector('#study-right-canvas');
    const leftMetrics = resizeCanvas(leftCanvas);
    const rightMetrics = resizeCanvas(rightCanvas);
    const sharedScale = Math.min(
        fitScale(leftEvaluated, leftMetrics),
        fitScale(rightEvaluated, rightMetrics),
    );
    const leftRendered = renderEvaluatedCase({
        evaluated: leftEvaluated,
        canvas: leftCanvas,
        sharedScale,
    });
    const rightRendered = renderEvaluatedCase({
        evaluated: rightEvaluated,
        canvas: rightCanvas,
        sharedScale,
    });
    const left = summarizeCandidate(leftEvaluated, leftRendered);
    const right = summarizeCandidate(rightEvaluated, rightRendered);
    const distanceResult = resolveBonsaiStructuralScreenDistanceV1(
        left.structuralComparisonPlan,
        right.structuralComparisonPlan,
    );
    const comparison = Object.freeze({
        pairId: rawPair.id,
        leftCaseId: left.caseId,
        rightCaseId: right.caseId,
        distance: distanceResult,
    });
    state.observations.push(left, right);
    state.comparisons.push(comparison);
    appendGalleryPair({
        pairId: rawPair.id,
        leftCanvas,
        rightCanvas,
        left,
        right,
        distanceResult,
    });
    state.status = 'ready';
    return { left, right, comparison };
};

const recordFeedback = (feedback) => {
    if (!feedback || typeof feedback !== 'object' || Array.isArray(feedback)) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_STUDY_FEEDBACK_REQUIRED');
    }
    if (
        feedback.backend !== 'classic2_structural_scout'
        || feedback.renderer !== 'structural_line_preview_v1'
        || feedback.evidencePolicy?.evidenceClass !== 'shadow_diagnostic'
        || feedback.evidencePolicy?.productLearningEligible !== false
        || feedback.evidencePolicy?.automaticPromotionEligible !== false
    ) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_STUDY_FEEDBACK_SCOPE_INVALID');
    }
    state.feedbackDrafts.push(Object.freeze({ ...feedback }));
    return state.feedbackDrafts.length;
};

const readState = () => JSON.parse(JSON.stringify(state));

Object.defineProperty(window, STUDY_GLOBAL, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({
        version: STUDY_VERSION,
        renderPair,
        recordFeedback,
        readState,
    }),
});

document.documentElement.dataset.zenBonsaiMorphologyStudy = 'ready';
document.querySelector('#study-status').textContent = (
    'Classic2 structural scout · production A/B line renderer · ready'
);
