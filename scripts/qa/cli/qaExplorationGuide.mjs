import path from 'node:path';
import { readQaBrowserStatus } from '../environment/qaBrowserInventory.mjs';
import { readQaExplorationEnvironment } from '../exploration/qaExplorationEnvironment.mjs';
import { readQaExplorationReadiness } from '../exploration/qaExplorationReadiness.mjs';

// Inspection owns no persistent lease, browser mutation, or named QA verdict.
export async function readQaExplorationGuide({ rootDir, comparison = null,
  environmentReader = readQaExplorationEnvironment, browserStatusReader = readQaBrowserStatus,
  readinessReader = readQaExplorationReadiness, inspectPin = null } = {}) {
  if (comparison !== null && comparison !== 'regular-chrome') throw new Error('QA_EXPLORATION_COMPARISON_INVALID');
  const environment = await environmentReader({ rootDir });
  const [status, readiness] = await Promise.all([
    browserStatusReader({ rootDir, environmentId: 'authenticated', requireConfig: true }),
    readinessReader({ rootDir }),
  ]);
  if (status.environmentId !== environment.id || status.environment.profileSlotId !== environment.profileSlotId
    || status.environment.chrome !== environment.chrome || status.environment.profile !== environment.profile
    || status.environment.profileDirectory !== environment.profileDirectory
    || status.environment.cdpEndpoint !== environment.cdpEndpoint) {
    throw new Error('QA_EXPLORATION_STATUS_IDENTITY_CHANGED');
  }
  let comparisonArtifact = null;
  if (comparison === 'regular-chrome') {
    const inspect = inspectPin || (await import('../../dev/devExtensionArtifactPublisher.mjs')).inspectDevExtensionRealUsePin;
    const artifact = await inspect(rootDir);
    comparisonArtifact = Object.freeze({ role: 'regular_chrome_comparison_dist_pin',
      state: artifact.state, consumerDir: artifact.consumerDir, latestDir: artifact.latestDir,
      validation: artifact.state === 'pinned' ? 'pinned_bytes_verified' : 'unpinned_dist_not_verified',
      ...(artifact.state === 'pinned' ? { buildId: artifact.buildId, pinId: artifact.pinId,
        inputDigest: artifact.inputDigest, artifactDigest: artifact.artifactDigest } : {}) });
  }
  return Object.freeze({
    kind: 'exploration_guide',
    namedQaVerdict: null,
    browser: 'Chrome for Testing: authenticated (manual and automated QA)',
    identityContract: path.join(rootDir, 'docs/operations/runbooks/windows-native-development.md'),
    workflow: path.join(rootDir, 'docs/operations/qa/agent-qa-workflow.md'),
    status: status.status, declaredIdentity: status.environment,
    observedIdentity: status.runtime?.identity || null,
    resourceUse: status.broker, nextPreparationAction: status.nextAction,
    readiness, liveBuildProved: false, comparisonArtifact,
    steps: Object.freeze([
      'Use qa:open / qa:reload for preparation when needed, then refresh the tested site.',
      'Run qa explore start and keep its runner alive to reserve this exact profile during connected UI exploration.',
      'Verify the exact connected CfT profile/tab against the runbook once per connection; the CLI cannot prove that UI connection.',
      'Reproduce through the existing browser tool and record actions, observation and uncertainty with qa explore note <session-id>.',
      'Press Ctrl-C in the exploration runner to release only its leases; read evidence with qa explore show <session-id>.',
    ]),
    nextAction: 'A previous reload receipt is historical context, not current live-build proof. Exploration observations have no named QA verdict.',
  });
}

export function renderQaExplorationGuide(guide) {
  const readiness = guide.readiness;
  return [
    guide.browser,
    `Current browser: ${guide.status}; resource: ${guide.resourceUse.status}`,
    `Declared profile: ${guide.declaredIdentity.profileSlotId} / ${guide.declaredIdentity.profileDirectory}`,
    `CLI identity: ${guide.observedIdentity?.status || 'not_verified'}; connected UI: verify exact profile/tab`,
    `Reload evidence: ${readiness.status}${readiness.runId ? ` / ${readiness.runId}` : ''}${readiness.buildId ? ` / ${readiness.buildId}` : ''}; current live build: not proved`,
    ...(guide.comparisonArtifact ? [`Regular Chrome comparison dist: ${guide.comparisonArtifact.state} (${guide.comparisonArtifact.validation})`,
      ...(guide.comparisonArtifact.pinId ? [`Pin: ${guide.comparisonArtifact.pinId}`] : [])] : []),
    ...guide.steps.map((step, index) => `${index + 1}. ${step}`),
    guide.nextAction,
    `Guide: ${guide.workflow}`,
    `Identity: ${guide.identityContract}`,
  ].join('\n') + '\n';
}
