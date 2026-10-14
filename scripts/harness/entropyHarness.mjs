#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  listHarnessAdapters,
  loadHarnessAdapter,
} from './catalog/harnessAdapterRegistry.mjs';
import {
  createProjectHarnessErrorEnvelope,
  readProjectHarnessRequest,
} from './contracts/projectHarnessEnvelope.mjs';
import {
  reserveProjectHarnessJsonOutput,
} from './contracts/projectHarnessOutput.mjs';

const scriptPath = fileURLToPath(import.meta.url);
export const PROJECT_HARNESS_ROOT_DIR = path.resolve(
  path.dirname(scriptPath),
  '../..',
);
const COMMANDS = new Set(['list', 'describe', 'plan', 'run']);

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function assignOnce(target, key, value) {
  if (Object.prototype.hasOwnProperty.call(target, key)) {
    fail('PROJECT_HARNESS_CLI_OPTION_DUPLICATE', key);
  }
  target[key] = value;
}

function parseOption(argument) {
  if (!argument.startsWith('--')) {
    fail('PROJECT_HARNESS_CLI_OPTION_INVALID', argument);
  }
  const separator = argument.indexOf('=');
  if (separator < 3 || separator === argument.length - 1) {
    fail('PROJECT_HARNESS_CLI_OPTION_INVALID', argument);
  }
  return Object.freeze({
    name: argument.slice(2, separator),
    value: argument.slice(separator + 1),
  });
}

function requireAbsoluteOption(options, name) {
  const value = options[name];
  if (typeof value !== 'string' || !path.isAbsolute(value)) {
    fail('PROJECT_HARNESS_CLI_ABSOLUTE_PATH_REQUIRED', name);
  }
  return path.normalize(value);
}

function rejectUnknownOptions(options, allowed) {
  const unknown = Object.keys(options).find((name) => !allowed.has(name));
  if (unknown) fail('PROJECT_HARNESS_CLI_OPTION_UNKNOWN', unknown);
}

export function parseEntropyHarnessArgs(argv) {
  const [command, ...rest] = argv;
  if (!COMMANDS.has(command)) {
    fail('PROJECT_HARNESS_CLI_COMMAND_INVALID', command || 'missing');
  }
  const positionals = [];
  const options = {};
  rest.forEach((argument) => {
    if (!argument.startsWith('--')) {
      positionals.push(argument);
      return;
    }
    const option = parseOption(argument);
    assignOnce(options, option.name, option.value);
  });

  if (command === 'list') {
    if (positionals.length !== 0) {
      fail('PROJECT_HARNESS_CLI_POSITIONAL_UNEXPECTED', positionals[0]);
    }
    rejectUnknownOptions(options, new Set());
    return Object.freeze({ command, adapterId: null, options: Object.freeze({}) });
  }

  if (positionals.length !== 1) {
    fail('PROJECT_HARNESS_CLI_ADAPTER_REQUIRED', command);
  }
  const adapterId = positionals[0];

  if (command === 'describe') {
    rejectUnknownOptions(options, new Set(['target']));
    if (typeof options.target !== 'string' || !options.target) {
      fail('PROJECT_HARNESS_CLI_TARGET_REQUIRED');
    }
    return Object.freeze({
      command,
      adapterId,
      options: Object.freeze({ target: options.target }),
    });
  }

  const allowed = command === 'run'
    ? new Set(['request', 'out', 'expected-plan-digest'])
    : new Set(['request', 'out']);
  rejectUnknownOptions(options, allowed);
  const normalizedOptions = {
    request: requireAbsoluteOption(options, 'request'),
    out: requireAbsoluteOption(options, 'out'),
  };
  if (command === 'run') {
    if (typeof options['expected-plan-digest'] !== 'string') {
      fail('PROJECT_HARNESS_CLI_EXPECTED_PLAN_DIGEST_REQUIRED');
    }
    normalizedOptions.expectedPlanDigest = options['expected-plan-digest'];
  }
  return Object.freeze({
    command,
    adapterId,
    options: Object.freeze(normalizedOptions),
  });
}

function writeStdoutJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function statusExitCode(status) {
  if (status === 'PASS' || status === 'READY') return 0;
  if (status === 'BLOCKED') return 2;
  if (status === 'INCONCLUSIVE') return 3;
  return 1;
}

export async function executeEntropyHarnessCommand(parsed, {
  rootDir = PROJECT_HARNESS_ROOT_DIR,
  signal = null,
  adapterLoader = loadHarnessAdapter,
} = {}) {
  if (parsed.command === 'list') {
    const adapters = listHarnessAdapters();
    writeStdoutJson(adapters);
    return Object.freeze({ exitCode: 0, adapters });
  }

  const adapter = await adapterLoader(parsed.adapterId);
  if (parsed.command === 'describe') {
    const target = adapter.describe({ targetId: parsed.options.target });
    const result = Object.freeze({
      adapterId: adapter.id,
      adapterRevision: adapter.revision,
      runtimeRevision: adapter.runtimeRevision,
      intelligencePolicy: adapter.intelligencePolicy,
      target,
    });
    writeStdoutJson(result);
    return Object.freeze({ exitCode: 0, result });
  }

  const outputReservation = await reserveProjectHarnessJsonOutput(
    parsed.options.out,
  );
  try {
    let envelope;
    try {
      const request = await readProjectHarnessRequest(parsed.options.request);
      envelope = parsed.command === 'plan'
        ? await adapter.plan({ rootDir, request })
        : await adapter.run({
          rootDir,
          request,
          expectedPlanDigest: parsed.options.expectedPlanDigest,
          signal,
        });
    } catch (error) {
      const status = adapter.classifyError?.(error) || 'FAIL';
      if (error && typeof error === 'object') {
        error.harnessStatus = status;
      }
      const errorEnvelope = createProjectHarnessErrorEnvelope({
        adapterId: parsed.adapterId,
        operation: parsed.command,
        status,
        error,
      });
      try {
        await outputReservation.publish(errorEnvelope);
      } catch (publicationError) {
        const wrappedError = new Error(
          `PROJECT_HARNESS_ERROR_OUTPUT_PUBLISH_FAILED:${publicationError?.message || String(publicationError)}`,
          { cause: error },
        );
        wrappedError.harnessStatus = 'FAIL';
        throw wrappedError;
      }
      throw error;
    }

    await outputReservation.publish(envelope);
    return Object.freeze({
      exitCode: statusExitCode(envelope.status),
      envelope,
    });
  } finally {
    await outputReservation.release();
  }
}

function createSignalCoordinator() {
  const controller = new AbortController();
  const handleSignal = (signalName) => {
    if (!controller.signal.aborted) {
      const error = new Error(`PROJECT_HARNESS_ABORTED:${signalName}`);
      error.code = 'QA_RUN_ABORTED';
      controller.abort(error);
    }
  };
  const onSigint = () => handleSignal('SIGINT');
  const onSigterm = () => handleSignal('SIGTERM');
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  return Object.freeze({
    signal: controller.signal,
    dispose() {
      process.removeListener('SIGINT', onSigint);
      process.removeListener('SIGTERM', onSigterm);
    },
  });
}

async function main() {
  let parsed = null;
  const signalCoordinator = createSignalCoordinator();
  try {
    parsed = parseEntropyHarnessArgs(process.argv.slice(2));
    const result = await executeEntropyHarnessCommand(parsed, {
      signal: signalCoordinator.signal,
    });
    process.exitCode = result.exitCode;
  } catch (error) {
    const status = typeof error?.harnessStatus === 'string'
      ? error.harnessStatus
      : 'FAIL';
    process.stderr.write(
      `[entropy-harness] ${status} ${error?.message || String(error)}\n`,
    );
    process.exitCode = statusExitCode(status);
  } finally {
    signalCoordinator.dispose();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main();
}
