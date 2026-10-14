// Parsing stays lightweight; artifact IO is loaded only by the chosen command.
const ACTIONS = new Set(['status', 'pin', 'release']);

export function parseQaArtifactCommand(positionals, options) {
  const [artifactCommand, ...unexpected] = positionals;
  if (!ACTIONS.has(artifactCommand) || unexpected.length > 0) {
    throw new Error(`QA_CLI_ARTIFACT_COMMAND_INVALID:${artifactCommand || 'missing'}`);
  }
  const allowed = new Set(artifactCommand === 'release' ? ['json', 'pin-id'] : ['json']);
  for (const name of Object.keys(options)) {
    if (!allowed.has(name)) throw new Error(`QA_CLI_OPTION_UNKNOWN:${name}`);
  }
  if (Object.hasOwn(options, 'json') && typeof options.json !== 'boolean') {
    throw new Error('QA_CLI_OPTION_VALUE_INVALID:json');
  }
  if (artifactCommand === 'release'
    && (typeof options['pin-id'] !== 'string' || !options['pin-id'])) {
    throw new Error('QA_CLI_OPTION_VALUE_REQUIRED:pin-id');
  }
  return Object.freeze({
    command: 'artifact', artifactCommand, options: Object.freeze(options),
  });
}
