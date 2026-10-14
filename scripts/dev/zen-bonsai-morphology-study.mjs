#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as esbuild from 'esbuild';
import { launchQaPlaywrightBrowser } from '../qa/browser/qaPlaywrightBrowserOwner.mjs';

import {
    createDefaultZenBonsaiMorphologyStudyCases,
    createZenBonsaiMorphologyStudyFeedback,
    normalizeZenBonsaiMorphologyStudyCase,
    ZEN_BONSAI_MORPHOLOGY_STUDY_DEFERRED_FEEDBACK_LABELS,
    ZEN_BONSAI_MORPHOLOGY_STUDY_LANE_CONTRACT,
    ZEN_BONSAI_MORPHOLOGY_STUDY_OBSERVABLE_FEEDBACK_LABELS,
} from './zen-bonsai-morphology-study/studyContract.mjs';
import {
    getZenBonsaiMorphologyStudyHelp,
    parseZenBonsaiMorphologyStudyCli,
} from './zen-bonsai-morphology-study/studyCli.mjs';
import {
    createZenBonsaiMorphologyStudyHtml,
} from './zen-bonsai-morphology-study/studyPage.mjs';

const execFileAsync = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const STUDY_DIR = resolve(ROOT, 'scripts/dev/zen-bonsai-morphology-study');
const BROWSER_ENTRY = resolve(STUDY_DIR, 'study.browser.js');
const STUDY_GLOBAL = '__ENTROPY_ZEN_BONSAI_MORPHOLOGY_STUDY__';
const REROLL_SEED_BASE = 20260723;
const REROLL_SEED_STEP = 104729;

const round = (value, digits = 4) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Number(numeric.toFixed(digits)) : 0;
};

const artifactTimestamp = () => new Date().toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replaceAll(':', '-');

const defaultOutputRoot = resolve(
    ROOT,
    '.artifacts/zen-bonsai-morphology-study',
    artifactTimestamp(),
);

const options = parseZenBonsaiMorphologyStudyCli(process.argv.slice(2), {
    rootDir: ROOT,
    defaultOutputRoot,
});

if (options.help) {
    process.stdout.write(getZenBonsaiMorphologyStudyHelp());
    process.exit(0);
}

const toSafeFileName = (value) => String(value)
    .replaceAll('/', '__')
    .replace(/[^a-zA-Z0-9_.-]+/g, '-');

const writeJson = (path, value) => writeFile(
    path,
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8',
);

const readGitState = async () => {
    const [commit, status] = await Promise.all([
        execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }),
        execFileAsync('git', ['status', '--short'], { cwd: ROOT }),
    ]);
    return Object.freeze({
        commit: commit.stdout.trim(),
        dirtyPaths: status.stdout
            .split(/\r?\n/)
            .filter(Boolean),
    });
};

const createRerollCases = (count) => Array.from({ length: count }, (_, index) => {
    const seed = (REROLL_SEED_BASE + (index * REROLL_SEED_STEP)) >>> 0;
    return normalizeZenBonsaiMorphologyStudyCase({
        id: `procedural/agent-reroll/seed-${seed}`,
        title: `Agent procedural reroll ${index + 1}`,
        seed,
        latentOverrides: {},
        generation: { kind: 'procedural' },
        form: null,
    });
});

const pairCases = (cases, idPrefix) => {
    const pairs = [];
    for (let index = 0; index < cases.length; index += 2) {
        const left = cases[index];
        const right = cases[index + 1] || cases[0];
        pairs.push(Object.freeze({
            id: `${idPrefix}-${String((index / 2) + 1).padStart(2, '0')}`,
            left,
            right,
        }));
    }
    return pairs;
};

const defaultCases = createDefaultZenBonsaiMorphologyStudyCases();
const rerollCases = createRerollCases(options.rerollCount);
const pairs = Object.freeze([
    ...pairCases(defaultCases, 'fixed'),
    ...pairCases(rerollCases, 'reroll'),
]);
const uniqueCases = Object.freeze([
    ...new Map(
        pairs.flatMap((pair) => [pair.left, pair.right])
            .map((studyCase) => [studyCase.id, studyCase]),
    ).values(),
]);

const readFeedback = async () => {
    if (!options.feedbackPath) return [];
    const parsed = JSON.parse(await readFile(options.feedbackPath, 'utf8'));
    const inputs = Array.isArray(parsed) ? parsed : parsed?.records;
    if (!Array.isArray(inputs)) {
        throw new Error('ZEN_BONSAI_MORPHOLOGY_STUDY_FEEDBACK_INPUT_ARRAY_REQUIRED');
    }
    const knownCaseIds = new Set(uniqueCases.map((studyCase) => studyCase.id));
    return inputs.map((input) => {
        const feedback = createZenBonsaiMorphologyStudyFeedback(input);
        if (!knownCaseIds.has(feedback.caseId)) {
            throw new Error(
                `ZEN_BONSAI_MORPHOLOGY_STUDY_FEEDBACK_CASE_UNKNOWN:${feedback.caseId}`,
            );
        }
        return feedback;
    });
};

const feedback = await readFeedback();
const outputRoot = options.outputRoot;
const bundlePath = resolve(outputRoot, 'study.bundle.js');
const htmlPath = resolve(outputRoot, 'index.html');
const atlasPath = resolve(outputRoot, 'atlas.png');
const manifestPath = resolve(outputRoot, 'manifest.json');
const reportPath = resolve(outputRoot, 'report.md');
const feedbackTemplatePath = resolve(outputRoot, 'feedback-template.json');
const pairOutputDir = resolve(outputRoot, 'pairs');
const caseOutputDir = resolve(outputRoot, 'cases');

await Promise.all([
    mkdir(pairOutputDir, { recursive: true }),
    mkdir(caseOutputDir, { recursive: true }),
]);

await esbuild.build({
    entryPoints: [BROWSER_ENTRY],
    bundle: true,
    format: 'iife',
    target: 'chrome120',
    outfile: bundlePath,
    logLevel: 'silent',
    plugins: [{
        name: 'entropy-src-alias',
        setup(build) {
            build.onResolve({ filter: /^@\// }, (args) => ({
                path: resolve(ROOT, 'src', args.path.slice(2)),
            }));
        },
    }],
});

await writeFile(
    htmlPath,
    createZenBonsaiMorphologyStudyHtml({
        bundleFileName: 'study.bundle.js',
    }),
    'utf8',
);

const browser = await launchQaPlaywrightBrowser({ headless: !options.headed });
const context = await browser.newContext({
    viewport: { width: 1480, height: 980 },
    deviceScaleFactor: options.deviceScaleFactor,
    locale: 'ko-KR',
    colorScheme: 'light',
    reducedMotion: 'reduce',
});
const page = await context.newPage();
const diagnostics = {
    consoleErrors: [],
    pageErrors: [],
};
let browserState = null;
page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
});
page.on('pageerror', (error) => diagnostics.pageErrors.push(String(error)));

try {
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
    await page.waitForFunction(
        () => document.documentElement.dataset.zenBonsaiMorphologyStudy === 'ready',
        null,
        { timeout: 20_000 },
    );

    for (const pair of pairs) {
        await page.evaluate(
            ({ globalName, value }) => window[globalName].renderPair(value),
            { globalName: STUDY_GLOBAL, value: pair },
        );
        const pairLocator = page.locator(
            `[data-study-pair="${pair.id}"]`,
        );
        await pairLocator.screenshot({
            path: resolve(pairOutputDir, `${toSafeFileName(pair.id)}.png`),
            animations: 'disabled',
            caret: 'hide',
        });
        for (const studyCase of [pair.left, pair.right]) {
            const caseLocator = pairLocator.locator(
                `[data-study-case-id="${studyCase.id}"] canvas`,
            );
            await caseLocator.screenshot({
                path: resolve(caseOutputDir, `${toSafeFileName(studyCase.id)}.png`),
                animations: 'disabled',
                caret: 'hide',
            });
        }
    }

    await page.screenshot({
        path: atlasPath,
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
    });
    browserState = await page.evaluate((globalName) => (
        window[globalName].readState()
    ), STUDY_GLOBAL);
} finally {
    await context.close();
    await browser.close();
}

if (diagnostics.consoleErrors.length || diagnostics.pageErrors.length) {
    throw new Error([
        'ZEN_BONSAI_MORPHOLOGY_STUDY_BROWSER_ERRORS',
        ...diagnostics.consoleErrors,
        ...diagnostics.pageErrors,
    ].join('\n'));
}

if (!browserState || browserState.status !== 'ready') {
    throw new Error('ZEN_BONSAI_MORPHOLOGY_STUDY_BROWSER_STATE_REQUIRED');
}

const observations = [
    ...new Map(browserState.observations.map((entry) => [entry.caseId, entry])).values(),
];
const feedbackLabelCounts = Object.fromEntries(
    [...feedback.reduce((counts, entry) => {
        entry.observableLabels.forEach((label) => (
            counts.set(label, (counts.get(label) || 0) + 1)
        ));
        return counts;
    }, new Map()).entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])),
);
const git = await readGitState();
const feedbackTemplate = {
    contract: 'zen_bonsai_morphology_study_feedback_input_template_v1',
    lane: ZEN_BONSAI_MORPHOLOGY_STUDY_LANE_CONTRACT,
    instructions: (
        'Fill observableLabels with one or more allowed labels. '
        + 'Deferred labels are intentionally unavailable in this structural-scout lane.'
    ),
    observableLabels: ZEN_BONSAI_MORPHOLOGY_STUDY_OBSERVABLE_FEEDBACK_LABELS,
    deferredLabels: ZEN_BONSAI_MORPHOLOGY_STUDY_DEFERRED_FEEDBACK_LABELS,
    records: uniqueCases.map((studyCase) => ({
        caseId: studyCase.id,
        observableLabels: null,
        note: null,
    })),
};
await writeJson(feedbackTemplatePath, feedbackTemplate);
if (feedback.length) {
    await writeFile(
        resolve(outputRoot, 'feedback.jsonl'),
        `${feedback.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
        'utf8',
    );
}

const manifest = {
    contract: 'zen_bonsai_morphology_study_run_v1',
    generatedAt: new Date().toISOString(),
    lane: ZEN_BONSAI_MORPHOLOGY_STUDY_LANE_CONTRACT,
    source: git,
    browser: {
        engine: 'chromium',
        viewport: { width: 1480, height: 980 },
        deviceScaleFactor: options.deviceScaleFactor,
        locale: 'ko-KR',
        reducedMotion: 'reduce',
    },
    inputs: {
        fixedCaseCount: defaultCases.length,
        rerollCaseCount: rerollCases.length,
        cases: uniqueCases,
        pairIds: pairs.map((pair) => pair.id),
    },
    observations,
    comparisons: browserState.comparisons,
    feedback,
    feedbackSummary: {
        reviewedCaseCount: feedback.length,
        observableLabelCounts: feedbackLabelCounts,
        deferredLabels: ZEN_BONSAI_MORPHOLOGY_STUDY_DEFERRED_FEEDBACK_LABELS,
        deferredLabelDisposition: 'not_observable_on_structural_scout',
    },
    diagnostics,
    artifacts: {
        atlas: relative(outputRoot, atlasPath),
        caseDirectory: relative(outputRoot, caseOutputDir),
        pairDirectory: relative(outputRoot, pairOutputDir),
        feedbackTemplate: relative(outputRoot, feedbackTemplatePath),
    },
};
await writeJson(manifestPath, manifest);

const comparisonRows = manifest.comparisons.map((entry) => [
    entry.pairId,
    entry.leftCaseId,
    entry.rightCaseId,
    entry.distance.visibleDistancePx,
    entry.distance.passed ? 'pass' : 'too similar',
]);
const observationRows = observations.map((entry) => [
    entry.caseId,
    entry.seed,
    entry.formInput?.id || 'none',
    entry.classification.primaryFormId || 'unclassified',
    entry.trunkDiagnostic.pathToChordRatio,
    entry.trunkDiagnostic.absoluteTurnDeg,
    entry.trunkDiagnostic.maxLocalTurnDeg,
    round(entry.trunkDiagnostic.longestStraightRunRatio * 100, 1),
    entry.trunkDiagnostic.tipWidthToBase,
]);
const report = [
    '# Zen Bonsai Morphology Study',
    '',
    '> Browser-rendered structural scout. Metrics are diagnostics, not visual acceptance.',
    '> Feedback is shadow diagnostic and is never product learning evidence.',
    '',
    `- backend: \`${manifest.lane.backend}\``,
    `- renderer: \`${manifest.lane.renderer}\``,
    `- source commit: \`${manifest.source.commit}\``,
    `- cases: ${observations.length}`,
    `- pairs: ${manifest.comparisons.length}`,
    `- feedback records: ${feedback.length}`,
    '',
    ...(feedback.length ? [
        '## Shadow feedback',
        '',
        '| observable label | count |',
        '| --- | ---: |',
        ...Object.entries(feedbackLabelCounts).map(
            ([label, count]) => `| ${label} | ${count} |`,
        ),
        '',
        `Deferred in this lane: ${ZEN_BONSAI_MORPHOLOGY_STUDY_DEFERRED_FEEDBACK_LABELS
            .map((label) => `\`${label}\``)
            .join(', ')}.`,
        '',
    ] : []),
    '## Pair visibility',
    '',
    '| pair | left | right | visible distance px | gate |',
    '| --- | --- | --- | ---: | --- |',
    ...comparisonRows.map((row) => `| ${row.join(' | ')} |`),
    '',
    '## Structural observations',
    '',
    '| case | seed | form input | classified form | arc/chord | abs turn deg | max local deg | longest straight % | tip/base width |',
    '| --- | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: |',
    ...observationRows.map((row) => `| ${row.join(' | ')} |`),
    '',
    '## Artifacts',
    '',
    '- `atlas.png`: whole comparison atlas',
    '- `pairs/*.png`: A/B-like shared-scale pair captures',
    '- `cases/*.png`: individual structural captures',
    '- `manifest.json`: exact cases, provenance, descriptors, diagnostics, and distances',
    '- `feedback-template.json`: shadow-feedback input template',
].join('\n');
await writeFile(reportPath, `${report}\n`, 'utf8');

process.stdout.write([
    `[zen-bonsai-morphology-study] PASS ${observations.length} cases`,
    `[zen-bonsai-morphology-study] atlas ${atlasPath}`,
    `[zen-bonsai-morphology-study] manifest ${manifestPath}`,
    `[zen-bonsai-morphology-study] report ${reportPath}`,
].join('\n') + '\n');
