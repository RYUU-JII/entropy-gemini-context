const RUN_ID = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,159})$/u;

export function requireQaRetentionRunId(runId) {
  if (typeof runId !== 'string' || !RUN_ID.test(runId)) {
    throw new Error('QA_CLI_RETENTION_RUN_ID_INVALID');
  }
  return runId;
}

export function parseQaRetentionCommand(positionals, options) {
  const [retentionCommand, runId, ...extra] = positionals;
  const pinAction = ['pin', 'unpin'].includes(retentionCommand);
  if (!['inspect', 'prune', 'pin', 'unpin'].includes(retentionCommand)
    || extra.length || (!pinAction && runId !== undefined)) {
    throw new Error('QA_CLI_RETENTION_COMMAND_INVALID');
  }
  if (pinAction) requireQaRetentionRunId(runId);
  for (const name of Object.keys(options)) {
    if (name !== 'json' && !(retentionCommand === 'pin' && name === 'reason')) {
      throw new Error(`QA_CLI_OPTION_UNKNOWN:${name}`);
    }
  }
  if (Object.hasOwn(options, 'json') && typeof options.json !== 'boolean') {
    throw new Error('QA_CLI_OPTION_VALUE_INVALID:json');
  }
  if (retentionCommand === 'pin'
    && (typeof options.reason !== 'string' || !options.reason.trim() || options.reason.length > 1000)) {
    throw new Error('QA_CLI_OPTION_VALUE_REQUIRED:reason');
  }
  return Object.freeze({ command: 'retention', retentionCommand,
    runId: pinAction ? runId : null, options: Object.freeze(options) });
}
