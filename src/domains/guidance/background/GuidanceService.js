import { requireNudgeGoalEnds, isGoalEndEnabled } from '../../settings/config/nudgeConfig.js';
import {
  requireGuidanceGoal, requireGuidanceId, requireGuidanceString, requireGuidanceState,
  buildGuidanceState,
} from '../contracts/guidanceState.js';
import { resolveProfileResetGeneration } from '../../../platform/storage/runtime/ProfileResetLifecycleRepository.js';
import { PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT,
  resolveProgressionJourneyStage } from '../../progression/policy/progressionJourneyPolicy.js';
import { requireQualifiedUseFacts } from '../../progression/contracts/qualifiedUseFacts.js';

const LEASE_MS = 60_000;
function uniqueId() {
  if (typeof globalThis.crypto?.randomUUID !== 'function') throw new Error('GUIDANCE_ID_GENERATOR_REQUIRED');
  return globalThis.crypto.randomUUID();
}
function installationFrom(intent, source, nowMs, settingsVersion = null) {
  return { status: 'installed', intentId: intent.intentId, globalGoalMinutes: intent.globalGoalMinutes,
    settingsVersion, installedAtMs: nowMs, source };
}
function matches(settings, goal) {
  return settings.globalGoal === goal && isGoalEndEnabled(settings.nudgeConfig, 'global');
}
function receiptFor(state, id) {
  return Object.hasOwn(state.receipts, id) ? state.receipts[id]
    : { revision: 1, presentedAtMs: null, dismissedAtMs: null, completedAtMs: null };
}
export function createGuidanceService({
  repository, profileLifecycleRepository, progressionService, readSettings, readPresentationBusy,
  notifyJourney, now = () => Date.now(),
  readGlobalCapState = null,
} = {}) {
  for (const method of ['readState', 'writeState', 'readSession', 'writeSession', 'clear']) {
    if (typeof repository?.[method] !== 'function') throw new Error(`GUIDANCE_REPOSITORY_METHOD_REQUIRED:${method}`);
  }
  if (typeof readSettings !== 'function' || typeof readPresentationBusy !== 'function'
    || typeof notifyJourney !== 'function' || typeof progressionService?.readArtifactDisclosureSnapshot !== 'function'
    || typeof profileLifecycleRepository?.assertWriteAdmission !== 'function') throw new Error('GUIDANCE_OWNERS_REQUIRED');
  let queue = Promise.resolve();
  let globalCapReader = readGlobalCapState;
  const initializedStates = new Set();

  function enqueue(operation) {
    const pending = queue.then(operation);
    queue = pending.then(() => undefined, () => undefined);
    return pending;
  }
  async function context(request = {}) {
    const generation = resolveProfileResetGeneration(await profileLifecycleRepository.read());
    requireGuidanceString(generation);
    if (request.profileGeneration !== undefined && request.profileGeneration !== generation) throw new Error('GUIDANCE_PROFILE_GENERATION_STALE');
    await profileLifecycleRepository.assertWriteAdmission({ expectedResetId: generation });
    if (typeof globalCapReader !== 'function') throw new Error('GUIDANCE_GLOBAL_CAP_OWNER_REQUIRED');
    const [canonicalState, session, disclosure, firstVision, settings, globalCap] = await Promise.all([
      repository.readState(), repository.readSession(), progressionService.readArtifactDisclosureSnapshot(),
      progressionService.readFirstVisionSnapshot({ expectedProfileGeneration: generation }), readSettings(), globalCapReader(),
    ]);
    requireNudgeGoalEnds(settings?.nudgeConfig?.goalEnds);
    if (!Number.isInteger(settings.globalGoal)
      || !Array.isArray(settings.blockedUrls)) throw new Error('GUIDANCE_SETTINGS_INVALID');
    const progress = disclosure.unlockProgress;
    if (!progress || typeof progress.debugOverrideActive !== 'boolean'
      || !Number.isInteger(progress.qualifiedUseDayCount) || !Number.isInteger(progress.canonicalQualifiedUseDayCount)) throw new Error('GUIDANCE_PROGRESSION_INVALID');
    const preview = progress.debugOverrideActive;
    const qualifiedUseFacts = requireQualifiedUseFacts(progress.qualifiedUseFacts);
    if (!globalCap || typeof globalCap.exceeded !== 'boolean') throw new Error('GUIDANCE_GLOBAL_CAP_STATE_INVALID');
    if (preview && session.previewDay !== qualifiedUseFacts.effectiveDayCount) {
      session.previewState = buildGuidanceState(); session.previewDay = qualifiedUseFacts.effectiveDayCount; session.claim = null;
      await repository.writeSession(session);
    }
    const state = structuredClone(preview ? session.previewState : canonicalState);
    const ctx = { state, session, disclosure, settings, generation, preview,
      firstVisionSpent: firstVision.effectiveFirstVisionState === 'spent',
      installationAdmissionBlocked: globalCap.exceeded,
      journeyDay: progress.qualifiedUseDayCount, canonicalJourneyDay: progress.canonicalQualifiedUseDayCount,
      qualifiedUseFacts };
    const initializationKey = `${generation}:${preview}:${preview ? qualifiedUseFacts.effectiveDayCount : 'canonical'}`;
    if (!initializedStates.has(initializationKey)) {
      if (state.delivery.status === 'reserved') {
        state.delivery.status = 'delivery_uncertain'; await save(ctx);
      }
      if (state.pendingIntent !== null) {
        const intent = state.pendingIntent;
        if (intent.profileGeneration === generation && matches(settings, intent.globalGoalMinutes)) {
          state.installation = installationFrom(intent, 'configuration_reconciled', now());
        }
        state.pendingIntent = null;
        await save(ctx);
      }
      initializedStates.add(initializationKey);
    }
    if (state.installation === null && state.pendingIntent === null && settings.globalGoal > 0 && isGoalEndEnabled(settings.nudgeConfig, 'global')) {
      state.installation = installationFrom({ intentId: uniqueId(), globalGoalMinutes: settings.globalGoal }, 'existing_configuration', now());
      await save(ctx);
    }
    return ctx;
  }
  async function save(ctx) {
    await profileLifecycleRepository.assertWriteAdmission({ expectedResetId: ctx.generation });
    requireGuidanceState(ctx.state);
    if (ctx.preview) {
      ctx.session.previewState = ctx.state;
      await repository.writeSession(ctx.session);
    } else await repository.writeState(ctx.state);
  }
  function view(ctx) {
    const receipt = receiptFor(ctx.state, 'flare.first_installation');
    const installation = ctx.state.installation;
    const pendingInstallation = installation !== null && installation.source !== 'existing_configuration'
      && !ctx.installationAdmissionBlocked && receipt.presentedAtMs === null && matches(ctx.settings, installation.globalGoalMinutes) ? installation : null;
    const installationReplay = installation !== null && !ctx.installationAdmissionBlocked
      && isGoalEndEnabled(ctx.settings.nudgeConfig, 'global') && ctx.settings.globalGoal > 0
      && ctx.disclosure.unlockProgress.effectiveFamilyIds.includes('flare')
      ? { ...installation, globalGoalMinutes: ctx.settings.globalGoal } : null;
    const artifactStage = resolveProgressionJourneyStage(ctx.journeyDay);
    const stageChange = ctx.firstVisionSpent && artifactStage.qualifiedUseDayCount >= 2
      && artifactStage.newFamilyIds.length > 0 && artifactStage.qualifiedUseDayCount > ctx.state.lastPresentedJourneyDay
      ? { day: artifactStage.qualifiedUseDayCount, newFamilyIds: [...artifactStage.newFamilyIds],
        siteRegistrationBudget: ctx.disclosure.unlockProgress.siteRegistrationBudget } : null;
    return { contract: 'guidance_state_v1', profileGeneration: ctx.generation, journeyDay: ctx.journeyDay,
      canonicalJourneyDay: ctx.canonicalJourneyDay, firstVisionSpent: ctx.firstVisionSpent, preview: ctx.preview,
      qualifiedUseFacts: ctx.qualifiedUseFacts,
      receipts: ctx.state.receipts, installation, installationReplay, pendingInstallation, stageChange,
      nextStage: ctx.disclosure.unlockProgress.nextStage,
      journeyTargetDayCount: ctx.disclosure.unlockProgress.targetDayCount,
      siteRegistrationBudget: ctx.disclosure.unlockProgress.siteRegistrationBudget,
      installationAdmissionBlocked: ctx.installationAdmissionBlocked };
  }
  function assertEligible(ctx, request) {
    const id = requireGuidanceId(request.guideId);
    if (request.revision !== 1 || request.visible !== true) throw new Error('GUIDANCE_PRESENTATION_NOT_VISIBLE');
    if (id !== 'popup.first_setup' && !ctx.firstVisionSpent) throw new Error('GUIDANCE_FIRST_VISION_ACTIVE');
    const family = /^artifact\.([a-z]+)\.first_setup$/.exec(id);
    if (family && !ctx.disclosure.unlockProgress.effectiveFamilyIds.includes(family[1])) throw new Error('GUIDANCE_ARTIFACT_LOCKED');
    if (id === 'journey.stage_change') {
      const stageChange = view(ctx).stageChange;
      if (stageChange === null || request.journeyDay !== stageChange.day) throw new Error('GUIDANCE_STAGE_ALREADY_PRESENTED');
    }
    if (id === 'flare.first_installation') {
      if (ctx.installationAdmissionBlocked) throw new Error('GUIDANCE_PROTECTION_PRESENTATION_BUSY');
      const configurationEligible = request.replay === true
        ? isGoalEndEnabled(ctx.settings.nudgeConfig, 'global') && ctx.settings.globalGoal > 0
        : ctx.state.installation !== null && matches(ctx.settings, ctx.state.installation.globalGoalMinutes);
      if (ctx.state.installation === null || !configurationEligible
        || !ctx.disclosure.unlockProgress.effectiveFamilyIds.includes('flare')) throw new Error('GUIDANCE_INSTALLATION_UNAVAILABLE');
    }
    if (id !== 'journey.stage_change' && request.replay !== true && receiptFor(ctx.state, id).presentedAtMs !== null) throw new Error('GUIDANCE_ALREADY_PRESENTED');
    if ((id === 'garden.first_site' || id === 'popup.first_setup') && ctx.settings.blockedUrls.length > 0) throw new Error('GUIDANCE_FIRST_SITE_COMPLETE');
  }
  async function ownClaim(ctx, request) {
    const claim = ctx.session.claim;
    if (claim === null || claim.claimId !== request.claimId || claim.owner !== request.owner
      || claim.profileGeneration !== ctx.generation || claim.expiresAtMs <= now()) throw new Error('GUIDANCE_CLAIM_STALE');
    if (claim.preview !== ctx.preview) throw new Error('GUIDANCE_PROJECTION_CHANGED');
    return claim;
  }
  async function assertLiveClaim(ctx, claim) {
    const family = /^artifact\.([a-z]+)\.first_setup$/.exec(claim.guideId);
    const installation = claim.guideId === 'flare.first_installation';
    const eligible = (claim.guideId === 'popup.first_setup' || ctx.firstVisionSpent)
      && (!family || ctx.disclosure.unlockProgress.effectiveFamilyIds.includes(family[1]))
      && (!installation || (ctx.state.installation !== null
        && ctx.disclosure.unlockProgress.effectiveFamilyIds.includes('flare')
        && matches(ctx.settings, claim.installationGoalMinutes)));
    const busy = await readPresentationBusy() || (installation && ctx.installationAdmissionBlocked);
    if (!eligible || busy) {
      ctx.session.claim = null;
      await repository.writeSession(ctx.session);
      throw new Error(busy ? 'GUIDANCE_PROTECTION_PRESENTATION_BUSY' : 'GUIDANCE_CLAIM_STALE');
    }
  }
  return {
    setGlobalCapStateReader: (reader) => {
      if (typeof reader !== 'function' || globalCapReader !== null) throw new Error('GUIDANCE_GLOBAL_CAP_OWNER_BINDING_INVALID');
      globalCapReader = reader;
    },
    readState: (request = {}) => enqueue(async () => view(await context(request))),
    claim: (request) => enqueue(async () => {
      const ctx = await context(request);
      assertEligible(ctx, request);
      if (await readPresentationBusy()) throw new Error('GUIDANCE_PROTECTION_PRESENTATION_BUSY');
      const old = ctx.session.claim;
      if (old !== null && old.expiresAtMs > now() && old.profileGeneration === ctx.generation) throw new Error('GUIDANCE_PRESENTATION_BUSY');
      const claim = { claimId: uniqueId(), guideId: request.guideId, revision: 1,
        hostId: requireGuidanceString(request.hostId), documentId: requireGuidanceString(request.documentId),
        owner: requireGuidanceString(request.owner), profileGeneration: ctx.generation, expiresAtMs: now() + LEASE_MS,
        preview: ctx.preview, replay: request.replay === true,
        journeyDay: request.guideId === 'journey.stage_change' ? view(ctx).stageChange.day : ctx.journeyDay,
        installationGoalMinutes: request.guideId === 'flare.first_installation' ? ctx.settings.globalGoal : null };
      ctx.session.claim = claim;
      await repository.writeSession(ctx.session);
      return claim;
    }),
    renew: (request) => enqueue(async () => {
      const ctx = await context(request); const claim = await ownClaim(ctx, request);
      await assertLiveClaim(ctx, claim);
      claim.expiresAtMs = now() + LEASE_MS; await repository.writeSession(ctx.session); return claim;
    }),
    markPresented: (request) => enqueue(async () => {
      const ctx = await context(request); const claim = await ownClaim(ctx, request);
      await assertLiveClaim(ctx, claim);
      if (!claim.replay) {
        const receipt = receiptFor(ctx.state, claim.guideId);
        ctx.state.receipts[claim.guideId] = { ...receipt, presentedAtMs: receipt.presentedAtMs === null ? now() : receipt.presentedAtMs };
        if (claim.guideId === 'journey.stage_change') ctx.state.lastPresentedJourneyDay = Math.max(ctx.state.lastPresentedJourneyDay, claim.journeyDay);
        await save(ctx);
      }
      return view(ctx);
    }),
    dismiss: (request) => enqueue(async () => {
      const ctx = await context(request); const claim = await ownClaim(ctx, request);
      if (!claim.replay) {
        const receipt = receiptFor(ctx.state, claim.guideId);
        if (receipt.presentedAtMs === null) throw new Error('GUIDANCE_NOT_PRESENTED');
        ctx.state.receipts[claim.guideId] = { ...receipt, dismissedAtMs: now() }; await save(ctx);
      }
      ctx.session.claim = null; await repository.writeSession(ctx.session); return view(ctx);
    }),
    complete: (request) => enqueue(async () => {
      const ctx = await context(request); const claim = await ownClaim(ctx, request);
      await assertLiveClaim(ctx, claim);
      if (!claim.replay) {
        if (!['garden.first_site', 'popup.first_setup', 'flare.first_installation'].includes(claim.guideId)) throw new Error('GUIDANCE_COMPLETION_REQUIRES_ACTION');
        const receipt = receiptFor(ctx.state, claim.guideId);
        if (receipt.presentedAtMs === null) throw new Error('GUIDANCE_NOT_PRESENTED');
        if (['garden.first_site', 'popup.first_setup'].includes(claim.guideId) && ctx.settings.blockedUrls.length === 0) throw new Error('GUIDANCE_FIRST_SITE_NOT_COMMITTED');
        // Completion is a guidance/scene receipt, never a protection success fact.
        ctx.state.receipts[claim.guideId] = { ...receipt, completedAtMs: now() }; await save(ctx);
      }
      ctx.session.claim = null; await repository.writeSession(ctx.session); return view(ctx);
    }),
    release: (request) => enqueue(async () => {
      const ctx = await context(request);
      const claim = ctx.session.claim;
      if (claim !== null && claim.claimId === request.claimId && claim.owner === request.owner) {
        ctx.session.claim = null; await repository.writeSession(ctx.session);
      }
      return view(ctx);
    }),
    prepareFurinInstallation: (request) => enqueue(async () => {
      const ctx = await context(request);
      if (!ctx.firstVisionSpent || !ctx.disclosure.unlockProgress.effectiveFamilyIds.includes('flare')) throw new Error('GUIDANCE_FLARE_LOCKED');
      const goal = requireGuidanceGoal(request.globalGoalMinutes);
      const commandId = requireGuidanceString(request.settingsCommandId);
      if (ctx.state.installation !== null) throw new Error('GUIDANCE_INSTALLATION_ALREADY_RECORDED');
      const intent = { intentId: uniqueId(), settingsCommandId: commandId, globalGoalMinutes: goal,
        preparedAtMs: now(), profileGeneration: ctx.generation };
      ctx.state.pendingIntent = intent; await save(ctx);
      return { intentId: intent.intentId, settingsCommandId: commandId, preview: ctx.preview };
    }),
    recordFurinInstallation: (request) => enqueue(async () => {
      const ctx = await context(request); const intent = ctx.state.pendingIntent;
      if (intent === null || intent.intentId !== request.intentId || intent.settingsCommandId !== request.settingsCommandId
        || intent.profileGeneration !== ctx.generation) throw new Error('GUIDANCE_INSTALLATION_INTENT_STALE');
      const ack = request.acknowledgement;
      if (!ack || !Number.isInteger(ack.version) || ack.version < 0 || ack.error
        || ack.committedItems?.globalGoal !== intent.globalGoalMinutes || ack.committedItems?.nudgeConfig?.goalEnds?.global !== true
        || !matches(ctx.settings, intent.globalGoalMinutes)) throw new Error('GUIDANCE_INSTALLATION_ACK_INVALID');
      requireNudgeGoalEnds(ack.committedItems.nudgeConfig.goalEnds);
      if (ack.propagation && ack.propagation.status !== 'succeeded') throw new Error('GUIDANCE_INSTALLATION_PROPAGATION_PENDING');
      ctx.state.installation = installationFrom(intent, 'settings_ack', now(), ack.version);
      ctx.state.pendingIntent = null; await save(ctx); return view(ctx);
    }),
    notifyJourneyAdvance: (result, { activityDayKey }) => enqueue(async () => {
      if (result.activityDayOutcome.qualifiedDayRecorded !== true) return;
      if (!Number.isSafeInteger(result.qualifiedActivityDayCount) || result.qualifiedActivityDayCount < 1) {
        throw new Error('GUIDANCE_QUALIFIED_ACTIVITY_RESULT_INVALID');
      }
      if (result.qualifiedActivityDayCount > PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT) return;
      const recordedStage = resolveProgressionJourneyStage(result.qualifiedActivityDayCount);
      if (recordedStage.qualifiedUseDayCount !== result.qualifiedActivityDayCount
        || recordedStage.newFamilyIds.length === 0) return;
      const ctx = await context();
      const day = resolveProgressionJourneyStage(ctx.canonicalJourneyDay).qualifiedUseDayCount;
      if (ctx.preview || !ctx.firstVisionSpent || day < 2 || ctx.state.lastPresentedJourneyDay >= day
        || ctx.state.delivery.day >= day || ctx.state.delivery.activityDayKey === activityDayKey) return;
      ctx.state.delivery = { day, activityDayKey, status: 'reserved' }; await save(ctx);
      try {
        const outcome = await notifyJourney({ day, activityDayKey });
        ctx.state.delivery.status = outcome.dispatched === true ? 'sent' : 'skipped'; await save(ctx);
      } catch (error) {
        ctx.state.delivery.status = 'delivery_uncertain'; await save(ctx); throw error;
      }
    }),
    clearForProfileReset: async () => { await queue; await repository.clear(); initializedStates.clear(); },
  };
}
