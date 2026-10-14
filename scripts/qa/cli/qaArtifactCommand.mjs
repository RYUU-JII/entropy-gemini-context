import {
  inspectDevExtensionRealUsePin,
  pinDevExtensionForRealUse,
  releaseDevExtensionRealUsePin,
} from '../../dev/devExtensionArtifactPublisher.mjs';

const ACTIONS = Object.freeze({
  status: inspectDevExtensionRealUsePin,
  pin: pinDevExtensionForRealUse,
  release: releaseDevExtensionRealUsePin,
});

export { parseQaArtifactCommand } from './qaArtifactArgs.mjs';

function renderReceipt(receipt) {
  const lines = [`Artifact ${receipt.action}: ${receipt.state}`,
    `Consumer: ${receipt.consumerDir}`, `Latest: ${receipt.latestDir}`];
  if (receipt.pinId) lines.push(`Pin: ${receipt.pinId}`, `Build: ${receipt.buildId}`);
  if (receipt.promotedBuildId) lines.push(`Promoted build: ${receipt.promotedBuildId}`);
  if (receipt.reloadRequired) {
    lines.push('Reload Entropy in the existing Entropy QA profile and refresh tested site tabs.');
  }
  return lines.join('\n') + '\n';
}

export async function executeQaArtifactCommand(parsed, {
  rootDir,
  actions = ACTIONS,
  write = (text) => process.stdout.write(text),
} = {}) {
  if (parsed.command !== 'artifact' || !Object.hasOwn(ACTIONS, parsed.artifactCommand)) {
    throw new Error('QA_CLI_ARTIFACT_COMMAND_INVALID');
  }
  const result = parsed.artifactCommand === 'release'
    ? await actions.release(rootDir, { pinId: parsed.options['pin-id'] })
    : await actions[parsed.artifactCommand](rootDir);
  write(parsed.options.json === true
    ? JSON.stringify(result, null, 2) + '\n'
    : renderReceipt(result));
  return Object.freeze({ exitCode: 0, result });
}
