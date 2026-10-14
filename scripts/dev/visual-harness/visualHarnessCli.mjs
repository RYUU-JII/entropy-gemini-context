import { resolve } from 'node:path';

function createCliError(message, details = {}) {
  const error = new Error(message);
  error.code = 'VISUAL_HARNESS_CLI_INVALID';
  error.details = details;
  return error;
}

export function getVisualHarnessHelpText() {
  return `Entropy visual capture harness

Usage:
  npm run visual:capture -- <scene-id> [--headed] [--output <directory>]
  npm run visual:capture:all
  npm run visual:list

Options:
  --all                 Capture every catalog scene in one browser session.
  --headed              Run Chromium with a visible window, then close after capture.
  --output <directory>  Override the default .artifacts/visual-harness output root.
  --list                 List catalog scenes without starting Vite or Chromium.
  --help                 Show this help.
`;
}

export function parseVisualHarnessCliArgs(argv, { defaultOutputRoot, rootDir }) {
  let outputProvided = false;
  const options = {
    all: false,
    headed: false,
    help: false,
    list: false,
    outputRoot: defaultOutputRoot,
    sceneId: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--all') {
      options.all = true;
      continue;
    }
    if (argument === '--headed') {
      options.headed = true;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (argument === '--list') {
      options.list = true;
      continue;
    }
    if (argument === '--output') {
      const outputValue = argv[index + 1];
      if (
        typeof outputValue !== 'string'
        || !outputValue.trim()
        || outputValue.trim().startsWith('-')
      ) {
        throw createCliError('[VisualHarness] --output requires a directory.');
      }
      options.outputRoot = resolve(rootDir, outputValue.trim());
      outputProvided = true;
      index += 1;
      continue;
    }
    if (argument.startsWith('--output=')) {
      const outputValue = argument.slice('--output='.length).trim();
      if (!outputValue) {
        throw createCliError('[VisualHarness] --output requires a directory.');
      }
      options.outputRoot = resolve(rootDir, outputValue);
      outputProvided = true;
      continue;
    }
    if (argument.startsWith('-')) {
      throw createCliError(`[VisualHarness] unknown option '${argument}'.`, { argument });
    }
    if (options.sceneId) {
      throw createCliError('[VisualHarness] only one scene id may be provided.', {
        firstSceneId: options.sceneId,
        secondSceneId: argument,
      });
    }
    options.sceneId = argument.trim();
  }

  if (options.help) return Object.freeze(options);
  if (options.list && (options.all || options.headed || options.sceneId || outputProvided)) {
    throw createCliError('[VisualHarness] --list cannot be combined with capture options.');
  }
  if (options.all && options.sceneId) {
    throw createCliError('[VisualHarness] --all cannot be combined with a scene id.');
  }
  if (!options.list && !options.all && !options.sceneId) {
    throw createCliError('[VisualHarness] provide a scene id or use --all.');
  }

  return Object.freeze(options);
}
