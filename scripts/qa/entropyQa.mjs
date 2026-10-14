#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveQaHumanSetupInvocation,
} from './catalog/qaHumanSetupCatalog.mjs';
import {
  classifyQaErrorStatus,
} from './contracts/qaEvidenceContract.mjs';
import {
  QA_RUN_STATUSES,
} from './contracts/qaTargetContract.mjs';
import {
  createQaSignalCoordinator,
} from './runtime/qaSignalCoordinator.mjs';
import {
  formatEntropyQaUsageError,
  isEntropyQaUsageError,
  renderEntropyQaHelp,
} from './cli/qaCliHelp.mjs';
import {
  printQaBrowserInventory,
  printQaBrowserLifecycle,
  printQaBrowserStartupDiagnostics,
  printQaBrowserStatus,
  printQaDesktopShortcut,
  printQaDoctorResult,
  printQaRecoveryInspection,
  printQaRecoveryResult,
  printQaRetentionInspection,
  printQaRetentionMutation,
  printQaTargetList,
  printQaTargetDescription,
} from './cli/qaCliOutput.mjs';
import { parseQaArtifactCommand } from './cli/qaArtifactArgs.mjs';
import { parseQaExplorationCommand } from './cli/qaExplorationArgs.mjs';
import { parseQaRetentionCommand } from './cli/qaRetentionArgs.mjs';

const scriptPath = fileURLToPath(import.meta.url);
export const QA_ROOT_DIR = path.resolve(path.dirname(scriptPath), '../..');
const COMMANDS = new Set([
  'help',
  'list',
  'describe',
  'doctor',
  'browser',
  'artifact',
  'recovery',
  'retention',
  'setup',
  'run',
  'explore',
  'report',
]);

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function assignOnce(target, key, value, code) {
  if (Object.prototype.hasOwnProperty.call(target, key)) fail(code, key);
  target[key] = value;
}

function parseLongOption(argument) {
  if (!argument.startsWith('--')) fail('QA_CLI_OPTION_INVALID', argument);
  const separator = argument.indexOf('=');
  if (separator === -1) {
    return { name: argument.slice(2), value: true };
  }
  const name = argument.slice(2, separator);
  const value = argument.slice(separator + 1);
  if (!name || !value) fail('QA_CLI_OPTION_INVALID', argument);
  return { name, value };
}

export function parseEntropyQaArgs(argv) {
  if (argv.length === 0) {
    return Object.freeze({ command: 'help', topic: null, options: Object.freeze({}) });
  }
  if (argv[0] === '--help' || argv[0] === '-h') {
    if (argv.length !== 1) fail('QA_CLI_HELP_POSITIONAL_INVALID');
    return Object.freeze({ command: 'help', topic: null, options: Object.freeze({}) });
  }
  if (
    COMMANDS.has(argv[0])
    && argv.slice(1).some((argument) => argument === '--help' || argument === '-h')
  ) {
    return Object.freeze({
      command: 'help',
      topic: argv[0] === 'help' ? null : argv[0],
      options: Object.freeze({}),
    });
  }
  const [command, ...rest] = argv;
  if (!COMMANDS.has(command)) fail('QA_CLI_COMMAND_INVALID', command || 'missing');
  const positionals = [];
  const options = {};
  rest.forEach((argument) => {
    if (!argument.startsWith('--')) {
      positionals.push(argument);
      return;
    }
    const parsed = parseLongOption(argument);
    let { name, value } = parsed;
    if (name.startsWith('no-') && value === true) {
      name = name.slice(3);
      value = false;
    }
    assignOnce(options, name, value, 'QA_CLI_OPTION_DUPLICATE');
  });
  if (command === 'help') {
    const [topic, ...unexpected] = positionals;
    if (unexpected.length > 0 || Object.keys(options).length > 0) {
      fail('QA_CLI_HELP_POSITIONAL_INVALID');
    }
    return Object.freeze({
      command,
      topic: topic || null,
      options: Object.freeze({}),
    });
  }
  if (command === 'artifact') {
    return parseQaArtifactCommand(positionals, options);
  }
  if (command === 'explore') return parseQaExplorationCommand(positionals, options);
  if (command === 'report') {
    if (positionals.length !== 1) {
      fail('QA_CLI_POSITIONAL_INVALID', command);
    }
    for (const name of Object.keys(options)) {
      if (name !== 'json') fail('QA_CLI_OPTION_UNKNOWN', name);
    }
    if (Object.hasOwn(options, 'json') && typeof options.json !== 'boolean') {
      fail('QA_CLI_OPTION_VALUE_INVALID', 'json');
    }
    return Object.freeze({
      command,
      ...(command === 'report' ? { runId: positionals[0] } : {}),
      options: Object.freeze(options),
    });
  }
  if (command === 'recovery') {
    const [recoveryCommand, runId, ...unexpected] = positionals;
    if (
      !['inspect', 'recover'].includes(recoveryCommand)
      || unexpected.length > 0
      || (recoveryCommand === 'inspect' && runId !== undefined)
      || (recoveryCommand === 'recover' && !runId)
    ) {
      fail('QA_CLI_RECOVERY_COMMAND_INVALID', recoveryCommand || 'missing');
    }
    const allowed = new Set(['json']);
    Object.keys(options).forEach((name) => {
      if (!allowed.has(name)) fail('QA_CLI_OPTION_UNKNOWN', name);
    });
    return Object.freeze({
      command,
      recoveryCommand,
      runId: runId || null,
      options: Object.freeze(options),
    });
  }
  if (command === 'retention') {
    return parseQaRetentionCommand(positionals, options);
  }
  if (command === 'browser') {
    const [browserCommand, environmentId, ...unexpected] = positionals;
    if (![
      'inventory',
      'status',
      'start',
      'ensure',
      'stop',
      'open',
      'page',
      'shortcut',
    ].includes(browserCommand)) {
      fail('QA_CLI_BROWSER_COMMAND_INVALID', browserCommand || 'missing');
    }
    const allowed = new Set(browserCommand === 'shortcut'
      ? ['json']
      : [
        'config',
        'json',
        ...(['start', 'ensure', 'open', 'page'].includes(browserCommand)
          ? ['timeout-ms']
          : []),
        ...(browserCommand === 'page' ? ['url'] : []),
      ]);
    Object.keys(options).forEach((name) => {
      if (!allowed.has(name)) fail('QA_CLI_OPTION_UNKNOWN', name);
    });
    if (
      browserCommand === 'page'
      && Object.hasOwn(options, 'url')
      && typeof options.url !== 'string'
    ) {
      fail('QA_CLI_OPTION_VALUE_REQUIRED', 'url');
    }
    if (browserCommand === 'shortcut') {
      if (!['install', 'validate'].includes(environmentId) || unexpected.length > 0) {
        fail('QA_CLI_BROWSER_SHORTCUT_ACTION_INVALID', environmentId || 'missing');
      }
      return Object.freeze({
        command,
        browserCommand,
        shortcutAction: environmentId,
        environmentId: null,
        options: Object.freeze(options),
      });
    }
    if (
      (browserCommand === 'inventory' && environmentId !== undefined)
      || (browserCommand !== 'inventory' && !environmentId)
      || unexpected.length > 0
    ) {
      fail('QA_CLI_BROWSER_POSITIONAL_INVALID', positionals.join(':'));
    }
    return Object.freeze({
      command,
      browserCommand,
      environmentId: environmentId || null,
      options: Object.freeze(options),
    });
  }
  if (command === 'list') {
    if (positionals.length > 0) fail('QA_CLI_POSITIONAL_UNEXPECTED', positionals[0]);
    const allowed = new Set(['json', 'family']);
    Object.keys(options).forEach((name) => {
      if (!allowed.has(name)) fail('QA_CLI_OPTION_UNKNOWN', name);
    });
    return Object.freeze({ command, options: Object.freeze(options) });
  }
  if (command === 'setup') {
    const invocation = resolveQaHumanSetupInvocation(positionals);
    ['mode', 'site', 'presentation'].forEach((name) => {
      if (Object.hasOwn(options, name)) {
        fail('QA_CLI_SETUP_OPTION_FORBIDDEN', name);
      }
    });
    return Object.freeze({
      command,
      targetId: invocation.targetId,
      featureId: invocation.featureId,
      siteId: invocation.siteId,
      options: Object.freeze(options),
    });
  }
  if (positionals.length !== 1) {
    fail('QA_CLI_TARGET_REQUIRED', command);
  }
  const targetId = positionals[0];
  if (command === 'describe') {
    const allowed = new Set(['json']);
    Object.keys(options).forEach((name) => {
      if (!allowed.has(name)) fail('QA_CLI_OPTION_UNKNOWN', name);
    });
  }
  if (command === 'doctor') {
    // Target-owned parameters are validated by the same compiler as `run`.
  }
  return Object.freeze({
    command,
    targetId,
    options: Object.freeze(options),
  });
}

async function resolveSetupInput(parsed, rootDir) {
  const { getQaTarget } = await import('./catalog/qaTargetRegistry.mjs');
  const target = getQaTarget(parsed.targetId);
  if (!target.operatorHandoffPolicy) {
    fail('QA_HUMAN_SETUP_TARGET_POLICY_REQUIRED', target.id);
  }
  const options = { ...parsed.options };
  const configPath = resolveConfigPath(options.config, rootDir);
  delete options.config;
  delete options.json;
  return Object.freeze({
    target,
    mode: 'human',
    configPath,
    rawParameters: Object.freeze({
      ...options,
      site: parsed.siteId,
      presentation: 'foreground',
    }),
  });
}

function resolveConfigPath(value, rootDir) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !path.isAbsolute(value)) {
    fail('QA_LOCAL_CONFIG_ABSOLUTE_PATH_REQUIRED');
  }
  return path.normalize(value);
}

async function resolveRunInput(parsed, rootDir) {
  const { getQaTarget } = await import('./catalog/qaTargetRegistry.mjs');
  const target = getQaTarget(parsed.targetId);
  const options = { ...parsed.options };
  // Agent is the public CLI default. The compiler still validates supported modes.
  const mode = options.mode === undefined ? 'agent' : options.mode;
  delete options.mode;
  const configPath = resolveConfigPath(options.config, rootDir);
  delete options.config;
  delete options.json;
  if (typeof mode !== 'string') fail('QA_RUN_MODE_REQUIRED');
  return Object.freeze({
    target,
    mode,
    configPath,
    rawParameters: Object.freeze(options),
  });
}

export async function runQaTarget({
  rootDir = QA_ROOT_DIR,
  targetId,
  mode,
  rawParameters = {},
  configPath = null,
  runId = null,
  signal = null,
  doctorOptions = {},
  operatorHandoffAuthorized = false,
  onCompiled = null,
} = {}) {
  if (onCompiled !== null && typeof onCompiled !== 'function') {
    fail('QA_RUN_COMPILED_LISTENER_INVALID');
  }
  const { compileQaRun } = await import('./runtime/QaRunCompiler.mjs');
  const plan = await compileQaRun({
    rootDir,
    targetId,
    mode,
    rawParameters,
    configPath,
    runId,
  });
  if (plan.operatorHandoffPolicy && operatorHandoffAuthorized !== true) {
    fail('QA_OPERATOR_HANDOFF_COMMAND_REQUIRED', plan.targetId);
  }
  if (onCompiled !== null) {
    await onCompiled(Object.freeze({
      runId: plan.runId,
      targetId: plan.targetId,
      mode: plan.mode,
      environmentId: plan.environment === null ? null : plan.environment.id,
      runRoot: plan.runRoot,
    }));
  }
  const { inspectQaEvidenceRetention } = await import('./evidence/qaEvidenceRetention.mjs');
  const retention = await inspectQaEvidenceRetention({ rootDir });
  if (retention.status === 'ATTENTION') fail('QA_EVIDENCE_RETENTION_INSPECTION_UNSAFE');
  if (retention.totals.bytes > retention.policy.maxBytes) {
    fail('QA_EVIDENCE_BUDGET_EXCEEDED', 'Run npm run qa -- retention prune; inspect pinned or incomplete runs if still over budget');
  }
  const { runQaSession } = await import('./runtime/QaRunSession.mjs');
  return runQaSession(plan, {
    signal,
    doctorOptions,
    operatorHandoffAuthorized,
  });
}

function statusExitCode(status) {
  if (status === QA_RUN_STATUSES.PASS) return 0;
  if (status === QA_RUN_STATUSES.BLOCKED) return 2;
  if (status === QA_RUN_STATUSES.INCONCLUSIVE) return 3;
  return 1;
}

function resolveBrowserStartupTimeout(value) {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !/^\d+$/u.test(value)) {
    fail('QA_CLI_BROWSER_TIMEOUT_INVALID', String(value));
  }
  const timeoutMs = Number(value);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    fail('QA_CLI_BROWSER_TIMEOUT_INVALID', value);
  }
  return timeoutMs;
}

export async function executeEntropyQaCommand(parsed, {
  rootDir = QA_ROOT_DIR,
  signal = null,
} = {}) {
  if (parsed.command === 'help') {
    process.stdout.write(renderEntropyQaHelp(parsed.topic));
    return Object.freeze({ exitCode: 0, topic: parsed.topic });
  }
  if (parsed.command === 'list') {
    const { listQaTargets } = await import('./catalog/qaTargetRegistry.mjs');
    if (
      Object.prototype.hasOwnProperty.call(parsed.options, 'family')
      && typeof parsed.options.family !== 'string'
    ) {
      fail('QA_CLI_OPTION_VALUE_REQUIRED', 'family');
    }
    const family = parsed.options.family || null;
    const targets = listQaTargets().filter((target) => (
      !family || target.family === family
    ));
    if (family && targets.length === 0) fail('QA_TARGET_FAMILY_UNKNOWN', family);
    printQaTargetList(targets, parsed.options.json === true);
    return Object.freeze({ exitCode: 0, targets });
  }
  if (parsed.command === 'artifact') {
    const { executeQaArtifactCommand } = await import('./cli/qaArtifactCommand.mjs');
    return executeQaArtifactCommand(parsed, { rootDir });
  }
  if (parsed.command === 'explore') {
    const { executeQaExplorationCommand } = await import('./cli/qaExplorationCommand.mjs');
    return executeQaExplorationCommand(parsed, { rootDir, signal });
  }
  if (parsed.command === 'report') {
    const { readQaRunReport, renderQaRunReport } = await import('./evidence/qaRunReport.mjs');
    const summary = await readQaRunReport({ rootDir, runId: parsed.runId });
    process.stdout.write(parsed.options.json === true
      ? JSON.stringify(summary, null, 2) + '\n'
      : renderQaRunReport(summary));
    return Object.freeze({ exitCode: statusExitCode(summary.status), summary });
  }
  if (parsed.command === 'browser') {
    if (parsed.browserCommand === 'shortcut') {
      const { runEntropyQaDesktopShortcutAction } = await import('./desktop/entropyQaDesktopShortcut.mjs');
      const result = await runEntropyQaDesktopShortcutAction({
        operation: parsed.shortcutAction,
      });
      printQaDesktopShortcut(result, parsed.options.json === true);
      return Object.freeze({ exitCode: 0, result });
    }
    const configPath = resolveConfigPath(parsed.options.config, rootDir);
    const commonOptions = {
      rootDir,
      configPath,
      requireConfig: parsed.options.config !== undefined,
    };
    if (parsed.browserCommand === 'inventory') {
      const { readQaBrowserInventory } = await import('./environment/qaBrowserInventory.mjs');
      const inventory = await readQaBrowserInventory(commonOptions);
      printQaBrowserInventory(inventory, parsed.options.json === true);
      return Object.freeze({ exitCode: 0, inventory });
    }
    if (parsed.browserCommand === 'status') {
      const { readQaBrowserStatus } = await import('./environment/qaBrowserInventory.mjs');
      const result = await readQaBrowserStatus({
        ...commonOptions,
        environmentId: parsed.environmentId,
      });
      printQaBrowserStatus(result, parsed.options.json === true);
      return Object.freeze({
        exitCode: result.status === 'READY' ? 0 : 2,
        result,
      });
    }
    const { DEFAULT_QA_LOCAL_CONFIG_RELATIVE_PATH, loadQaConfigForRoot } = await import('./runtime/QaRunCompiler.mjs');
    const { resolveQaBrowserEnvironment } = await import('./environment/qaLocalConfig.mjs');
    const resolvedConfigPath = configPath || path.join(
      rootDir,
      DEFAULT_QA_LOCAL_CONFIG_RELATIVE_PATH,
    );
    const config = await loadQaConfigForRoot({
      rootDir,
      configPath: resolvedConfigPath,
      requireExisting: true,
    });
    const environment = resolveQaBrowserEnvironment(
      parsed.environmentId,
      config,
      { required: false },
    );
    if (!environment) fail('QA_BROWSER_ENVIRONMENT_UNKNOWN', parsed.environmentId);
    const lifecycleOptions = {
      rootDir,
      environment,
      browserResources: config.browserResources,
      signal,
      startupTimeoutMs: resolveBrowserStartupTimeout(parsed.options['timeout-ms']),
    };
    let result;
    if (parsed.browserCommand === 'open' || parsed.browserCommand === 'page') {
      const { openQaManagedBrowserPage, openQaManagedBrowserWindow } = await import('./browser/qaOperatorBrowserWindow.mjs');
      result = parsed.browserCommand === 'open'
        ? await openQaManagedBrowserWindow(lifecycleOptions)
        : await openQaManagedBrowserPage({
          ...lifecycleOptions,
          url: Object.hasOwn(parsed.options, 'url')
            ? parsed.options.url
            : 'about:blank',
        });
    } else {
      const { runQaManagedPersistentBrowserAction } = await import('./browser/qaPersistentBrowserLifecycle.mjs');
      result = await runQaManagedPersistentBrowserAction({
        ...lifecycleOptions,
        action: parsed.browserCommand,
      });
    }
    printQaBrowserLifecycle(result, parsed.options.json === true);
    return Object.freeze({ exitCode: 0, result });
  }
  if (parsed.command === 'recovery') {
    if (parsed.recoveryCommand === 'recover') {
      const { recoverQaRun } = await import('./recovery/qaRecoveryRunner.mjs');
      const recovery = await recoverQaRun({
        rootDir,
        runId: parsed.runId,
      });
      printQaRecoveryResult(recovery, parsed.options.json === true);
      return Object.freeze({ exitCode: 0, recovery });
    }
    const { inspectQaRecoveryState } = await import('./recovery/qaRecoveryInspector.mjs');
    const inspection = await inspectQaRecoveryState({ rootDir });
    printQaRecoveryInspection(inspection, parsed.options.json === true);
    return Object.freeze({
      exitCode: inspection.status === 'CLEAN' ? 0 : 2,
      inspection,
    });
  }
  if (parsed.command === 'retention') {
    if (parsed.retentionCommand !== 'inspect') {
      const { pruneQaEvidence, setQaEvidencePin } = await import('./evidence/qaEvidencePruner.mjs');
      const result = parsed.retentionCommand === 'prune'
        ? await pruneQaEvidence({ rootDir })
        : await setQaEvidencePin({ rootDir, runId: parsed.runId,
          pinned: parsed.retentionCommand === 'pin', reason: parsed.options.reason });
      printQaRetentionMutation(parsed.retentionCommand, result, parsed.options.json === true);
      return Object.freeze({ exitCode: result.status === 'READY' ? 0 : 2, result });
    }
    const { inspectQaEvidenceRetention } = await import('./evidence/qaEvidenceRetention.mjs');
    const inspection = await inspectQaEvidenceRetention({ rootDir });
    printQaRetentionInspection(inspection, parsed.options.json === true);
    return Object.freeze({
      exitCode: inspection.status === 'READY' ? 0 : 2,
      inspection,
    });
  }
  if (parsed.command === 'setup') {
    const input = await resolveSetupInput(parsed, rootDir);
    process.stdout.write(JSON.stringify({
      event: 'QA_HUMAN_SETUP_REQUESTED',
      targetId: input.target.id,
      featureId: parsed.featureId,
      siteId: parsed.siteId,
      mode: input.mode,
    }) + '\n');
    const report = await runQaTarget({
      rootDir,
      targetId: input.target.id,
      mode: input.mode,
      rawParameters: input.rawParameters,
      configPath: input.configPath,
      signal,
      operatorHandoffAuthorized: true,
    });
    process.stdout.write(JSON.stringify({
      event: 'QA_HUMAN_SETUP_ENDED',
      runId: report.runId,
      targetId: report.targetId,
      status: report.status,
    }) + '\n');
    return Object.freeze({
      exitCode: statusExitCode(report.status),
      report,
    });
  }
  if (parsed.command === 'describe') {
    const { getQaTarget } = await import('./catalog/qaTargetRegistry.mjs');
    const target = getQaTarget(parsed.targetId);
    printQaTargetDescription(target, parsed.options.json === true);
    return Object.freeze({ exitCode: 0, target });
  }
  if (parsed.command === 'doctor') {
    const input = await resolveRunInput(parsed, rootDir);
    const [
      { compileQaRun },
      { inspectQaEnvironment },
      { inspectQaArtifactRequirement },
      { requiresBrowserNoFocusBaselinePage },
      { allowsQaInitialWindowFocusOnce, resolveQaInitialWindowFocusPolicy },
    ] = await Promise.all([
      import('./runtime/QaRunCompiler.mjs'),
      import('./environment/qaDoctor.mjs'),
      import('./resources/QaArtifactLease.mjs'),
      import('../browser-qa/contracts/browserExecutionContract.mjs'),
      import('./contracts/qaInitialWindowFocusPolicy.mjs'),
    ]);
    const plan = await compileQaRun({
      rootDir,
      targetId: input.target.id,
      mode: input.mode,
      rawParameters: input.rawParameters,
      configPath: input.configPath,
      runId: 'doctor',
    });
    const noFocusExecutionBaselineRequired = requiresBrowserNoFocusBaselinePage(
      plan.browserExecution,
    );
    const operatorHandoffFirstPageAllowed = plan.mode === 'human'
      && plan.operatorHandoffPolicy?.focus === 'operator_request_once'
      && plan.operatorHandoffPolicy?.lifetime === 'until_explicit_cancel'
      && plan.operatorHandoffPolicy?.cleanup === 'exact_owned_targets';
    const noFocusBaselineRequired = noFocusExecutionBaselineRequired
      && !operatorHandoffFirstPageAllowed;
    const initialWindowFocusOnceAllowed = allowsQaInitialWindowFocusOnce(plan);
    const pageTargetInventoryRequired = noFocusExecutionBaselineRequired
      || initialWindowFocusOnceAllowed
      || operatorHandoffFirstPageAllowed;
    const [environment, artifact] = await Promise.all([
      inspectQaEnvironment(plan.environment, {
        allowManagedExtensionSlotBootstrap: plan.environment?.browserClass
          === 'managed_persistent',
        includeCdpTargetCounts: pageTargetInventoryRequired,
        minimumPageTargetCount: noFocusBaselineRequired ? 1 : 0,
      }),
      inspectQaArtifactRequirement(plan),
    ]);
    // Observation cannot grant this run's future managed-process start. An
    // existing browser keeps its no-focus baseline even with an old true flag.
    const initialWindowBootstrapRequired = false;
    const initialWindowFocusScope = plan.browserExecution?.headless === true
      ? 'none'
      : plan.environment?.processOwnership === 'owned'
        ? 'new_owned_process_started_by_same_run_only'
        : plan.environment?.lifecyclePolicy === 'managed'
          ? 'new_managed_process_started_by_same_run_only'
          : 'none';
    const initialWindowFocusReason = plan.browserExecution?.headless === true
      ? 'headless_no_window'
      : plan.environment?.processOwnership === 'owned'
        ? 'observation_cannot_grant_new_owned_process_presentation'
        : plan.environment?.lifecyclePolicy !== 'managed'
          ? 'external_process_focus_not_admitted'
          : environment.checks?.cdp?.status === 'ready'
            ? 'existing_process_attach_no_focus'
            : 'observation_cannot_grant_new_managed_process_presentation';
    const operatorWindowBootstrapRequired = operatorHandoffFirstPageAllowed
      && environment.checks?.cdp?.targetCounts?.page === 0;
    const blocked = environment.status === 'blocked' || artifact.status === 'BLOCKED';
    const result = Object.freeze({
      contractVersion: 2,
      targetId: input.target.id,
      status: blocked ? 'BLOCKED' : 'READY',
      mode: plan.mode,
      lane: plan.lane,
      parameters: plan.parameters,
      browserExecution: plan.browserExecution,
      browserObservation: plan.browserObservation,
      browserConcurrency: plan.browserConcurrency,
      browserCapacityMode: plan.browserCapacityMode,
      environment,
      artifact,
      initialWindowBootstrap: Object.freeze({
        policy: resolveQaInitialWindowFocusPolicy(plan),
        required: initialWindowBootstrapRequired,
        optInRequested: plan.parameters.allowInitialWindowFocusOnce === true,
        scope: initialWindowFocusScope,
        reason: initialWindowFocusReason,
        steadyStateOsFocus: plan.browserExecution?.osFocus || null,
      }),
      operatorHandoff: Object.freeze({
        policy: plan.operatorHandoffPolicy,
        authorizedByCommand: 'setup_only',
        firstPageRequired: operatorWindowBootstrapRequired,
        steadyStateOsFocus: plan.browserExecution?.osFocus || null,
      }),
      resourceClaims: plan.resourceClaims,
      nextAction: blocked
        ? environment.failures.includes('no_focus_baseline_page_missing')
          ? 'open_one_tab_in_declared_qa_browser_then_retry'
          : 'repair_reported_contract'
        : operatorWindowBootstrapRequired && artifact.status === 'BUILD_REQUIRED'
          ? 'setup_will_create_focus_first_page_and_build_artifact'
          : operatorWindowBootstrapRequired
            ? 'setup_will_create_and_focus_first_page'
            : artifact.status === 'BUILD_REQUIRED'
              ? 'run_will_build_artifact'
              : artifact.status === 'DEFERRED'
                ? 'run_child_protocol_owns_artifacts'
                : 'run_with_same_arguments',
    });
    printQaDoctorResult(result, parsed.options.json === true);
    return Object.freeze({
      exitCode: result.status === 'READY' ? 0 : 2,
      result,
    });
  }
  const input = await resolveRunInput(parsed, rootDir);
  if (input.target.operatorHandoffPolicy) {
    fail('QA_OPERATOR_HANDOFF_COMMAND_REQUIRED', input.target.id);
  }
  process.stdout.write(JSON.stringify({
    event: 'QA_RUN_REQUESTED',
    targetId: input.target.id,
    mode: input.mode,
  }) + '\n');
  const report = await runQaTarget({
    rootDir,
    targetId: input.target.id,
    mode: input.mode,
    rawParameters: input.rawParameters,
    configPath: input.configPath,
    signal,
    onCompiled: (receipt) => {
      process.stdout.write(JSON.stringify({ event: 'QA_RUN_COMPILED', ...receipt }) + '\n');
    },
  });
  process.stdout.write(JSON.stringify({
    event: 'QA_RUN_COMPLETE',
    runId: report.runId,
    targetId: report.targetId,
    status: report.status,
  }) + '\n');
  // A summary is presentation-only: its failure cannot rewrite the run verdict.
  try {
    const { readQaRunReport, renderQaRunReport } = await import('./evidence/qaRunReport.mjs');
    process.stdout.write(renderQaRunReport(await readQaRunReport({ rootDir, runId: report.runId })));
  } catch (error) {
    process.stderr.write(`[entropy-qa] QA_REPORT_UNAVAILABLE:${error.message}\n`);
  }
  return Object.freeze({
    exitCode: statusExitCode(report.status),
    report,
  });
}

async function main() {
  const parsed = parseEntropyQaArgs(process.argv.slice(2));
  const signalCoordinator = createQaSignalCoordinator();
  try {
    const result = await executeEntropyQaCommand(parsed, {
      signal: signalCoordinator.signal,
    });
    process.exitCode = result.exitCode;
  } finally {
    signalCoordinator.dispose();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    const status = classifyQaErrorStatus(error);
    if (isEntropyQaUsageError(error)) {
      process.stderr.write(`[entropy-qa] ${formatEntropyQaUsageError(error)}`);
    } else {
      process.stderr.write(
        `[entropy-qa] ${status} ${error?.stack || error?.message || error}\n`,
      );
      printQaBrowserStartupDiagnostics(error);
    }
    process.exitCode = statusExitCode(status);
  });
}
