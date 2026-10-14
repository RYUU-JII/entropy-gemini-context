import { resolve } from 'node:path';

const fail = (message) => {
    const error = new Error(`ZEN_BONSAI_MORPHOLOGY_STUDY_CLI_INVALID:${message}`);
    error.code = 'ZEN_BONSAI_MORPHOLOGY_STUDY_CLI_INVALID';
    throw error;
};

const requireValue = (argv, index, option) => {
    const value = argv[index + 1];
    if (typeof value !== 'string' || !value.trim() || value.startsWith('-')) {
        fail(`${option}.value_required`);
    }
    return value.trim();
};

const parseInteger = (value, field, min, max) => {
    const numeric = Number(value);
    if (!Number.isSafeInteger(numeric) || numeric < min || numeric > max) {
        fail(`${field}.integer_${min}_${max}_required`);
    }
    return numeric;
};

const parseDpr = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 1 || numeric > 3) {
        fail('dpr.range_1_3_required');
    }
    return numeric;
};

export const parseZenBonsaiMorphologyStudyCli = (
    argv,
    {
        rootDir,
        defaultOutputRoot,
    },
) => {
    const options = {
        deviceScaleFactor: 1,
        feedbackPath: null,
        headed: false,
        help: false,
        outputRoot: defaultOutputRoot,
        rerollCount: 12,
    };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--headed') {
            options.headed = true;
            continue;
        }
        if (argument === '--help' || argument === '-h') {
            options.help = true;
            continue;
        }
        if (argument === '--output') {
            options.outputRoot = resolve(
                rootDir,
                requireValue(argv, index, '--output'),
            );
            index += 1;
            continue;
        }
        if (argument.startsWith('--output=')) {
            const value = argument.slice('--output='.length).trim();
            if (!value) fail('--output.value_required');
            options.outputRoot = resolve(rootDir, value);
            continue;
        }
        if (argument === '--feedback') {
            options.feedbackPath = resolve(
                rootDir,
                requireValue(argv, index, '--feedback'),
            );
            index += 1;
            continue;
        }
        if (argument.startsWith('--feedback=')) {
            const value = argument.slice('--feedback='.length).trim();
            if (!value) fail('--feedback.value_required');
            options.feedbackPath = resolve(rootDir, value);
            continue;
        }
        if (argument === '--dpr') {
            options.deviceScaleFactor = parseDpr(
                requireValue(argv, index, '--dpr'),
            );
            index += 1;
            continue;
        }
        if (argument.startsWith('--dpr=')) {
            options.deviceScaleFactor = parseDpr(
                argument.slice('--dpr='.length),
            );
            continue;
        }
        if (argument === '--rerolls') {
            options.rerollCount = parseInteger(
                requireValue(argv, index, '--rerolls'),
                'rerolls',
                0,
                200,
            );
            index += 1;
            continue;
        }
        if (argument.startsWith('--rerolls=')) {
            options.rerollCount = parseInteger(
                argument.slice('--rerolls='.length),
                'rerolls',
                0,
                200,
            );
            continue;
        }
        fail(`unknown_argument:${argument}`);
    }
    return Object.freeze(options);
};

export const getZenBonsaiMorphologyStudyHelp = () => `Entropy Zen bonsai morphology study

Usage:
  npm run diagnose:zen:bonsai-morphology-study -- [options]

Options:
  --rerolls <count>  Add 0-200 deterministic procedural rerolls (default: 12).
  --dpr <ratio>      Browser device scale factor from 1 to 3 (default: 1).
  --feedback <file>  Canonicalize a JSON array of shadow feedback inputs.
  --output <dir>     Override the timestamped artifact directory.
  --headed           Show Chromium while the study runs; it still closes afterward.
  --help             Show this help.
`;
