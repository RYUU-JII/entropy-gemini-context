import { useId } from 'react';
import {
    SAKURA_AB_QUESTION_LANE,
} from '../../../model/SakuraABQuestionLanePolicy.js';

const QUESTION_MODE = Object.freeze({
    NORMAL: 'normal',
    BEST: 'pick_best',
    WORSE: 'pick_worse',
    ANCHOR: 'anchor',
});

const resolveQuestionMode = (abPair = null) => {
    const context = abPair?.generationContext || {};
    const prompt = String(context.prompt || '').toLowerCase();
    const decisionMode = String(context.decisionMode || '').toLowerCase();
    const queryKind = String(context.queryKind || '').toLowerCase();

    if (prompt === 'pick_worse' || decisionMode === 'pick_worse') {
        return QUESTION_MODE.WORSE;
    }
    if (prompt === 'calibration_anchor' || queryKind === 'anchor') {
        return QUESTION_MODE.ANCHOR;
    }
    if (
        prompt === 'pick_best'
        || (queryKind === 'best_worst' && String(context.bwStage || '').toLowerCase() === 'best')
    ) {
        return QUESTION_MODE.BEST;
    }
    return QUESTION_MODE.NORMAL;
};

const QUESTION_PRESENTATION = Object.freeze({
    [QUESTION_MODE.BEST]: Object.freeze({
        eyebrow: 'Contrast study · step 1 of 2',
        badge: 'Choose the stronger structure',
        title: 'Which skeleton is more beautiful?',
        instruction: 'Compare trunk flow, scaffold rhythm, negative space, and the whole silhouette.',
        action: 'Choose this skeleton',
        ariaAction: 'as more beautiful',
    }),
    [QUESTION_MODE.WORSE]: Object.freeze({
        eyebrow: 'Contrast study · step 2 of 2',
        badge: 'Choose the weaker structure',
        title: 'Which skeleton is less beautiful?',
        instruction: 'Select the structure you would not keep. The other is learned as your preference.',
        action: 'Mark this skeleton',
        ariaAction: 'as less beautiful',
    }),
    [QUESTION_MODE.ANCHOR]: Object.freeze({
        eyebrow: 'Consistency check',
        badge: 'Choose what still feels right',
        title: 'Which choice still feels right?',
        instruction: 'This familiar structural comparison checks consistency. Choose exactly as you feel now.',
        action: 'Choose this skeleton',
        ariaAction: 'for the consistency check',
    }),
});

const resolveQuestionLane = (context = {}) => {
    const requestedLane = String(context?.questionLane || '').trim();
    if (Object.values(SAKURA_AB_QUESTION_LANE).includes(requestedLane)) {
        return requestedLane;
    }
    if (context?.pairType === 'sobol_cold_start') {
        return SAKURA_AB_QUESTION_LANE.SOBOL_COLD_START;
    }
    if (context?.pairType === 'mixed_pair' || context?.pairType === 'diversity_pair') {
        return SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY;
    }
    return SAKURA_AB_QUESTION_LANE.PREFERENCE_BASIN;
};

const formatFactorLabel = (context = {}) => {
    const factor = Array.isArray(context?.changedFactors)
        ? context.changedFactors[0]
        : null;
    const label = String(factor?.label || factor?.id || '').trim();
    return label ? label.replaceAll('_', ' ') : 'one structural factor';
};

const resolveNormalQuestionPresentation = (context, questionLane) => {
    if (questionLane === SAKURA_AB_QUESTION_LANE.STRUCTURAL_DISCOVERY) {
        return {
            eyebrow: 'Structural exploration',
            badge: 'Broader form contrast',
            title: 'Which overall tree form would you keep?',
            instruction: 'Same seed; several structural factors move together. This guides form exploration, not single-factor credit.',
            action: 'Choose this structure',
            ariaAction: 'as the preferred overall structure',
        };
    }
    if (questionLane === SAKURA_AB_QUESTION_LANE.SOBOL_COLD_START) {
        return {
            eyebrow: 'Structural coverage setup',
            badge: 'Mapping the initial range',
            title: 'Which overall tree form would you keep?',
            instruction: 'Texture-free trunk and scaffold skeletons establish the initial preference range.',
            action: 'Choose this structure',
            ariaAction: 'for initial structural coverage',
        };
    }
    const factorLabel = formatFactorLabel(context);
    return {
        eyebrow: 'Focused structure study',
        badge: `Learning ${factorLabel}`,
        title: 'Which structure feels more beautiful?',
        instruction: `Same seed; only ${factorLabel} changes. This learns that factor inside your current preference basin.`,
        action: 'Choose this structure',
        ariaAction: 'as preferred',
    };
};

const resolveQuestionPresentation = (abPair = null) => {
    const context = abPair?.generationContext || {};
    const mode = resolveQuestionMode(abPair);
    const questionLane = resolveQuestionLane(context);
    return {
        mode,
        questionLane,
        ...(mode === QUESTION_MODE.NORMAL
            ? resolveNormalQuestionPresentation(context, questionLane)
            : QUESTION_PRESENTATION[mode]),
    };
};

function ZenABCandidateButton({
    label,
    shortcut,
    containerRef,
    canvasRef,
    canvasWidth,
    canvasHeight,
    action,
    ariaAction,
    instructionId,
    disabled,
    onChoose,
}) {
    return (
        <button
            ref={containerRef}
            type="button"
            disabled={disabled}
            aria-label={`Choose skeleton ${label} ${ariaAction}`}
            aria-describedby={instructionId}
            aria-keyshortcuts={shortcut.aria}
            onClick={() => onChoose?.(label)}
            className="group relative h-full min-h-0 min-w-0 overflow-hidden rounded-[18px] border border-stone-900/10 bg-[#F8F7F2] text-left shadow-[0_10px_30px_rgba(45,55,43,0.07)] transition duration-200 hover:-translate-y-0.5 hover:border-[#8E9A76]/70 hover:shadow-[0_15px_36px_rgba(45,55,43,0.11)] focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#536B46] disabled:cursor-wait disabled:opacity-55 disabled:hover:translate-y-0"
        >
            <canvas
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
                aria-hidden="true"
                className="absolute inset-0 block h-full w-full"
            />

            <div className="pointer-events-none absolute inset-x-2.5 top-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 rounded-full border border-white/80 bg-white/90 py-0.5 pl-0.5 pr-2 text-stone-700 shadow-sm backdrop-blur-md">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-[#344D3D] text-[9px] font-black text-white">
                        {label}
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-[0.13em]">
                        Skeleton {label}
                    </span>
                </div>
                <span className="rounded-full border border-white/80 bg-white/80 px-2 py-0.5 text-[8px] font-bold tabular-nums text-stone-500 shadow-sm backdrop-blur-md">
                    {shortcut.visual}
                </span>
            </div>

            <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-2 rounded-lg border border-white/75 bg-white/90 px-2.5 py-1.5 text-stone-700 shadow-[0_6px_18px_rgba(45,55,43,0.09)] backdrop-blur-md transition group-hover:bg-white/95">
                <span className="min-w-0 truncate text-[9px] font-black uppercase tracking-[0.11em]">
                    {action}
                </span>
                <span className="text-[8px] font-bold text-[#52634A]">
                    Select {label}
                </span>
            </div>
        </button>
    );
}

export function ZenABCollectionView({
    abPair,
    isGenerating,
    abContainerRefA,
    abContainerRefB,
    chooseABCandidate,
    abCanvasRefA,
    abCanvasRefB,
    abCanvasWidthA,
    abCanvasHeightA,
    abCanvasWidthB,
    abCanvasHeightB,
    handleABBothGood,
    handleABPass,
    statusMessage = 'Generating candidates',
}) {
    const titleId = useId();
    const instructionId = useId();
    const question = resolveQuestionPresentation(abPair);
    const candidateDisabled = isGenerating || typeof chooseABCandidate !== 'function';

    if (!abPair) {
        return (
            <div
                role="status"
                aria-live="polite"
                aria-busy="true"
                className="grid h-full w-full place-items-center rounded-[22px] border border-stone-900/10 bg-[#F6F5EF] px-6 text-center"
            >
                <div>
                    <div className="mx-auto mb-3 h-px w-12 bg-[#9AA58B]" />
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">
                        {statusMessage}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            className="flex h-full min-h-0 w-full flex-col gap-2"
            data-question-mode={question.mode}
            data-question-lane={question.questionLane}
            aria-busy={isGenerating ? 'true' : 'false'}
        >
            <header className="flex min-w-0 shrink-0 items-center gap-2 overflow-hidden rounded-xl border border-stone-900/10 bg-[#F6F5EF]/95 px-3 py-2 shadow-[0_6px_20px_rgba(45,55,43,0.04)]">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <p className="hidden shrink-0 text-[8px] font-black uppercase tracking-[0.16em] text-[#6D7B61] xl:block">
                        {question.eyebrow}
                    </p>
                    <span className="hidden h-3 w-px shrink-0 bg-stone-300/80 xl:block" aria-hidden="true" />
                    <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
                        <h4 id={titleId} className="min-w-0 truncate text-[12px] font-black leading-tight text-[#263B30]">
                            {question.title}
                        </h4>
                        <p id={instructionId} className="hidden min-w-0 flex-1 truncate text-[9px] font-semibold text-stone-500 lg:block">
                            {question.instruction}
                        </p>
                    </div>
                </div>
                <div
                    role="status"
                    aria-live="polite"
                    aria-label={isGenerating ? 'Preparing next pair' : question.badge}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#849174]/25 bg-white/70 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-[#52634A]"
                >
                    <span className={`h-1.5 w-1.5 rounded-full ${isGenerating ? 'animate-pulse bg-amber-500' : 'bg-[#66805A]'}`} />
                    <span className="hidden sm:inline">
                        {isGenerating ? 'Preparing next pair' : question.badge}
                    </span>
                </div>
            </header>

            <div
                role="group"
                aria-labelledby={titleId}
                aria-describedby={instructionId}
                className="grid h-full min-h-0 flex-1 grid-cols-2 grid-rows-[minmax(0,1fr)] gap-2"
            >
                <ZenABCandidateButton
                    label="A"
                    shortcut={{ visual: '1 · ←', aria: '1 ArrowLeft' }}
                    containerRef={abContainerRefA}
                    canvasRef={abCanvasRefA}
                    canvasWidth={abCanvasWidthA}
                    canvasHeight={abCanvasHeightA}
                    action={question.action}
                    ariaAction={question.ariaAction}
                    instructionId={instructionId}
                    disabled={candidateDisabled}
                    onChoose={chooseABCandidate}
                />
                <ZenABCandidateButton
                    label="B"
                    shortcut={{ visual: '2 · →', aria: '2 ArrowRight' }}
                    containerRef={abContainerRefB}
                    canvasRef={abCanvasRefB}
                    canvasWidth={abCanvasWidthB}
                    canvasHeight={abCanvasHeightB}
                    action={question.action}
                    ariaAction={question.ariaAction}
                    instructionId={instructionId}
                    disabled={candidateDisabled}
                    onChoose={chooseABCandidate}
                />
            </div>

            <div className="flex shrink-0 items-center justify-end gap-1.5" role="group" aria-label="Secondary comparison actions">
                <span className="mr-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-stone-400">
                    No clear choice?
                </span>
                <button
                    type="button"
                    onClick={handleABBothGood}
                    disabled={isGenerating || typeof handleABBothGood !== 'function'}
                    aria-label="Both candidates are good"
                    aria-keyshortcuts="ArrowDown"
                    className="rounded-full border border-[#829177]/25 bg-[#EDF1E9] px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-[#52634A] transition hover:border-[#829177]/45 hover:bg-[#E5EBE0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#536B46] disabled:cursor-wait disabled:opacity-50"
                >
                    Both good <span aria-hidden="true" className="ml-1 text-stone-400">↓</span>
                </button>
                <button
                    type="button"
                    onClick={handleABPass}
                    disabled={isGenerating || typeof handleABPass !== 'function'}
                    aria-label="Skip this comparison"
                    aria-keyshortcuts="Space ArrowUp"
                    className="rounded-full border border-stone-900/10 bg-white/70 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-stone-500 transition hover:border-stone-900/20 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#536B46] disabled:cursor-wait disabled:opacity-50"
                >
                    Pass <span aria-hidden="true" className="ml-1 text-stone-400">Space · ↑</span>
                </button>
            </div>
        </div>
    );
}
