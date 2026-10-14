import fs from 'node:fs';
import path from 'node:path';

const failures = [];
const read = (file) => fs.readFileSync(file, 'utf8');
function requireText(file, needles) {
  const source = read(file);
  for (const needle of needles) if (!source.includes(needle)) failures.push(`${file}: missing owner contract ${needle}`);
  return source;
}
const owner = requireText('src/domains/protection/background/runtime/InterventionAdmissionService.js', [
  'InterventionAdmissionRepository', 'reduceInterventionAdmission', 'this.tail.then',
  'INTERVENTION_PREEMPTION_CLEANUP_UNCONFIRMED', 'webNavigationGetFrame', 'resolveGate(',
  'INTERVENTION_RESOLUTION_PROBE_INVALID', 'frameId: 0, documentId: owner.documentId', 'timeoutMs: 800',
  'INTERVENTION_DOCUMENT_HANDOFF_UNCONFIRMED', "reason: 'document_handoff'",
  'tabsGetLiveness(owner.tabId)', 'INTERVENTION_TAB_LIVENESS_INVALID', "reason: 'tab_gone'",
  'INTERVENTION_PROFILE_ADMISSION_REQUIRED', 'this.runProfileMutationAdmittedTask(',
  'ensoNotificationPending', 'ensoNotificationTask', 'generation === this.ensoReceiverGeneration',
  'cadence_read_queued', 'cadence_read_settled', 'queueWaitMs:', 'runMs:',
]);
if (owner.includes('await this.pushEnsoCadence(')) failures.push('Optional cadence delivery must not occupy the admission mutation lane');
const composition = read('src/apps/background/services/runtime/backgroundKernelProtectionBindings.js');
const admissionBinding = composition.slice(composition.indexOf('configureInterventionAdmissionService({'), composition.indexOf('const protectionServiceBindings ='));
if (!admissionBinding.includes('runProfileMutationAdmittedTask,')) failures.push('Cadence delivery must use the composed profile lifetime owner');
if (!admissionBinding.includes('gateInterstitialController.preparePresented(')) failures.push('Gate presentation must use the split operational/history receipt owner');
requireText('src/domains/protection/background/runtime/InterventionAdmissionService.js', [
  'INTERVENTION_GATE_PRESENTATION_RECEIPT_INVALID', 'await result.presentation.completion',
]);
requireText('src/domains/protection/background/GateInterstitialController.js', [
  'async function preparePresented(', 'snapshotHistoryPayload(', 'captureShownHistory(',
  'GATE_HISTORY_CAPACITY_EXCEEDED', 'GATE_HISTORY_PRESENTATION_UNCONFIRMED',
  'historyTasksBySession.delete(sessionId)', 'await shownHistory.completion',
]);
requireText('src/platform/storage/runtime/GateInterventionSessionRepository.js', [
  '#enqueueMutation(', 'this.mutationTail.then(work)', '#writeOwnedState(',
]);
requireText('src/domains/nudge/runtime/interventionAdmissionClient.js', [
  'ensoCadence === cadenceAtStart', 'cadenceReadId',
]);
requireText('src/domains/protection/background/runtime/InterventionAdmissionService.js', [
  "owner.source === 'goal_feed_horizon'",
  'INTERVENTION_GOAL_PURPOSE_INVALID',
  'INTERVENTION_GOAL_ENDPOINT_RECEIPT_INVALID',
  'INTERVENTION_GOAL_PRESENTATION_RECEIPT_INVALID',
  "operation === 'boundary_presented'",
  "reason: 'goal_boundary_required'",
  'owner.finalPresentedAt <= 0',
  'receipt.finalPresentedAt <= 0',
  'validateGoalBinding(', 'validateGoalPresentation(', 'revalidateGoalOwners(', 'cancelGoalBinding(',
  'this.evaluateGoalOwner(', 'goalAuthorizationRevision', 'goal_authorization_overtaken',
  "operation === 'authorize_goal'", "reason: 'goal_final_presentation_unconfirmed'",
  'INTERVENTION_GOAL_INVALIDATION_CLEANUP_UNCONFIRMED',
  'this.readReadyGoalPriority(candidate)', "denied('goal_priority', state)",
  'INTERVENTION_GOAL_PRIORITY_OWNER_REQUIRED', 'INTERVENTION_GOAL_PRIORITY_FACTS_INVALID',
  'INTERVENTION_GOAL_AUTHORIZATION_FENCE_REQUIRED', 'INTERVENTION_GOAL_PRIORITY_FENCE_REQUIRED',
  'normalizePendingEntry(facts.pending)',
  'finalCurrent.isCurrent() !== true', 'authorization.isCurrent() !== true',
]);
const goalReadComposition = requireText('src/apps/background/services/runtime/backgroundGoalAuthorizationReaders.js', [
  'settingsService.getSettingsChangeVersion()', 'attempt < 2',
  'isCurrent: () => before === version()', 'BACKGROUND_GOAL_AUTHORIZATION_READ_SUPERSEDED',
  'includeGoalEpisodeSettings: true', 'frame?.documentId !== documentId',
  'projectReadyGoalPriority({', 'dailyReceipt: await readDailyReceipt()',
]);
for (const forbidden of ['setSession(', 'chrome.storage', 'localStorage', 'setTimeout(', 'setInterval(']) {
  if (goalReadComposition.includes(forbidden)) failures.push(`Goal authorization read composition must use the canonical current owners: ${forbidden}`);
}
requireText('src/apps/background/services/runtime/backgroundKernelProtectionBindings.js', [
  'createBackgroundGoalAuthorizationReaders({', '...goalReaders,', 'readProfileGeneration,',
]);
const goalPriority = requireText('src/domains/nudge/runtime/projectReadyGoalPriority.js', [
  'resolveDomainUsageRecording(hostname, settings).enabled', 'resolveSitesRecordingPolicy(settings).globalCapAvailable',
  'globalCapBlockedMs >= globalCapLimitMs', 'activityDay.activeMs >= siteGoalMinutes * 60_000',
  'decideFurinDailyDelivery(dailyReceipt,', "reason: 'global_goal_ready'", "reason: 'site_goal_ready'",
]);
if (/\b(setTimeout|setInterval|chrome\.storage|localStorage|budgetRatio)\b/.test(goalPriority)) {
  failures.push('Goal priority must project fresh canonical facts without a new clock, storage or ratio');
}
requireText('src/domains/nudge/runtime/interventionAdmissionClient.js', [
  'function boundaryPresented(lease)',
  "operation: 'boundary_presented'",
  'current.boundaryAcknowledged = true',
  'function adoptPresentedGoalEndpoint({ kind, manual, leaseId })',
  'function adoptPreparedFurin({ kind, manual, leaseId, source })',
  'ticket.lease.leaseId !== leaseId',
  'ticket.lease.kind !== kind',
  'ticket.lease.manual !== false',
  'INTERVENTION_GOAL_HANDOFF_REQUIRED',
  'ticket.goalEndpointAdopted = true',
  'function authorizeGoal(lease)', "operation: 'authorize_goal'", 'INTERVENTION_GOAL_AUTHORIZATION_STALE',
]);
const cadence = requireText('src/domains/protection/background/runtime/ensoCadencePolicy.js', [
  'isEnsoReflection(owner)', 'goal_feed_horizon', 'finalPresentedAt',
]);
if (/\b(setTimeout|setInterval)\b/.test(cadence)) failures.push('Goal boundary accounting must not add a cadence wakeup clock');
requireText('src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchRunner.js', [
  "phase: 'entry_waiting'", 'nudge_entry_waiting',
  'response.runId === expectedRunId', 'markNudgeEntryWaiting(key, { runId, tabId, now })',
  'PROTECTION_NUDGE_ENTRY_WAIT_OWNER_CHANGED',
  'resolveNudgeTriggerCandidates(runtimeSnapshot, config)', 'await readFurinDailyReceipt()',
  'candidate.observedMs >= candidate.targetMs', "triggerTarget?.episode?.mode === 'combined_goals'",
  'createGoalEpisodeBinding({', 'goalBinding,',
]);
const furinRunner = read('src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchRunner.js');
for (const retired of ['initializeFurinDailyReceipt', 'absorbSiteNudgeEpisode', 'near_global_combined']) {
  if (furinRunner.includes(retired)) failures.push(`Furin dispatch must not restore speculative/legacy Site delivery: ${retired}`);
}
const furinCandidates = requireText('src/domains/protection/background/protocol/dispatch/ProtectionNudgeDispatchContext.js', [
  'function resolveNudgeTriggerCandidates(',
  'global.observedMs >= global.targetMs && site.observedMs >= site.targetMs',
  "mode: 'combined_goals'", "coveredScopes: ['global', 'site']",
]);
if (furinCandidates.includes('near_global_combined')) failures.push('Near Global cannot create combined-goal authority');
const furinDaily = requireText('src/domains/nudge/runtime/session/furinDailyPolicy.js', [
  'requireGoalEpisodeBinding(pending.goalBinding)',
  'Object.hasOwn(current.siteEnds, hostname)', 'current?.fullSite || current?.global',
  "source: 'actual_presentation'", "renderer: 'combined_global_furin'", "renderer: 'site_furin'",
  'next.siteEnds[pending.hostname]', 'await repository.write(next)',
  'FURIN_PRESENTATION_COMBINED_SITE_CONFLICT',
]);
for (const retired of ['initializeFurinDailyReceipt', 'session_shown_transition', 'global_already_presented_covers_site']) {
  if (furinDaily.includes(retired)) failures.push(`Daily Furin owner must keep actual scoped receipts: ${retired}`);
}
if (/\b(setTimeout|setInterval|chrome\.storage|localStorage)\b/.test(furinDaily)) {
  failures.push('Daily Furin receipts must use the existing serialized typed writer without a second timer/storage lane');
}
const goalBinding = requireText('src/domains/nudge/runtime/goalEpisodeBinding.js', [
  'requireGoalEpisodeBinding', 'createGoalEpisodeBinding', 'evaluateGoalEpisodeBinding',
  'GOAL_EPISODE_BINDING_INVALID', 'GOAL_EPISODE_CURRENT_FACTS_REQUIRED',
  'profileGeneration', 'coveredScopes', 'siteTargetMs', 'globalTargetMs', 'policySignature',
  'globalRecordingDomains:', 'resolveDomainUsageRecording(hostname, settings)',
  "reason: 'activity_day_basis_changed'", "reason: 'goal_values_changed'",
  "reason: 'goal_policy_changed'", "reason: 'goal_not_attained'",
]);
for (const forbidden of ['setTimeout(', 'setInterval(', 'chrome.storage', 'localStorage',
  'settings.revision', 'settingsRevision', 'budgetRatio']) {
  if (goalBinding.includes(forbidden)) failures.push(`Goal bindings must retain semantic current-policy identity: ${forbidden}`);
}
requireText('src/domains/nudge/runtime/session/nudgeSessionCore.js', [
  "ENTRY_WAITING: 'entry_waiting'",
  "ENTRY_CANCELLING: 'entry_cancelling'", 'requireGoalEpisodeBinding(raw.goalBinding)',
  'NUDGE_PENDING_GOAL_BINDING_MISMATCH',
  'if (pendingEntry.phase !== NUDGE_PENDING_PHASES.DISPATCHING) return true',
  'if (currentPhase === NUDGE_PENDING_PHASES.ENTRY_WAITING) return nextPhase === NUDGE_PENDING_PHASES.PRESENTED',
]);
requireText('src/domains/nudge/runtime/session/nudgeSessionDispatchState.js', [
  'export async function markNudgeEntryWaiting(',
  'isLifecycleAuthorized({ runId, tabId, pendingEntry, leaseEntry, terminalEntry, now })',
  'phase: NUDGE_PENDING_PHASES.ENTRY_WAITING',
]);
requireText('src/domains/nudge/runtime/SentinelProtocolHost.js', [
  'interventionAdmissionClient.adoptPreparedFurin({ kind, manual: false,',
  'handoff.replaceClaim.ownerId !== SENTINEL_PROTOCOL_HOST_SURFACE_OWNER_ID',
  'claimSentinelProtocolSurface(handoff?.replaceClaim)',
  "!visible && starting && pendingStart?.mode === 'auto' && !workerPresentationReady",
  'requireGoalEpisodeBinding(nextConfig?.__goalBinding)',
  'await interventionAdmissionClient.authorizeGoal(admissionLease)',
  'INTERVENTION_GOAL_HANDOFF_BINDING_MISMATCH',
]);
const goalCancelling = requireText('src/domains/nudge/runtime/session/nudgeSessionGoalCancellationState.js', [
  'readUnservedGoalEpisodes', 'markNudgeGoalCancelling', 'withNudgeSessionLock',
  'areGoalEpisodeBindingsEqual(pending.goalBinding, binding)', 'NUDGE_PENDING_PHASES.ENTRY_CANCELLING',
  'cancellationReason', 'return Object.freeze({ goalBinding: pending.goalBinding, reason: cancellationReason })',
]);
const goalInvalidator = requireText('src/domains/protection/background/protocol/dispatch/ProtectionGoalEpisodeInvalidator.js', [
  'await markCancelling(binding, { reason: validity.reason })', 'await interventionAdmission.cancelGoalBinding(binding',
  'reason: episode.cancellationReason', 'requireNudgeCancellationReason(cancellation.reason)',
  'PROTECTION_GOAL_CANCELLATION_RECEIPT_INVALID',
  'await cleanPendingDocument(binding)', 'await terminalize(binding, { now })',
  'terminalize = completeNudgeGoalCancellation', 'scheduleTerminalEffects({ tabId: binding.tabId',
  'binding.documentId', 'receipt.cleaned !== true', 'PROTECTION_GOAL_ENTRY_CLEANUP_UNCONFIRMED',
]);
if (!(goalInvalidator.indexOf('await markCancelling(binding, { reason: validity.reason })') < goalInvalidator.indexOf('await interventionAdmission.cancelGoalBinding(binding')
  && goalInvalidator.indexOf('await cleanPendingDocument(binding)') < goalInvalidator.indexOf('await terminalize(binding, { now })')
  && goalInvalidator.indexOf('await terminalize(binding, { now })') < goalInvalidator.indexOf('scheduleTerminalEffects({ tabId: binding.tabId'))) {
  failures.push('Goal invalidation must fence the exact pending owner before cleanup and terminalize only after cleanup proof');
}
requireText('src/domains/nudge/runtime/session/nudgeSessionCore.js', [
  'NUDGE_PENDING_CANCELLATION_REASON_INVALID', 'NUDGE_PENDING_CANCELLATION_REASON_UNEXPECTED',
  'requireNudgeCancellationReason(raw.cancellationReason)',
]);
requireText('src/domains/nudge/runtime/session/nudgeSessionDispatchState.js', [
  'if (pending?.phase === NUDGE_PENDING_PHASES.ENTRY_CANCELLING) return false;',
]);
const cancellationWriterPath = 'src/domains/tracking/background/nudgeManagerAbortKeyState.js';
requireText(cancellationWriterPath, [
  'export async function completeNudgeGoalCancellation(',
  "outcome: 'cancellation_pending', reason: pendingEntry.cancellationReason, entry: null",
  'areGoalEpisodeBindingsEqual(bound, cancellationBinding)',
  'if (cancellationBinding !== null) reason = pendingEntry.cancellationReason;',
]);
const completionOwners = [cancellationWriterPath,
  'src/domains/protection/background/protocol/dispatch/ProtectionGoalEpisodeInvalidator.js'];
for (const entry of fs.readdirSync('src', { recursive: true })) {
  if (!entry.endsWith('.js')) continue;
  const file = `src/${entry.split(path.sep).join('/')}`;
  if (read(file).includes('completeNudgeGoalCancellation') && !completionOwners.includes(file)) {
    failures.push(`${file}: goal cancellation completion belongs only to the exact cleanup invalidator`);
  }
}
requireText('src/domains/tracking/background/trackingMessageHandlers/nudgeCycleHandlers.js', [
  "result?.outcome === 'cancellation_pending'", 'terminalCommitted: false, cancellationPending: true',
]);
for (const [file, source] of [['goal cancellation session owner', goalCancelling], ['goal invalidator', goalInvalidator]]) {
  if (/\b(setTimeout|setInterval|chrome\.storage|localStorage)\b/.test(source)) failures.push(`${file}: no second clock or raw storage lane`);
}
requireText('src/domains/tracking/background/nudgeManagerPresentationState.js', [
  'NUDGE_PRESENTATION_VALIDATOR_REQUIRED', 'await validatePresentation(pendingEntry.goalBinding)',
  'await recordFurinDailyPresentation(key, pendingEntry, now)', 'goalBinding: pendingEntry.goalBinding',
]);
const goalSummaryRead = requireText('src/domains/nudge/runtime/session/readFurinGoalEndState.js', [
  'await getSession(', 'await readFurinDailyReceipt()', 'NUDGE_SESSION_KEYS.PENDING', 'NUDGE_SESSION_KEYS.TERMINAL',
]);
for (const forbidden of ['withNudgeSessionLock', 'setSession(', 'repository.write(', 'setTimeout(', 'setInterval(']) {
  if (goalSummaryRead.includes(forbidden)) failures.push(`Goal summary read must remain passive: ${forbidden}`);
}
const goalSummary = requireText('src/domains/protection/runtime/goalEndSummary.js', [
  'requireFurinDailyReceipt', 'requireGoalEndSummary', "'waiting_for_safe_boundary'", "'surface_unsupported'",
  "'goal_entry_cancelling'", 'isBindingCurrent(binding)', "'actual_presentation'", 'currentDay?.siteEnds[hostname]',
]);
for (const forbidden of ['Date.now(', 'budgetRatio', 'setSession(', 'localStorage', 'setTimeout(', 'setInterval(', '.shown', '.ack']) {
  if (goalSummary.includes(forbidden)) failures.push(`Goal summary cannot acquire delivery/time authority: ${forbidden}`);
}
requireText('src/domains/protection/background/TrackingProtectionService.js', [
  'projectGoalEpisodePolicySignature({', 'await readProfileGeneration()', 'await readGoalEndState()',
  'goalEndSummary: buildGoalEndSummary({', 'globalTargetMs: cap.globalGoalMs, globalActiveMs: cap.blockedTodayMs',
]);
const assembler = requireText('src/domains/protection/background/ProtectionRuntimeInputAssembler.js', [
  'const capState = recordingPolicy.globalCapAvailable ?', 'stats: rawStatsSnapshot,',
]);
if (assembler.includes('const capState = domainRecording.enabled &&')) failures.push('Global cap must keep its independent canonical recording basis');
requireText('src/domains/protection/contracts/protectionRuntimeSnapshotBridge.js', ['normalizeOptionalGoalEndSummary(telemetryContext?.goalEndSummary)']);
requireText('src/domains/protection/runtime/canonicalArtifactTelemetry.js', ['goalEndSummary: normalizeOptionalGoalEndSummary(runtimeSource.goalEndSummary)']);
requireText('src/domains/protection/content/ProtectionController.js', [
  'getVideoElementObserverForDocument(document)', 'synchronousInitialInventory: true',
  'mediaSnapshot: videoElementObserver.getMediaSnapshot()',
  'getMediaSnapshot: () => videoElementObserver.getMediaSnapshot()',
  'releaseInventory()',
  "rejectReason: 'production_entry_owned'",
  "cancelPendingNudgeEntrySeam('protection_cleared')",
  'const retainStartingHost = host =>',
  "host.getMode() === 'auto' && host.getRunId() === runId",
  'if (abort) cancelStartedHost?.()',
]);
const contentResolution = owner.slice(owner.indexOf('  resolve(identity, work,'), owner.indexOf('  resolveGate('));
if (contentResolution.includes('webNavigationGetFrame')) failures.push('Content conclusion must use exact document control proof without optional webNavigation');
requireText('src/domains/tracking/background/trackingMessageHandlers/nudgeCycleHandlers.js', ['{ documentHandoff: true }']);
requireText('src/domains/nudge/runtime/interventionAdmissionClient.js', ['documentInvalidated = true', 'INTERVENTION_DOCUMENT_INVALIDATED']);
requireText('src/apps/background/services/runtime/backgroundKernelProtectionBrowserPort.js', ['INTERVENTION_DOCUMENT_LOOKUP_UNAVAILABLE', 'INTERVENTION_CONTROL_PROBE_TIMEOUT']);
requireText('src/apps/background/services/runtime/backgroundKernelProtectionBrowserPort.js', ['tabsGetLiveness:', 'INTERVENTION_TAB_LOOKUP_UNAVAILABLE', 'INTERVENTION_TAB_LOOKUP_RESULT_INVALID', 'Number(gone[1]) === tabId']);
const reconciliation = owner.slice(owner.indexOf('  async reconcile(state)'), owner.indexOf('  request(candidate)'));
for (const proof of ['receipt.cleaned !== true', 'receipt.error', 'INTERVENTION_RECONCILIATION_CLEANUP_UNCONFIRMED']) {
  if (!reconciliation.includes(proof)) failures.push(`Reconciliation must retain unconfirmed cleanup ownership: ${proof}`);
}
requireText('src/domains/protection/background/runtime/InterventionAdmissionService.js', [
  'recordInterventionExposureEnd', 'advanceInterventionExposureWindow', 'readExposureSnapshot(',
]);
const exposureRead = owner.slice(owner.indexOf('  async readExposureSnapshot('), owner.indexOf('\n}\n\nlet service'));
for (const forbidden of ['this.run(', 'this.save(', 'this.reconcile(', 'browserPort.']) {
  if (exposureRead.includes(forbidden)) failures.push(`Exposure read must be a committed passive query: ${forbidden}`);
}
requireText('src/domains/protection/background/ProtectionRuntimeInputProvider.js', [
  'PROTECTION_RUNTIME_INPUT_EXPOSURE_OWNER_REQUIRED', 'projectConsumptionExposureContext(consumptionFlow.lastSegment, interventionExposure)',
]);
if (reconciliation.includes('.tabsGet(')) failures.push('Admission reconciliation must not use the permissive tabsGet result as liveness proof');
if (/\b(setTimeout|setInterval|chrome\.storage|localStorage)\b/.test(owner)) failures.push('Admission owner must not schedule recovery wakeups or bypass typed storage');
requireText('src/domains/nudge/runtime/ritualSurfaceArbiter.js', ['canPreemptIntervention', 'replaceClaim?.serial', 'admissionLease']);
requireText('src/domains/protection/background/runtime/TabClosureArbiter.js', ['admission.resolve(', 'admission.resolveGate(']);
requireText('src/domains/nudge/runtime/SentinelProtocolTerminalController.js', ['epoch !== terminalEpoch', 'admissionLease']);
requireText('src/domains/nudge/interaction/EnsoSpawnPolicy.js', ["from '../runtime/interventionAdmissionClient.js'"]);
requireText('src/domains/nudge/interaction/EnsoSpawnPolicy.js', ["cancelPending({ kind: 'enso_gate', source: normalizedSource })"]);
requireText('src/domains/protection/content/ProtectionRegistry.js', ['loadedSentinelProtocolHost.hasLifecycleOwnership()']);
requireText('src/domains/nudge/runtime/SentinelProtocolHost.js', ['pendingStart = startMetadata', 'hasLifecycleOwnership']);
requireText('src/domains/nudge/runtime/SentinelProtocolHost.js', ['SENTINEL_PROTOCOL_CLEANUP_FAILED', 'intervention_cleanup_pending']);
requireText('src/domains/nudge/runtime/interventionAdmissionClient.js', [
  'setContextInvalidationHandler', 'runTicketCleanups', 'INTERVENTION_ASYNC_CLEANUP_UNSUPPORTED',
  "reason: 'document_invalidated'", 'canSend && !canSend()', 'receipt_acknowledged', 'receipt_failed',
]);
const lifecycleDiagnostics = requireText('src/domains/nudge/runtime/interventionLifecycleDiagnostics.js', [
  'Object.freeze', 'recordProtectionInterventionEvent', 'activationId: createRandomUuid()',
]);
const identityPrimitive = requireText('src/lib/randomUuid.js', ['cryptoRef.getRandomValues(bytes)', 'UUID_RANDOM_SOURCE_UNAVAILABLE']);
if (/Math\.random|Date\.now/.test(identityPrimitive)) failures.push('Runtime identity must retain a cryptographic entropy source');
requireText('src/domains/protection/background/runtime/TabClosureArbiter.js', ['RITUAL_SURFACE_TYPES.SITE_FURIN', 'requiredKind: descriptor.surfaceType']);
requireText('src/domains/tracking/background/trackingMessageHandlers/nudgeCycleHandlers.js', ['SITE_FURIN_CLOSE_CURRENT_TAB', 'sender.frameId !== 0']);
for (const forbidden of ['setTimeout(', 'setInterval(', 'chrome.storage', 'localStorage', 'InterventionAdmissionRepository']) {
  if (lifecycleDiagnostics.includes(forbidden)) failures.push(`Lifecycle diagnostics must not acquire runtime authority: ${forbidden}`);
}
requireText('src/domains/nudge/runtime/SentinelProtocolHost.js', ['cancelPendingPaint?.()', 'cancelPendingPaint === cancel']);
requireText('src/domains/protection/background/runtime/InterventionAdmissionService.js', ["this.observe('transition_committed'", 'await this.save(state)']);
requireText('src/apps/content/bootstrapController.js', [
  'interventionAdmissionClient.setContextInvalidationHandler', 'publishState: false', 'CONTENT_RUNTIME_EXTENSION_CONTEXT_INVALIDATED',
]);
requireText('src/domains/protection/content/runtime/AudioDullingActivationChip.js', ["from '../../../nudge/runtime/interventionAdmissionClient.js'"]);
for (const file of fs.readdirSync('src/domains', { recursive: true }).filter((file) => /\.(js|jsx)$/.test(file))) {
  const source = read(path.join('src/domains', file));
  if (source.includes("from '@intervention-admission-runtime'")) failures.push(`${file}: laboratory admission cannot be a production owner`);
  for (const retired of ['markNudgeDayEpisodeAbsorbed', 'readNudgeDayEpisodeOwnerSnapshot']) {
    if (source.includes(retired)) failures.push(`${file}: retired synthetic Site absorption owner ${retired}`);
  }
}
const entryOwner = requireText('src/domains/protection/background/runtime/GateRuntimeStateOwner.js', [
  'GateEntryApprovalRepository', 'approveGateEntry', 'observeGateEntryApproval', 'approvalTail.then',
  'getGateEntryApproval', 'observeGateEntryPresence',
]);
for (const forbidden of ['approvedTabSessions', 'GATE_CAUSAL_RELAY_WINDOW_MS', 'setTimeout(', 'setInterval(', 'consumptionMemory']) {
  if (entryOwner.includes(forbidden)) failures.push(`Gate approval has a second authority: ${forbidden}`);
}
const grants = read('src/domains/protection/background/runtime/gateInterventionPassPolicy.js');
if (grants.includes('GATE_PASS_SCOPES.HOST') || grants.includes('RETURN_DECISION') || grants.includes('ENTRY_DECISION')) {
  failures.push('Ordinary Gate decisions must not also mint timed host passes');
}
requireText('src/domains/protection/background/GateInterstitialController.js', [
  'admission().selectGate(session.sessionId, session.tabId', 'await applyGateDecisionWithLedger',
]);
requireText('src/domains/tracking/background/trackingTickRunner.js', ['browserObservation.gateEntryPresence', 'isConsumptionObservationCurrent']);
requireText('src/domains/tracking/background/trackingBrowserEventHandlers.js', ['noteProtectedEntryActivity', 'readProtectedTabScope']);
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log('[intervention-scheduler] PASS: canonical admission, typed session storage and exact conclusion boundaries');
