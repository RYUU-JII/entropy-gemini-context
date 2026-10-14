#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const supportedFileRe = /\.(jsx|tsx)$/;
const scopedRoots = Object.freeze([
    'src/apps/dashboard',
    'src/apps/popup',
]);
const excludedPathMatchers = Object.freeze([
    /\/preview\//,
    /Mockup/i,
    /SignalTestPattern\.(jsx|tsx)$/i,
    /ThemeFilterTestScaffold\.(jsx|tsx)$/i,
]);
const noDefaultValueFiles = new Set([
    'src/apps/dashboard/tabs/tools/ToolsTab.jsx',
    'src/apps/dashboard/tabs/experiment/ExperimentWorkspace.jsx',
    'src/apps/dashboard/tabs/experiment/ExperimentHubTab.jsx',
    'src/apps/dashboard/tabs/experiment/WorkerRuntimePanel.jsx',
    'src/themes/plugins/zen/widgets/sites/ZenRegistryPanel.jsx',
    'src/themes/plugins/scp/widgets/main/SCPCoreStatus.jsx',
    'src/themes/plugins/scp/widgets/signals/SCPSignalScanner.jsx',
    'src/themes/plugins/matrix/widgets/signals/MatrixSignalScanner.jsx',
    'src/themes/plugins/cyberpunk/widgets/signals/CyberpunkSignalScanner.jsx',
    'src/themes/plugins/clinical/widgets/sites/ClinicalRegistryPanel.jsx',
    'src/themes/plugins/entropy/widgets/signals/EntropySignalScanner.jsx',
    'src/themes/plugins/entropy/widgets/main/EntropyCoreStatus.jsx',
    'src/themes/plugins/zen/widgets/tools/FurinTuner.jsx',
    'src/themes/plugins/matrix/widgets/sites/MatrixRegistryPanel.jsx',
    'src/themes/plugins/zen/pond/app/ZenKoiTunerPanel.jsx',
    'src/themes/plugins/zen/widgets/signals/signalScanner/tuner/KoiTunerParamControl.jsx',
    'src/themes/plugins/zen/widgets/signals/signalScanner/tuner/components/ControlGroupCard.jsx',
    'src/themes/plugins/zen/pond/app/hooks/useZenViewStateController.js',
    'src/themes/plugins/zen/pond/app/hooks/useZenAppearanceActions.js',
    'src/themes/plugins/zen/widgets/signals/signalScanner/tuner/components/KoiTunerActionBar.jsx',
    'src/themes/plugins/zen/widgets/signals/signalScanner/tuner/env/EnvPresetPanel.jsx',
    'src/themes/plugins/zen/widgets/signals/signalScanner/tuner/env/EnvChannelMonitorPanel.jsx',
    'src/ui-kit/BootLoader.jsx',
    'src/ui-kit/ShadowPicker.jsx',
    'src/ui-kit/ToastProvider.jsx',
    'src/themes/core/appearance/transitions/BootSequence.jsx',
]);
const translationMarkers = Object.freeze([
    /\buseTranslation\s*\(/,
    /\buseThemeTranslation\s*\(/,
    /\bi18n\.t\s*\(/,
    /\btRuntime\s*\(/,
]);
const inlineTextNodeRe = />\s*([^<>{\n]*[A-Za-z\u3131-\u318E\uAC00-\uD7A3][^<>{\n]*)\s*</g;
const propLiteralRe = /\b(?:aria-label|ariaLabel|label|title|subtitle|description|desc|placeholder|helperText|helpText|heading|emptyTitle|emptyBody|emptyLabel|emptyMessage|emptyState|ctaLabel)\s*=\s*(['"])([^'"]*[A-Za-z\u3131-\u318E\uAC00-\uD7A3][^'"]*)\1/g;
const failures = [];

function absolute(relativePath) {
    return path.resolve(rootDir, relativePath);
}

async function walkFiles(relativePath) {
    const abs = absolute(relativePath);
    const stats = await fs.stat(abs);

    if (stats.isFile()) {
        return supportedFileRe.test(relativePath) ? [relativePath] : [];
    }

    const entries = await fs.readdir(abs, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const nestedPath = path.join(relativePath, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await walkFiles(nestedPath)));
            continue;
        }
        if (entry.isFile() && supportedFileRe.test(entry.name)) {
            files.push(nestedPath);
        }
    }
    return files;
}

function computeLine(source, index) {
    let line = 1;
    for (let cursor = 0; cursor < index; cursor += 1) {
        if (source.charCodeAt(cursor) === 10) {
            line += 1;
        }
    }
    return line;
}

function normalizeCandidate(rawValue) {
    return String(rawValue || '')
        .replace(/\s+/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .trim();
}

function shouldIgnoreCandidate(value) {
    if (!value) return true;
    if (/^(https?:\/\/|chrome:\/\/|data:)/i.test(value)) return true;
    if (/^[A-Z0-9_.:/-]+$/.test(value)) return true;
    if (/^[A-Za-z]{1,3}$/.test(value)) return true;
    if (/^v?\d+(?:[.:/-]\d+)*$/i.test(value)) return true;
    if (/&&|\|\||===|!==|==|!=|=>|<=|>=|[{}`;]/.test(value)) return true;
    return false;
}

function collectMatches(source, matcher) {
    const matches = [];
    matcher.lastIndex = 0;
    let result = matcher.exec(source);
    while (result) {
        const candidate = normalizeCandidate(result[1] || result[2] || '');
        if (!shouldIgnoreCandidate(candidate)) {
            matches.push({
                line: computeLine(source, result.index),
                value: candidate,
            });
        }
        result = matcher.exec(source);
    }
    matcher.lastIndex = 0;
    return matches;
}

function collectInlineTextMatches(source) {
    const matches = [];
    const lines = source.split('\n');

    lines.forEach((lineSource, lineIndex) => {
        inlineTextNodeRe.lastIndex = 0;
        let result = inlineTextNodeRe.exec(lineSource);
        while (result) {
            const candidate = normalizeCandidate(result[1] || '');
            if (!shouldIgnoreCandidate(candidate)) {
                matches.push({
                    line: lineIndex + 1,
                    value: candidate,
                });
            }
            result = inlineTextNodeRe.exec(lineSource);
        }
        inlineTextNodeRe.lastIndex = 0;
    });

    return matches;
}

async function scanFile(relativePath) {
    if (excludedPathMatchers.some((matcher) => matcher.test(relativePath))) {
        return;
    }

    const source = await fs.readFile(absolute(relativePath), 'utf8');
    if (!translationMarkers.some((matcher) => matcher.test(source))) {
        return;
    }

    if (noDefaultValueFiles.has(relativePath)) {
        const defaultValueRe = /defaultValue\s*:/g;
        let result = defaultValueRe.exec(source);
        while (result) {
            failures.push(`${relativePath}:${computeLine(source, result.index)} must not use defaultValue in this governed surface; locale JSON is the source of truth.`);
            result = defaultValueRe.exec(source);
        }
    }

    const isExplicitDefaultOnlyFile = noDefaultValueFiles.has(relativePath)
        && !scopedRoots.some((root) => relativePath.startsWith(`${root}/`));
    if (isExplicitDefaultOnlyFile) {
        return;
    }

    const textMatches = collectInlineTextMatches(source);
    const propMatches = collectMatches(source, propLiteralRe);

    textMatches.forEach(({ line, value }) => {
        failures.push(`${relativePath}:${line} raw JSX text "${value}" -> use an i18n key in translated UI.`);
    });
    propMatches.forEach(({ line, value }) => {
        failures.push(`${relativePath}:${line} raw user-facing prop "${value}" -> use an i18n key in translated UI.`);
    });
}

async function main() {
    const files = [];
    for (const scopedRoot of scopedRoots) {
        try {
            files.push(...(await walkFiles(scopedRoot)));
        } catch {
            // Skip absent roots in current branch.
        }
    }

    const uniqueFiles = [...new Set([...files, ...noDefaultValueFiles])];
    await Promise.all(uniqueFiles.map((file) => scanFile(file)));

    if (failures.length > 0) {
        failures.forEach((failure) => {
            console.error(`[ui-i18n-hardcoded-strings] ${failure}`);
        });
        process.exit(1);
        return;
    }

    console.log(`[ui-i18n-hardcoded-strings] PASS: scanned ${uniqueFiles.length} governed UI files without raw copy regressions.`);
}

main().catch((error) => {
    console.error('[ui-i18n-hardcoded-strings] Unexpected error:', error);
    process.exit(1);
});
