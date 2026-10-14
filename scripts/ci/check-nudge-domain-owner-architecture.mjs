#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const nudgeRootPath = 'src/domains/nudge';
const readmePath = `${nudgeRootPath}/README.md`;
const settingsClientPath = `${nudgeRootPath}/nudgeSettingsClient.js`;
const furinDailyPolicyPath = `${nudgeRootPath}/runtime/session/furinDailyPolicy.js`;
const furinPureContractReaders = new Set([
  `${nudgeRootPath}/runtime/goalEpisodeBinding.js`,
  `${nudgeRootPath}/runtime/projectReadyGoalPriority.js`,
]);
const label = 'nudge-domain-owner-architecture';
const sourceExtensions = new Set(['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx']);

const allowedRootImplementationFiles = Object.freeze([
  'inputDelayManager.js',
  'inputVisualBrakeManager.js',
  'interactionManager.js',
  'navigationButtonLockManager.js',
  'nudgeSettingsClient.js',
  'nudgeSwarm.worker.js',
  'textManager.js',
  'textPipeline.js',
  'textShuffleManager.js',
]);

const allowedBoundedContextDirectories = Object.freeze([
  'attention',
  'behavior',
  'core',
  'effects',
  'engine',
  'feed-flow',
  'garden',
  'indicator',
  'input-visual-brake',
  'interaction',
  'koi',
  'media',
  'nudge',
  'protocols',
  'rendering',
  'runtime',
  'runtime-debugger',
  'short-form',
  'targeting',
  'text',
  'video',
  'video-skip',
  'visual',
]);

const forbiddenBroadBarrels = Object.freeze([
  'src/domains/nudge/index.js',
  'src/domains/nudge/runtime/index.js',
  'src/domains/nudge/runtime/session/index.js',
]);

const requiredReadmeHeadings = Object.freeze([
  'Canonical owner map',
  'Public seams',
  'Forbidden boundaries',
  'Change protocol',
]);

const relatedActiveDocs = Object.freeze([
  'docs/architecture/repository/system-structure-implementation-audit.md',
  'docs/architecture/repository/repository-structure-review.md',
  'docs/architecture/repository/friction-nudge-effect-boundary-map.md',
  'docs/architecture/repository/social-metrics-seam-map.md',
  'docs/architecture/repository/nudge-main-runtime-boundary-map.md',
  'docs/architecture/repository/nudge-worker-runtime-boundary-map.md',
  'docs/architecture/runtime/feed-flow-runtime-target-architecture.md',
  'docs/architecture/runtime/usage-flow-evaluation-scenarios.md',
  'docs/architecture/runtime/dom-targeting-runtime-architecture.md',
]);

function fail(message) {
  console.error(`[${label}] FAIL: ${message}`);
  process.exit(1);
}

async function readRequiredFile(relativePath) {
  try {
    return await fs.readFile(path.resolve(rootDir, relativePath), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      fail(`missing required owner contract: ${relativePath}`);
    }
    throw error;
  }
}

function assertReadmeHeadings(readmeSource) {
  for (const heading of requiredReadmeHeadings) {
    const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const headingPattern = new RegExp(`^#{2,6}\\s+${escapedHeading}\\s*$`, 'imu');
    if (!headingPattern.test(readmeSource)) {
      fail(`${readmePath} must include the owner-contract heading "${heading}".`);
    }
  }
}

async function assertRelatedDocsAreActive() {
  for (const relativePath of relatedActiveDocs) {
    const source = await readRequiredFile(relativePath);
    if (!/^- Status:\s*Active\s*$/mu.test(source)) {
      fail(`${relativePath} must remain Active while it governs the nudge owner map.`);
    }
  }
}

async function assertRootInventory() {
  const entries = await fs.readdir(path.resolve(rootDir, nudgeRootPath), {
    withFileTypes: true,
  });
  const actualDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const allowedDirectories = new Set(allowedBoundedContextDirectories);

  for (const directoryName of actualDirectories) {
    if (!allowedDirectories.has(directoryName)) {
      fail(`${nudgeRootPath}/${directoryName}: undeclared bounded-context directory; update ${readmePath} and this guard in the same change.`);
    }
  }

  for (const directoryName of allowedBoundedContextDirectories) {
    if (!actualDirectories.includes(directoryName)) {
      fail(`${nudgeRootPath}/${directoryName}: declared bounded-context directory is missing; update ${readmePath} and this guard with the owner move.`);
    }
  }

  const actualRootFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  const allowedRootFiles = new Set([
    'README.md',
    ...allowedRootImplementationFiles,
  ]);

  for (const fileName of actualRootFiles) {
    if (!allowedRootFiles.has(fileName)) {
      fail(`${nudgeRootPath}/${fileName}: new root implementation is forbidden; place it in a declared bounded context or update the owner contract intentionally.`);
    }
  }

  for (const fileName of allowedRootImplementationFiles) {
    if (!actualRootFiles.includes(fileName)) {
      fail(`${nudgeRootPath}/${fileName}: declared root implementation is missing; update ${readmePath} and this guard with the owner move.`);
    }
  }
}

async function assertBroadBarrelsStayAbsent() {
  for (const relativePath of forbiddenBroadBarrels) {
    try {
      await fs.access(path.resolve(rootDir, relativePath));
      fail(`${relativePath}: broad nudge barrels are forbidden; expose only named bounded-context seams.`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

async function collectSourceFiles(relativeDirectory) {
  const entries = await fs.readdir(path.resolve(rootDir, relativeDirectory), {
    withFileTypes: true,
  });
  const nested = await Promise.all(entries.map(async (entry) => {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) return collectSourceFiles(relativePath);
    if (!entry.isFile() || !sourceExtensions.has(path.extname(entry.name))) return [];
    return [relativePath];
  }));
  return nested.flat();
}

async function assertSettingsOwnerBoundary() {
  const sourceFiles = await collectSourceFiles(nudgeRootPath);
  const forbiddenGenericSettingsTokens = [
    'platform/storage/settings/',
    'applySettingsPatchViaRuntime',
    'readSettingsSnapshot',
  ];
  const evaluationOnlySymbols = new RegExp(`\\b(?:${[
    'usageFlowScenarios', 'usageFlowScenarioRelations', 'feedDomScenarios', 'feedIdentityScenarios',
    'flowModelScenarios', 'createFlowModelCorpus', 'replayCurrentFlowModel',
    'flowCandidateScenarios', 'createFlowCandidateCorpus', 'replayContinuousFlowCandidate',
    'flowDomIntegrationScenarios', 'createFlowDomIntegrationCorpus', 'createFlowDomPlatformHarness',
    'flowMeasuredPressureScenarios', 'createFlowMeasuredPressureCorpus', 'replayMeasuredFlowPressure',
    'flowItemObservationScenarios', 'createFlowItemObservationCorpus',
    'flowJournalPressureReplay', 'replayJournalFlowPressure',
    'createFlowUseJourneyCorpus', 'projectFlowUseJourneyFrame', 'assessFlowUseJourney', 'createFlowNaturalPipeline',
    'collectMeasuredFlowTrace',
    'FLOW_CANDIDATE_CONFIG', 'FLOW_CANDIDATE_SOURCE_FILES', 'addFlowMass',
    'recoverFlowPressure', 'flowRecoveryTimeMs', 'validateFlowModelTrace',
    'validateFlowModelCorpus', 'evaluateFlowModelCorpus', 'FLOW_MODEL_REFINEMENT_STEPS', 'equalFlowMetric',
    'selectLastFlowAdvance', 'compareFlowTrajectories', 'diagnoseFlowProbes',
    'createFlowComparisonCorpus', 'compareFlowCandidates',
    'validateFlowCandidateConfig', 'auditFlowCandidateRecovery', 'equilibriumPressure',
    'FLOW_CANDIDATE_RECOVERY_AUDIT_SOURCE_FILES', 'CURRENT_FLOW_MODEL_SOURCE_FILES',
    'FLOW_BASELINE_SOURCE_FILES', 'FLOW_COMPARISON_SOURCE_FILES',
    'readFlowEvaluationHashes', 'assertFlowEvaluationHashesUnchanged',
  ].join('|')})\\b`, 'u');

  for (const relativePath of sourceFiles) {
    const source = await readRequiredFile(relativePath);
    if (/scripts\/dev\/usage-flow-evaluation/u.test(source) || evaluationOnlySymbols.test(source)) {
      fail(`${relativePath}: independent evaluation stories, diagnostics and candidate mechanisms must never become runtime evidence or policy.`);
    }
    for (const token of forbiddenGenericSettingsTokens) {
      if (source.includes(token)) {
        fail(`${relativePath}: nudge settings must use ${settingsClientPath}; found ${token}.`);
      }
    }
    const storageImports = [...source.matchAll(/['"]([^'"]*platform\/storage\/nudge\/([^'"]+))['"]/gu)];
    for (const [, , fileName] of storageImports) {
      const allowed = relativePath === settingsClientPath && fileName === 'NudgeSettingsService.js'
        || relativePath === furinDailyPolicyPath
          && ['FurinDailyReceiptRepository.js', 'furinDailyReceiptContract.js'].includes(fileName)
        || furinPureContractReaders.has(relativePath) && fileName === 'furinDailyReceiptContract.js';
      if (!allowed) fail(`${relativePath}: nudge settings and daily receipts must use their exact named owners.`);
    }
  }

  const settingsClientSource = await readRequiredFile(settingsClientPath);
  for (const requiredToken of [
    'NudgeSettingsService.js',
    'persistNudgeIndicatorConfig',
    'ensureAnchorUnlockSettingInitialized',
  ]) {
    if (!settingsClientSource.includes(requiredToken)) {
      fail(`${settingsClientPath}: missing canonical settings owner token ${requiredToken}.`);
    }
  }
}

async function assertRewardObservationOwnerBoundary() {
  const observationPath = `${nudgeRootPath}/attention/RewardDriftObservationRuntime.js`;
  const aggregatorPath = `${nudgeRootPath}/attention/dopamineBingeEvidenceRuntime.js`;
  const modelPath = `${nudgeRootPath}/attention/rewardDriftEvidence.js`;
  const rearmPath = `${nudgeRootPath}/interaction/EnsoRewardRearmPolicy.js`;
  const readinessPath = `${nudgeRootPath}/interaction/ensoGateReadiness.js`;
  const allowedDependencies = new Map([
    [observationPath, new Set(['./rewardDriftEvidence.js'])],
    [aggregatorPath, new Set(['./dopamineBingeDetector.js', './RewardDriftObservationRuntime.js'])],
    [modelPath, new Set()],
    [rearmPath, new Set(['../attention/rewardDriftEvidence.js'])],
  ]);
  for (const relativePath of allowedDependencies.keys()) await readRequiredFile(relativePath);
  const sourceFiles = await collectSourceFiles('src');
  const sources = await Promise.all(sourceFiles.map(async (relativePath) => (
    [relativePath, await readRequiredFile(relativePath)]
  )));
  for (const [relativePath, source] of sources) {
    if (/scripts\/dev\/usage-flow-evaluation|\b(?:replayMeasuredFlowPressure|collectMeasuredFlowTrace|flowItemObservationScenarios|createFlowItemObservationCorpus|flowJournalPressureReplay|replayJournalFlowPressure)\b/u.test(source)) {
      fail(`${relativePath}: measured-pressure evaluation cannot become production evidence or policy.`);
    }
    if (/\b(?:resetRewardDriftAfterEnsoPresentation|observeRewardEvidence)\b|\bstate\s*(?:\?\.|\.)\s*rewardDrift\b|\bstate\s*\[\s*['"]rewardDrift['"]\s*\]/u.test(source)) {
      fail(`${relativePath}: retired presentation-to-observation resets, summary setters and mirrored interaction state are forbidden.`);
    }
    if (relativePath === `${nudgeRootPath}/interaction/interactionState.js` && /\brewardDrift\s*:/u.test(source)) {
      fail(`${relativePath}: raw reward observations belong only to the attention observation owner.`);
    }
    if (/\bRewardDriftObservationRuntime\b/u.test(source)
      && ![observationPath, aggregatorPath].includes(relativePath)) {
      fail(`${relativePath}: only the dopamine evidence aggregator may acquire the reward observation owner.`);
    }
    if (/\bEnsoRewardRearmPolicy\b/u.test(source) && ![rearmPath, readinessPath].includes(relativePath)) {
      fail(`${relativePath}: reward rearm memory is private to click admission and cannot become detector evidence.`);
    }
    if (relativePath !== readinessPath
      && /\.\s*(?:configureRewardObservation|recordRewardTransition|clearRewardEvidence)\s*\(/u.test(source)) {
      fail(`${relativePath}: observed reward transitions/configuration/lifecycle are owned by the click observation seam, never presentation consumers.`);
    }
    if (relativePath !== aggregatorPath && /\._rewardObservation\b/u.test(source)) {
      fail(`${relativePath}: the raw reward owner is private to its aggregator.`);
    }
    const dependencies = allowedDependencies.get(relativePath);
    if (dependencies) {
      const imports = source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)['"]([^'"]+)['"]/gu);
      for (const [, specifier] of imports) {
        if (!dependencies.has(specifier)) {
          fail(`${relativePath}: undeclared reward-owner dependency ${specifier}; observation and admission may share only the pure accumulation law.`);
        }
      }
    }
    if ([observationPath, modelPath, rearmPath].includes(relativePath)
      && /\b(?:window|document|chrome|indexedDB|localStorage)\s*[.(]|\b(?:fetch|postMessage|sendMessage|setTimeout|setInterval|publish\w*|recordProtection\w*)\s*\(/u.test(source)) {
      fail(`${relativePath}: reward observation/model/rearm owners cannot publish, persist, collect DOM data or acquire a timer.`);
    }
    if ([observationPath, modelPath, aggregatorPath].includes(relativePath)
      && /\bpresentationRevision\b|\bEnsoSpawnPolicy\b|\bEnsoRewardRearmPolicy\b/u.test(source)) {
      fail(`${relativePath}: reward observation and detector aggregation cannot consume presentation or rearm policy.`);
    }
  }
}

function assertJournalRecordKeys(source, journalPath) {
  const declarations = new Map();
  const schemas = new Map([
    ['COMMON_KEYS', ['kind', 'at', 'epoch']],
    ['SCROLL_KEYS', ['kind', 'at', 'epoch', 'source', 'direction', 'screenfuls']],
    ['ITEM_SAMPLE_KEYS', ['kind', 'at', 'epoch', 'previousSampleAt', 'continuity', 'layout', 'items',
      'enteredItemIds', 'exitedItemIds', 'reenteredItemIds', 'dominantItemId', 'dominanceMargin', 'change']],
    ['ITEM_KEYS', ['itemId', 'identityBasis', 'itemFraction', 'regionFraction']],
  ]);
  for (const [name, expected] of schemas) {
    const declaration = source.match(new RegExp(`\\bconst\\s+${name}\\s*=\\s*\\[([^\\]]*)\\]`, 'u'));
    if (!declaration) fail(`${journalPath}: missing explicit content-free record schema ${name}.`);
    const keys = declaration[1].split(',').map((part) => part.trim()).filter(Boolean).flatMap((part) => {
      const literal = part.match(/^(['"])([A-Za-z]\w*)\1$/u);
      if (literal) return [literal[2]];
      const spread = part.match(/^\.\.\.(\w+)$/u);
      if (spread && declarations.has(spread[1])) return declarations.get(spread[1]);
      fail(`${journalPath}: ${name} must declare auditable scalar field names, not dynamic payload keys.`);
      return [];
    });
    if (keys.length !== expected.length || new Set(keys).size !== keys.length
      || expected.some((key) => !keys.includes(key))) {
      fail(`${journalPath}: ${name} crosses the declared content-free record boundary; update its Active contract and privacy checks together.`);
    }
    declarations.set(name, keys);
    const input = name === 'ITEM_KEYS' ? 'item' : 'record';
    if (!new RegExp(`\\bexactKeys\\(\\s*${input}\\s*,\\s*${name}\\s*,`, 'u').test(source)) {
      fail(`${journalPath}: ${name} must validate the input record before publication.`);
    }
  }
}

async function assertFeedItemObservationOwnerBoundary() {
  const sensorPath = `${nudgeRootPath}/feed-flow/observation/FeedLiveObservation.js`;
  const itemPath = `${nudgeRootPath}/feed-flow/observation/FeedItemObservationWindow.js`;
  const journalPath = `${nudgeRootPath}/feed-flow/observation/FeedObservationJournal.js`;
  const editorPath = `${nudgeRootPath}/feed-flow/observation/EditorObservationJournal.js`;
  const capturePath = `${nudgeRootPath}/feed-flow/capture/FeedInputCapture.js`;
  const primitivePath = 'src/lib/BoundedObservationJournal.js';
  const editorPublicOwners = new Set([capturePath, `${nudgeRootPath}/feed-flow/index.js`,
    `${nudgeRootPath}/feed-flow/FeedObservationRuntime.js`]);
  const pureOwners = new Map([
    [itemPath, 'FeedItemObservationWindow'],
    [journalPath, 'FeedObservationJournal'],
  ]);
  const sensorDependencies = new Set([
    './resolveFeedObservationRegion.js', './readFeedRegionSnapshot.js',
    './FeedItemObservationWindow.js', './FeedObservationJournal.js',
    './feedObservationSurface.js',
    '../resolve/ActiveScrollContainerResolver.js', '../../../../lib/dom/programmaticScrollWrites.js',
  ]);
  const geometryDependencies = new Map([
    [`${nudgeRootPath}/feed-flow/observation/resolveFeedObservationRegion.js`, new Set([
      '../discovery/genericFeedItemFeatures.js', '../discovery/feedItemBoundaries.js',
      '../resolve/ActiveScrollContainerResolver.js', './collectFeedObservationWindow.js', './feedObservationLimits.js',
    ])],
    [`${nudgeRootPath}/feed-flow/observation/collectFeedObservationWindow.js`, new Set([
      './feedObservationLimits.js', '../discovery/feedItemBoundaries.js',
    ])],
    [`${nudgeRootPath}/feed-flow/observation/readFeedRegionSnapshot.js`, new Set([
      '../discovery/feedItemContentIdentity.js', './feedObservationLimits.js',
    ])],
    [`${nudgeRootPath}/feed-flow/observation/feedObservationLimits.js`, new Set()],
    [`${nudgeRootPath}/feed-flow/observation/feedObservationSurface.js`, new Set()],
  ]);
  for (const relativePath of pureOwners.keys()) await readRequiredFile(relativePath);
  const policyDirectories = [
    'attention', 'interaction', 'feed-flow/actuation', 'feed-flow/bridge',
    'feed-flow/classify', 'feed-flow/confirm', 'feed-flow/judge', 'feed-flow/learning',
    'feed-flow/terminus',
  ].map((directory) => `${nudgeRootPath}/${directory}/`);
  const shadowFields = /\b(?:itemObservation|eventJournal|itemFractionMs|regionFractionMs|sampledSingleItemChanges|sampledSetChanges|reentryObservations)\b/u;

  for (const relativePath of await collectSourceFiles('src')) {
    const source = await readRequiredFile(relativePath);
    if ([sensorPath, `${nudgeRootPath}/feed-flow/observation/resolveFeedObservationRegion.js`,
      `${nudgeRootPath}/feed-flow/observation/feedObservationSurface.js`].includes(relativePath)
      && /\b(?:surfaceMode|contentClass|surfaceConfidence|genericSignals)\b/u.test(source)) {
      fail(`${relativePath}: structural classifications cannot define measurement availability, identity or epochs.`);
    }
    if (/\bEditorObservationChannel\b/u.test(source) && relativePath !== editorPath && relativePath !== capturePath) {
      fail(`${relativePath}: the editor channel may be acquired only by the existing input capture owner.`);
    }
    if (/\b(?:EditorObservationJournal|copyEditorObservationEvent)\b/u.test(source) && relativePath !== editorPath
      && relativePath !== capturePath) {
      fail(`${relativePath}: editor typed records remain private to the observation owner until consumer cutover.`);
    }
    if (/\b(?:setEditorObservationAllowed|getEditorObservationSnapshot)\b/u.test(source) && !editorPublicOwners.has(relativePath)) {
      fail(`${relativePath}: the default-off editor capability has no production grant or consumer yet.`);
    }
    if (policyDirectories.some((directory) => relativePath.startsWith(directory))
      && /EditorObservation|editorObservation/u.test(source)) {
      fail(`${relativePath}: editor observations have no policy, history or admission consumer.`);
    }
    if (/\bBoundedObservationJournal\b/u.test(source)
      && ![primitivePath, journalPath, editorPath].includes(relativePath)) {
      fail(`${relativePath}: bounded chronology is acquired through a typed observation journal.`);
    }
    if (geometryDependencies.has(relativePath)) {
      for (const [, specifier] of source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)['"]([^'"]+)['"]/gu)) {
        if (!geometryDependencies.get(relativePath).has(specifier)) {
          fail(`${relativePath}: viewport geometry may use declared DOM mechanics, not policy, admission or historical interpretations.`);
        }
      }
      if (/\b(?:setTimeout|setInterval|requestAnimationFrame|fetch|sendMessage)\s*\(|\bnew\s+(?:MutationObserver|IntersectionObserver|ResizeObserver)\b/u.test(source)) {
        fail(`${relativePath}: geometry acquisition shares the existing producer cadence and cannot acquire another runtime or publication path.`);
      }
    }
    if (relativePath === sensorPath) {
      for (const [, specifier] of source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)['"]([^'"]+)['"]/gu)) {
        if (!sensorDependencies.has(specifier)) {
          fail(`${sensorPath}: undeclared measurement dependency ${specifier}; item evidence must not acquire policy or presentation feedback.`);
        }
      }
    }
    for (const [ownerPath, ownerName] of pureOwners) {
      if (new RegExp(`\\b${ownerName}\\b`, 'u').test(source)
        && relativePath !== ownerPath && relativePath !== sensorPath) {
        fail(`${relativePath}: ${ownerName} is acquired only by the live observation owner; consumers use its content-free snapshot.`);
      }
    }
    if (relativePath !== sensorPath && /\._(?:itemObservation|eventJournal)\b/u.test(source)) {
      fail(`${relativePath}: item accounting and journal instances are private to ${sensorPath}.`);
    }
    if (policyDirectories.some((directory) => relativePath.startsWith(directory)) && shadowFields.test(source)) {
      fail(`${relativePath}: sampled item geometry and retained journal events remain shadow observations, not classification, history, pressure or admission inputs.`);
    }
    if (pureOwners.has(relativePath) || [editorPath, primitivePath,
      `${nudgeRootPath}/feed-flow/observation/feedObservationSurface.js`].includes(relativePath)) {
      const allowed = [journalPath, editorPath].includes(relativePath)
        ? new Set(['../../../../lib/BoundedObservationJournal.js']) : new Set();
      for (const [, specifier] of source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)['"]([^'"]+)['"]/gu)) {
        if (!allowed.has(specifier)) fail(`${relativePath}: pure typed facts may share bounded chronology only, never observation, policy or storage dependencies.`);
      }
      if (/\b(?:window|document|globalThis|chrome|browser|indexedDB|localStorage|sessionStorage)\s*[.\[]|\b(?:Date|performance)\s*\.\s*now\s*\(|\b(?:fetch|postMessage|sendMessage|setTimeout|setInterval|requestAnimationFrame|dispatchEvent|publish\w*)\s*\(|\bnew\s+(?:MutationObserver|ResizeObserver|IntersectionObserver|Worker|SharedWorker|BroadcastChannel|WebSocket|XMLHttpRequest)\b/u.test(source)) {
        fail(`${relativePath}: content-local item/journal facts cannot collect DOM, read an independent clock, publish, persist or own another runtime cadence.`);
      }
    }
  }
  assertJournalRecordKeys(await readRequiredFile(journalPath), journalPath);
}

async function main() {
  const goalEndOwners = [
    [`${nudgeRootPath}/runtime/goalEpisodeBinding.js`, [
      'requireNudgeGoalEnds(settings?.nudgeConfig?.goalEnds)',
      'goalEnds: Object.fromEntries(coveredScopes.map(scope => [scope, requireNudgeGoalEnds(settings.nudgeConfig.goalEnds)[scope]]))',
      '!Object.values(policy.goalEnds).every(enabled => enabled === true)',
      "return { valid: false, reason: 'goal_policy_changed' }",
    ]],
    [`${nudgeRootPath}/runtime/projectReadyGoalPriority.js`, [
      'requireNudgeGoalEnds(settings?.nudgeConfig?.goalEnds)',
      "isGoalEndEnabled(settings.nudgeConfig, 'global') && globalRecording",
      "isGoalEndEnabled(settings.nudgeConfig, 'site') && siteRecording",
      "protocolScope: 'global' }).eligible",
      "protocolScope: 'site' }).eligible",
    ]],
  ];
  for (const [ownerPath, tokens] of goalEndOwners) {
    const source = await readRequiredFile(ownerPath);
    for (const token of tokens) {
      if (!source.includes(token)) fail(`${ownerPath}: missing covered-scope goal-end contract ${token}.`);
    }
    if (/nudgeConfig\??\.enabled/u.test(source)) fail(`${ownerPath}: independent goal-end preferences cannot be replaced with a stored master.`);
  }
  const readmeSource = await readRequiredFile(readmePath);
  assertReadmeHeadings(readmeSource);
  await assertRelatedDocsAreActive();
  await assertRootInventory();
  await assertBroadBarrelsStayAbsent();
  await assertSettingsOwnerBoundary();
  await assertRewardObservationOwnerBoundary();
  await assertFeedItemObservationOwnerBoundary();
  const scrollWriterPath = 'src/lib/dom/programmaticScrollWrites.js';
  const scrollWriterSource = await readRequiredFile(scrollWriterPath);
  if (/^\s*import\b|FeedFlowJudge|ensoFeedEpisodeAdmission|chrome\.storage|indexedDB|localStorage|setTimeout|setInterval/mu.test(scrollWriterSource)) {
    fail(`${scrollWriterPath}: physical write facts must remain domain-neutral, non-persistent and independent of policy/timer inference.`);
  }
  const scrollActuatorPaths = new Set([
    'src/domains/nudge/behavior/scrollInputOrchestrator.js',
    'src/domains/nudge/feed-flow/terminus/FeedEndpointBoundaryMotion.js',
  ]);
  for (const relativePath of await collectSourceFiles(nudgeRootPath)) {
    const source = await readRequiredFile(relativePath);
    if (/\bwriteProgrammaticScroll\b/u.test(source) && !scrollActuatorPaths.has(relativePath)) {
      fail(`${relativePath}: only named physical scroll actuators may write provenance; observations and judgments are read-only consumers.`);
    }
    if (scrollActuatorPaths.has(relativePath) && (
      !source.includes('writeProgrammaticScroll')
      || /\.scroll(?:To|By)\s*\(|\.scrollTop\s*=(?!=)/u.test(source)
    )) {
      fail(`${relativePath}: native scroll writes must use the single mechanical-purpose write boundary.`);
    }
  }
  const sensorPaths = [
    'src/domains/nudge/feed-flow/observation/FeedLiveObservation.js',
    'src/domains/nudge/feed-flow/observation/resolveFeedObservationRegion.js',
    'src/domains/nudge/feed-flow/observation/FeedItemObservationWindow.js',
    'src/domains/nudge/feed-flow/observation/FeedObservationJournal.js',
  ];
  for (const sensorPath of sensorPaths) {
    const source = await readRequiredFile(sensorPath);
    if (/surfaceConfidence|FeedFlowJudge|dopamineBingeDetector|ensoFeedEpisodeAdmission|chrome\.storage|indexedDB|localStorage|new MutationObserver|setInterval\s*\(/u.test(source)) {
      fail(`${sensorPath}: live measurements cannot read judgment/storage authority or own a second observer cadence.`);
    }
  }
  for (const consumerPath of [
    'src/domains/nudge/feed-flow/judge/FeedFlowJudge.js',
    'src/domains/nudge/attention/dopamineBingeDetector.js',
    'src/domains/nudge/interaction/ensoFeedEpisodeAdmission.js',
  ]) {
    const source = await readRequiredFile(consumerPath);
    if (/FeedLiveObservation|sensorObservation|getObservationSnapshot|FeedItemObservationWindow|FeedObservationJournal|itemObservation|eventJournal/u.test(source)) {
      fail(`${consumerPath}: shadow sensor promotion requires an explicit measurement-contract cutover.`);
    }
  }
  for (const corpusPath of [
    'scripts/dev/usage-flow-evaluation/scenarios.mjs',
    'scripts/dev/usage-flow-evaluation/domScenarios.mjs',
    'scripts/dev/usage-flow-evaluation/flowModelScenarios.mjs',
    'scripts/dev/usage-flow-evaluation/flowCandidateScenarios.mjs',
    'scripts/dev/usage-flow-evaluation/flowDomIntegrationScenarios.mjs',
    'scripts/dev/usage-flow-evaluation/flowMeasuredPressureScenarios.mjs',
    'scripts/dev/usage-flow-evaluation/flowItemObservationScenarios.mjs',
    'scripts/dev/usage-flow-evaluation/flowUseJourneyScenarios.mjs',
    'scripts/dev/usage-flow-evaluation/flowTemporalScenarios.mjs',
    'scripts/dev/usage-flow-evaluation/flowTemporalDomScenarios.mjs',
    'scripts/dev/usage-flow-evaluation/flowPreparationScenarios.mjs',
  ]) {
    const corpusSource = await readRequiredFile(corpusPath);
    if (/^\s*import\b|\bimport\s*\(|\brequire\s*\(|\bexport\s+(?:\*|\{[^}]*\})\s*(?:as\s+\w+\s+)?from\s*['"]/mu.test(corpusSource)) {
      fail(`${corpusPath}: author the oracle independently; production and existing QA imports are forbidden.`);
    }
  }

  const temporalOwners = new Map([
    ['assessFlowPreparation.mjs', new Set()],
    ['flowPreparationPolicy.mjs', new Set(['./flowTemporalInterpretation.mjs', './flowObservationTraceReader.mjs'])],
    ['flowObservationTraceReader.mjs', new Set(['../../../src/domains/nudge/feed-flow/observation/FeedObservationJournal.js'])],
    ['flowTemporalInterpretation.mjs', new Set(['./flowObservationTraceReader.mjs', '../../../src/domains/nudge/feed-flow/observation/EditorObservationJournal.js'])],
    ['projectEditorObservationTrace.mjs', new Set(['./flowObservationTraceReader.mjs', '../../../src/domains/nudge/feed-flow/observation/EditorObservationJournal.js'])],
    ['flowJournalPressureReplay.mjs', new Set(['./flowObservationTraceReader.mjs', './continuousFlowCandidate.mjs'])],
  ]);
  for (const [file, allowed] of temporalOwners) {
    const source = await readRequiredFile(`scripts/dev/usage-flow-evaluation/${file}`);
    for (const [, specifier] of source.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)['"]([^'"]+)['"]/gu)) {
      if (!allowed.has(specifier)) fail(`${file}: temporal observation readers cannot acquire policy, corpus answers or another cursor owner.`);
    }
    if (/\b(?:window|document|chrome|localStorage|indexedDB)\s*[.\[]|\b(?:setTimeout|setInterval|fetch)\s*\(/u.test(source)) {
      fail(`${file}: evaluation interpretation cannot acquire a live sensor, timer or persistence owner.`);
    }
  }
  for (const file of await collectSourceFiles('src')) {
    const source = await readRequiredFile(file);
    if (/\b(?:interpretFlowTimeline|evaluateFlowPreparation)\b|flow(?:TemporalInterpretation|PreparationPolicy)\.mjs/u.test(source)) {
      fail(`${file}: temporal interpretation remains evaluation-only until a documented runtime cutover.`);
    }
  }

  console.log(`[${label}] PASS: nudge owner docs, root inventory, settings ownership, bounded contexts, and narrow public seams are stable.`);
}

main().catch((error) => {
  fail(error?.message || String(error));
});
