function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

export function parseQaExplorationCommand(positionals, options) {
  const action = positionals[0] || 'inspect';
  if (!['inspect', 'start', 'note', 'show', 'recover'].includes(action)) {
    fail('QA_CLI_EXPLORATION_ACTION_INVALID', action);
  }
  const sessionAction = ['note', 'show', 'recover'].includes(action);
  if (positionals.length !== (sessionAction ? 2 : action === 'inspect' ? 0 : 1)) {
    fail('QA_CLI_POSITIONAL_INVALID', 'explore');
  }
  const allowed = action === 'note'
    ? new Set(['json', 'actions', 'observation', 'uncertainty'])
    : action === 'inspect' ? new Set(['json', 'comparison']) : new Set(['json']);
  for (const key of Object.keys(options)) {
    if (!allowed.has(key)) fail('QA_CLI_OPTION_UNKNOWN', key);
  }
  if (Object.hasOwn(options, 'json') && typeof options.json !== 'boolean') {
    fail('QA_CLI_OPTION_VALUE_INVALID', 'json');
  }
  if (Object.hasOwn(options, 'comparison') && options.comparison !== 'regular-chrome') {
    fail('QA_CLI_OPTION_VALUE_INVALID', 'comparison');
  }
  if (sessionAction && !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$/u.test(positionals[1])) {
    fail('QA_CLI_EXPLORATION_SESSION_ID_INVALID');
  }
  if (action === 'note') {
    for (const key of ['actions', 'observation', 'uncertainty']) {
      if (typeof options[key] !== 'string' || !options[key].trim() || options[key].length > 4_000) {
        fail('QA_CLI_OPTION_VALUE_INVALID', key);
      }
    }
  }
  return Object.freeze({ command: 'explore', explorationAction: action,
    ...(sessionAction ? { sessionId: positionals[1] } : {}),
    options: Object.freeze(options) });
}
