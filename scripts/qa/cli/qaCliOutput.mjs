import { serializeQaError } from '../contracts/qaEvidenceContract.mjs';

export function printQaBrowserStartupDiagnostics(error) {
  const evidence = serializeQaError(error).startupEvidence;
  if (evidence) {
    process.stderr.write(JSON.stringify({ event: 'QA_BROWSER_STARTUP_DIAGNOSTICS', ...evidence }) + '\n');
  }
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printQaTargetList(targets, json) {
  if (json) {
    writeJson(targets);
    return;
  }
  targets.forEach((target) => {
    process.stdout.write(
      `${target.id}\t${target.lane}\t${target.supportedModes.join(',')}\t${target.title}\n`,
    );
  });
}

export function printQaTargetDescription(target, json) {
  if (json) {
    writeJson(target);
    return;
  }
  const lines = [
    `${target.id} — ${target.title}`,
    `Modes: ${target.supportedModes.join(', ')} | Environment: ${target.environmentId || 'none'}`,
    `Artifact: ${target.artifactId || 'source'} | Protocol: ${target.protocolId}`,
  ];
  if (target.concurrency) lines.push(`Declared concurrency: ${target.concurrency}`);
  if (target.browserRequirements) {
    const browser = target.browserRequirements;
    lines.push(`Browser: authentication=${browser.authentication} | rendering=${browser.rendering} | hidden=${browser.hiddenAllowed ? 'allowed' : 'forbidden'} | default-presentation=${browser.defaultPresentation}`);
    lines.push(`Page: visibility=${browser.documentVisibility} | activation=${browser.targetActivation} | os-focus=${browser.osFocus} | native-observation=${formatBrowserObservation(target.browserObservation)}`);
    const focus = target.parameters.allowInitialWindowFocusOnce;
    lines.push(focus
      ? `Initial focus: --${focus.cliName}=true is opt-in; default=${JSON.stringify(focus.default)}; only a new process through the declared preparation owner, never refocus an existing process.`
      : 'Initial focus: no run option grants it.');
    if (target.operatorHandoffPolicy) lines.push('Operator handoff: setup command only; one explicit handoff, separate from automated preparation.');
  }
  lines.push('Options:');
  for (const schema of Object.values(target.parameters)) {
    const choices = schema.values ? ` (${schema.values.join(', ')})` : '';
    const defaultValue = Object.hasOwn(schema, 'default') ? `; default=${JSON.stringify(schema.default)}` : '';
    const bounds = schema.type === 'integer' ? ` (${schema.minimum}..${schema.maximum})` : '';
    lines.push(`  --${schema.cliName}: ${schema.type}${choices}${bounds}${defaultValue}${schema.required ? '; required' : ''}`);
  }
  lines.push('Full contract: add --json. Run includes preflight; doctor is optional.');
  process.stdout.write(lines.join('\n') + '\n');
}

function formatBrowserObservation(observation) {
  if (observation === null || observation === undefined) return 'not_requested';
  if (typeof observation === 'string') return observation;
  return `${observation.parameter}(${Object.entries(observation.values).map(([key, value]) => `${key}=${value}`).join(', ')})`;
}

export function printQaDoctorResult(result, json) {
  if (json) {
    writeJson(result);
    return;
  }
  process.stdout.write([
    result.targetId,
    result.status,
    `mode=${result.mode}`,
    `environment=${result.environment.environmentId || 'not_required'}`,
    `artifact=${result.artifact.action}`,
    `initial-window-policy=${result.initialWindowBootstrap?.policy || 'not_required'}`,
    `initial-window-required=${result.initialWindowBootstrap?.required === true}`,
  ].join('\t') + '\n');
  if (result.browserExecution) {
    const browser = result.browserExecution;
    process.stdout.write(`browser process=${browser.processOwnership} | headless=${JSON.stringify(browser.headless)} | presentation=${browser.presentation} | visibility=${browser.documentVisibility} | activation=${browser.targetActivation} | os-focus=${browser.osFocus} | native-observation=${formatBrowserObservation(result.browserObservation)}\n`);
    const focus = Object.hasOwn(result.parameters, 'allowInitialWindowFocusOnce')
      ? result.parameters.allowInitialWindowFocusOnce : 'not_applicable';
    process.stdout.write(`initial-focus-opt-in=${focus}; existing processes are never refocused by preparation.\n`);
    if (result.initialWindowBootstrap?.scope) process.stdout.write(`initial-focus-scope=${result.initialWindowBootstrap.scope} | reason=${result.initialWindowBootstrap.reason}\n`);
  }
  if (result.browserConcurrency) process.stdout.write(`browser-concurrency=${result.browserConcurrency} | capacity=${result.browserCapacityMode}\n`);
  if (result.environment.failures?.length > 0) {
    process.stdout.write(`environment_failures=${result.environment.failures.join(',')}\n`);
  }
  if (result.artifact.reasonCode) {
    process.stdout.write(`artifact_reason=${result.artifact.reasonCode}\n`);
  }
  if (result.artifact.repair) {
    process.stdout.write(`artifact_path=${result.artifact.repair.path}\n`);
    result.artifact.repair.instructions.forEach((instruction, index) => {
      process.stdout.write(`repair_${index + 1}=${instruction}\n`);
    });
  }
  process.stdout.write(`next=${result.nextAction}\n`);
}

export function printQaRecoveryInspection(result, json) {
  if (json) {
    writeJson(result);
    return;
  }
  process.stdout.write([
    'recovery',
    result.status,
    `terminal=${result.terminalRunCount}`,
    `historical-terminal=${result.historicalTerminalRunCount}`,
    `recovered=${result.recoveredRunCount}`,
    `incomplete=${result.incompleteRunCount}`,
    `recoverable=${result.manualRecoveryCandidateCount}`,
    `invalid-run-roots=${result.invalidRunRootCount}`,
    `invalid-locks=${result.invalidResourceLockCount}`,
  ].join('\t') + '\n');
  if (result.health) {
    process.stdout.write([
      'recovery-health',
      `active=${result.health.activeRunCount}`,
      `abandoned=${result.health.abandonedRunCount}`,
      `stale=${result.health.staleAbandonedRunCount}`,
      `unresolved=${result.health.unresolvedRunCount}`,
      `absence-proof-required=${result.health.processAbsenceProofRequiredCount}`,
      `locks=${result.health.resourceClaimLockCount}`,
      `oldest-abandoned-ms=${result.health.oldestAbandonedAgeMs}`,
    ].join('\t') + '\n');
  }
  result.incompleteRuns.forEach((run) => {
    process.stdout.write([
      run.runId,
      run.state,
      `locks=${run.resourceClaimLockCount}`,
      `runner=${run.runnerStatus || 'unknown'}`,
      `next=${run.nextAction}`,
    ].join('\t') + '\n');
  });
}

export function printQaRecoveryResult(result, json) {
  if (json) {
    writeJson(result);
    return;
  }
  process.stdout.write([
    'recovery',
    result.status,
    result.runId,
    `process=${result.process?.action || 'not_required'}`,
    `targets=${result.targets.length}`,
    `locks=${result.resourceClaims.length}`,
  ].join('\t') + '\n');
}

export function printQaRetentionMutation(action, result, json) {
  if (json) { writeJson(result); return; }
  const fields = ['retention', action, result.status];
  if (action === 'prune') fields.push(`deleted-runs=${result.deletedRunCount}`,
    `deleted-bytes=${result.deletedBytes}`, `remaining-bytes=${result.totals.bytes}`, result.receiptPath);
  else fields.push(result.runId, `pinned=${result.pinned}`);
  process.stdout.write(fields.join('\t') + '\n');
}

export function printQaRetentionInspection(result, json) {
  if (json) {
    writeJson(result);
    return;
  }
  process.stdout.write([
    'retention',
    result.status,
    'dry-run=true',
    `runs=${result.totals.runCount}`,
    `candidates=${result.totals.candidateRunCount}`,
    `candidate-bytes=${result.totals.candidateBytes}`,
    `protected=${result.totals.protectedRunCount}`,
    `bytes=${result.totals.bytes}`,
    `budget-bytes=${result.totals.budgetBytes}`,
    `projected-bytes=${result.totals.projectedBytes}`,
  ].join('\t') + '\n');
  result.candidates.forEach((run) => {
    process.stdout.write([
      run.runId,
      run.targetId,
      run.status,
      `finished=${run.finishedAt}`,
      `bytes=${run.bytes}`,
    ].join('\t') + '\n');
  });
}

export function printQaBrowserInventory(inventory, json) {
  if (json) {
    writeJson(inventory);
    return;
  }
  inventory.environments.forEach((environment) => {
    process.stdout.write([
      'environment',
      environment.id,
      environment.browserClass,
      environment.processOwnership,
      `broker=${environment.broker?.status || 'unknown'}`,
      environment.chrome || 'playwright_default',
    ].join('\t') + '\n');
  });
  inventory.installations.forEach((installation) => {
    process.stdout.write([
      'installation',
      installation.status,
      installation.platform,
      installation.distribution,
      installation.path,
    ].join('\t') + '\n');
  });
}

export function printQaBrowserStatus(result, json) {
  if (json) {
    writeJson(result);
    return;
  }
  const targetCounts = result.runtime?.targetCounts;
  process.stdout.write([
    result.environmentId,
    result.status,
    result.environment.browserClass,
    result.environment.processOwnership,
    `broker=${result.broker?.status || 'unknown'}`,
    targetCounts ? `pages=${targetCounts.page}` : 'pages=n/a',
    targetCounts ? `about:blank=${targetCounts.aboutBlank}` : 'about:blank=n/a',
    `next=${result.nextAction}`,
  ].join('\t') + '\n');
}

export function printQaBrowserLifecycle(result, json) {
  if (json) {
    writeJson(result);
    return;
  }
  process.stdout.write([
    result.profileSlotId,
    result.status,
    result.lifecycleAction,
    result.windowAction
      ? `window=${result.windowAction}`
      : result.termination
        ? `terminated-pids=${result.termination.pids.join(',') || 'none'}`
        : result.launch
          ? `startup-window=${result.launch.startupWindow}`
          : 'startup-window=n/a',
    ...(result.focus ? [`focus=${result.focus.policy}`] : []),
  ].join('\t') + '\n');
}

export function printQaDesktopShortcut(result, json) {
  if (json) {
    writeJson(result);
    return;
  }
  process.stdout.write([
    'desktop-shortcut',
    result.status,
    `operation=${result.operation}`,
    result.actual.shortcutPath,
  ].join('\t') + '\n');
}
