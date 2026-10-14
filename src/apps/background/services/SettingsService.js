import { BUILD_INCLUDE_DEBUG_TOOLS } from '../../../platform/build/releaseCapabilities.js';
import { beginSettingsFlowTiming, endSettingsFlowTiming } from '../../../platform/diagnostics/settingsFlowTiming.js';
import {
  FULL_SETTINGS_RECONCILE_CHANGED_KEYS,
  normalizeChangedKeys,
  shouldBroadcastProtection,
  shouldInvalidateFilterSettingsCache,
  shouldRefreshSettingsCache,
  shouldRunRuntimeSettingsAdapters,
  shouldSyncManagedContentScripts,
} from '../../../domains/settings/config/settingsUpdateKeys.js';
import { isPrivilegedSettingsFlowSender } from '../../../platform/security/senderTrust.js';
import { isEchoArtifactMutationSuppressed } from '../../../domains/protection/runtime/echoArtifactMutationPolicy.js';
import { assertGenericSettingsMutationAllowed } from '../../../domains/settings/config/settingsMutationOwnership.js';
import { createSettingsCommittedItems } from '../../../domains/settings/config/settingsCommitAcknowledgement.js';
import {
  applySettingsCacheItems,
  buildSettingsCacheDefaults,
  createDefaultSettingsCache,
  mergeNudgeRuntimeConfig,
} from './settingsCacheState.js';
import { prepareCanonicalSettingsItems } from './settingsCanonicalPatch.js';
import { assertSecuritySettingsMutationAuthorized, hasSecuritySettingsMutation } from './settingsSecurityMutationPolicy.js';
import { DEFAULT_SECURITY_SETTINGS } from '../../../platform/storage/security/SecuritySettingsQueryService.js';
import { createSettingsCollectionAdmission, getSettingsCollectionScopeSignature } from './settingsCollectionAdmission.js';
import { changesTrackingPolicyBoundary } from './settingsTrackingPolicyBoundary.js';
import {
  requireCanonicalDomainHashList,
  requireCanonicalDomainGoalHashMap,
} from '../../../platform/security/domainHashing.js';
import { requireCanonicalDomainHmacSecret } from '../../../platform/storage/security/keyMaterialContract.js';
import {
  buildPostCommitSettingsEffectPlan,
  describeSettingsError,
  hasPostCommitSettingsWork,
  logSettingsFlowFailure,
} from './settingsPostCommitEffects.js';

const ASYNC_FUNCTION_PROTOTYPE = Object.getPrototypeOf(async function settingsMutationAsyncPrepare() {});
const DOMAIN_RULE_PERSISTENCE_KEYS = Object.freeze([
  'blockedUrls', 'allowedUrls', 'siteGoals', 'siteGoalMeta', 'siteRuleTimeline',
]);
const DOMAIN_RULE_DERIVED_CACHE_KEYS = Object.freeze({
  blockedUrls: 'blockedUrlHashes',
  allowedUrls: 'allowedUrlHashes',
  siteGoals: 'siteGoalHashes',
});
const SETTINGS_PROFILE_MUTATION_PHASES = Object.freeze({
  OPEN: 'open',
  QUIESCING: 'quiescing',
  QUIESCED: 'quiesced',
});

function isNativeAsyncFunction(value) {
  return typeof value === 'function'
    && Object.getPrototypeOf(value) === ASYNC_FUNCTION_PROTOTYPE;
}

function isThenable(value) {
  return !!value && typeof value.then === 'function';
}

function cloneSettingsMutationSnapshot(settingsCache) {
  if (typeof globalThis.structuredClone !== 'function') {
    throw new Error('SETTINGS_MUTATION_SNAPSHOT_CLONE_REQUIRED');
  }
  try {
    return globalThis.structuredClone(settingsCache);
  } catch (cause) {
    const error = new Error('SETTINGS_MUTATION_SNAPSHOT_CLONE_FAILED', { cause });
    error.code = 'SETTINGS_MUTATION_SNAPSHOT_CLONE_FAILED';
    throw error;
  }
}

function requireExternalSettingsMutationOutcome(value) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || typeof value.settingsChanged !== 'boolean'
    || !Object.prototype.hasOwnProperty.call(value, 'result')
  ) {
    throw new Error('SETTINGS_EXTERNAL_MUTATION_OUTCOME_INVALID');
  }
  return value;
}

function attachExternalSettingsReconciliation(error, reconciliation) {
  const primaryError = error instanceof Error
    ? error
    : new Error(typeof error === 'string' && error.trim() ? error.trim() : 'SETTINGS_EXTERNAL_MUTATION_FAILED');
  try {
    primaryError.settingsReconciliation = reconciliation;
    return primaryError;
  } catch {
    const wrappedError = new Error(primaryError.message, { cause: primaryError });
    wrappedError.code = primaryError.code || null;
    wrappedError.settingsReconciliation = reconciliation;
    return wrappedError;
  }
}

function describeSettingsSender(sender = null) {
  return {
    id: typeof sender?.id === 'string' && sender.id.trim() ? sender.id.trim() : null,
    url: typeof sender?.url === 'string' && sender.url.trim() ? sender.url.trim() : null,
    documentUrl: typeof sender?.documentUrl === 'string' && sender.documentUrl.trim()
      ? sender.documentUrl.trim()
      : null,
    origin: typeof sender?.origin === 'string' && sender.origin.trim() ? sender.origin.trim() : null,
    tabId: Number.isFinite(Number(sender?.tab?.id)) ? Math.floor(Number(sender.tab.id)) : null,
    frameId: Number.isFinite(Number(sender?.frameId)) ? Math.floor(Number(sender.frameId)) : null,
  };
}

export function createSettingsService({
  settingsPersistence,
} = {}) {
  if (
    !settingsPersistence
    || typeof settingsPersistence.get !== 'function'
    || typeof settingsPersistence.applyPatch !== 'function'
  ) {
    throw new Error('SETTINGS_SERVICE_PERSISTENCE_REQUIRED');
  }

  const settingsCache = createDefaultSettingsCache();
  const collectionAdmission = createSettingsCollectionAdmission();
  let settingsCacheLoaded = false;
  let settingsCacheLoadPromise = null;
  let settingsCacheLoadSettlement = null;
  let settingsChangeVersion = 0;
  let settingsMutationTail = Promise.resolve();
  let settingsMutationPreparationActive = false;
  let settingsExternalMutationInvocationActive = false;
  let profileMutationPhase = SETTINGS_PROFILE_MUTATION_PHASES.OPEN;
  let profileMutationQuiescePromise = null;
  let siteRegistrationAdmissionOwner = null;
  let siteRegistrationCommitObserver = null;
  let trackingPolicyMutationOwner = null;
  const changePipeline = {
    invalidateBootPrewarmSnapshot: null,
    schedulePostCommitSettingsEffects: null,
    waitForPostCommitSettingsTask: null,
  };

  function invalidateSettingsObservation() {
    settingsChangeVersion += 1;
    collectionAdmission.invalidate(Date.now());
  }

  function applySettingsCache(items = {}, { previousScope = null } = {}) {
    applySettingsCacheItems(settingsCache, items);
    if (previousScope !== null && previousScope !== getSettingsCollectionScopeSignature(settingsCache)) {
      invalidateSettingsObservation();
    }
    collectionAdmission.observe(settingsCache, Date.now());
  }

  function settleSettingsCacheHydration(request, error) {
    if (request === null || settingsCacheLoadSettlement !== request) return;
    settingsCacheLoadPromise = null;
    settingsCacheLoadSettlement = null;
    if (error === null) request.resolve();
    else request.reject(error);
  }

  async function refreshSettingsCacheNow() {
    const previousScope = settingsCacheLoaded ? getSettingsCollectionScopeSignature(settingsCache) : null;
    settingsCacheLoaded = false;
    try {
      const defaults = buildSettingsCacheDefaults();
      const items = await settingsPersistence.get(defaults);
      applySettingsCache(items, { previousScope });
      settingsCacheLoaded = true;
      settleSettingsCacheHydration(settingsCacheLoadSettlement, null);
    } catch (error) {
      invalidateSettingsObservation();
      settleSettingsCacheHydration(settingsCacheLoadSettlement, error);
      throw error;
    }
  }

  async function ensureSettingsCacheNow() {
    if (settingsCacheLoaded) return;
    try {
      // Already inside the Settings FIFO: this writer owns hydration instead
      // of awaiting a read request that may be queued behind the writer.
      await refreshSettingsCacheNow();
    } catch (error) {
      const details = describeSettingsError(error);
      console.error(
        `[LETHE] Failed to load settings cache: code=${details.code || 'n/a'} name=${details.name || 'n/a'} message=${details.message}`,
      );
      throw error;
    }
  }

  function assertSettingsPreparationInactive() {
    if (settingsMutationPreparationActive) {
      throw new Error('SETTINGS_MUTATION_PREPARE_REENTRANT');
    }
    if (settingsExternalMutationInvocationActive) {
      throw new Error('SETTINGS_EXTERNAL_MUTATION_REENTRANT');
    }
  }

  function assertProfileMutationAdmissionOpen() {
    if (profileMutationPhase !== SETTINGS_PROFILE_MUTATION_PHASES.OPEN) {
      throw new Error(`SETTINGS_PROFILE_MUTATION_ADMISSION_CLOSED:${profileMutationPhase}`);
    }
  }

  function refreshSettingsCache() {
    assertSettingsPreparationInactive();
    assertProfileMutationAdmissionOpen();
    return enqueueSettingsMutation(refreshSettingsCacheNow);
  }

  function ensureSettingsCache() {
    assertSettingsPreparationInactive();
    assertProfileMutationAdmissionOpen();
    // Hydration reads the current committed cache. Waiting behind a pending
    // writer here would invert Settings -> Stats -> Settings during a policy
    // boundary. Failed/unloaded state still hydrates in the mutation FIFO.
    if (settingsCacheLoaded) return Promise.resolve();
    if (settingsCacheLoadPromise !== null) return settingsCacheLoadPromise;
    const request = {};
    settingsCacheLoadPromise = new Promise((resolve, reject) => {
      request.resolve = resolve;
      request.reject = reject;
    });
    settingsCacheLoadSettlement = request;
    // A writer ahead of this queued task may hydrate first. Its canonical
    // refresh settles the same request, allowing a draining Stats task to
    // continue without joining the writer's completion. Obsolete queued tasks
    // must never hydrate or settle a later request.
    const scheduled = enqueueSettingsMutation(() => (
      settingsCacheLoadSettlement === request ? ensureSettingsCacheNow() : undefined
    ));
    void scheduled.catch((error) => settleSettingsCacheHydration(request, error));
    return settingsCacheLoadPromise;
  }

  function getSettingsChangeVersion() {
    return settingsChangeVersion;
  }

  function configureChangePipeline(dependencies = {}) {
    if (!dependencies || typeof dependencies !== 'object') return;
    if (typeof dependencies.invalidateBootPrewarmSnapshot === 'function') {
      changePipeline.invalidateBootPrewarmSnapshot = dependencies.invalidateBootPrewarmSnapshot;
    }
    if (typeof dependencies.schedulePostCommitSettingsEffects === 'function') {
      changePipeline.schedulePostCommitSettingsEffects = dependencies.schedulePostCommitSettingsEffects;
    }
    if (typeof dependencies.waitForPostCommitSettingsTask === 'function') {
      changePipeline.waitForPostCommitSettingsTask = dependencies.waitForPostCommitSettingsTask;
    }
  }

  function shouldAutoPurgeBlockedSites({ changedKeys = [], sender = null } = {}) {
    if (!Array.isArray(changedKeys)) {
      return false;
    }
    const isTargetKeyChanged = changedKeys.includes('blockedUrls')
      || changedKeys.includes('historyCleanupForBlocked')
      || changedKeys.includes('artifactControlState');
    if (!isTargetKeyChanged) {
      return false;
    }
    if (!settingsCache.historyCleanupForBlocked || isEchoArtifactMutationSuppressed(settingsCache)) {
      return false;
    }
    if (!isPrivilegedSettingsFlowSender(sender)) {
      console.warn('[LETHE] Auto-purge skipped for untrusted settings sender');
      return false;
    }
    return true;
  }

  function shouldSyncBlockedBookmarks({ changedKeys = [] } = {}) {
    if (!Array.isArray(changedKeys) || changedKeys.length === 0) {
      return false;
    }
    return changedKeys.some((key) => (
      key === 'blockedUrls'
      || key === 'concealBlockedBookmarks'
      || key === 'permissionRefresh'
      || key === 'artifactControlState'
    ));
  }

  function enqueueSettingsMutation(task) {
    const run = settingsMutationTail.then(task, task);
    settingsMutationTail = run.catch(() => {});
    return run;
  }

  async function applySettingsChangeNow({
    actionReason = 'settings_change',
    items = null,
    changedKeys = null,
    sender = null,
    persist = false,
    emitSettingsUpdated = false,
    invalidateFilterCache = true,
    refreshForBroadcast = false,
    reportBroadcastAsRefresh = false,
    preCommittedChangedKeys = [],
    propagationWaitTimeoutMs = 0,
    securityAuthorization = null,
  } = {}) {
    const normalizedItems = items && typeof items === 'object' ? items : {};
    const itemKeys = Object.keys(normalizedItems);
    const senderSummary = describeSettingsSender(sender);

    const hydrationChangedKeys = normalizeChangedKeys(preCommittedChangedKeys);
    if (persist && !settingsCacheLoaded) {
      await ensureSettingsCacheNow();
    }

    let canonicalItems = persist
      ? prepareCanonicalSettingsItems(normalizedItems, settingsCache)
      : normalizedItems;

    if (persist && hasSecuritySettingsMutation(canonicalItems)) {
      await assertSecuritySettingsMutationAuthorized({
        items: canonicalItems,
        currentSettings: await settingsPersistence.get(DEFAULT_SECURITY_SETTINGS),
        authorization: securityAuthorization,
      });
    }

    if (persist && Object.hasOwn(canonicalItems, 'blockedUrls')) {
      if (typeof siteRegistrationCommitObserver !== 'function') {
        throw new Error('SETTINGS_SITE_REGISTRATION_COMMIT_OBSERVER_REQUIRED');
      }
      const currentDomains = settingsCache.blockedUrls;
      const nextDomains = canonicalItems.blockedUrls;
      const hasNewProtection = nextDomains.some((domain) => !currentDomains.includes(domain));
      if (hasNewProtection) {
        if (typeof siteRegistrationAdmissionOwner !== 'function') {
          throw new Error('SETTINGS_SITE_REGISTRATION_ADMISSION_OWNER_REQUIRED');
        }
        // Admission runs in this same mutation lane against the latest committed
        // list, before any write. Parallel registrations cannot overspend a slot.
        const admissionStarted = beginSettingsFlowTiming();
        await siteRegistrationAdmissionOwner({ currentDomains, nextDomains });
        endSettingsFlowTiming('registration_admission', admissionStarted);
      }
    }

    let nextChangedKeys;
    let version;
    let committedItems;
    const postCommitFailures = [];

    async function commit(policyBoundaryAt = null, onCachePublished = null) {
    if (policyBoundaryAt !== null) {
      // Rule epochs and the old foreground prefix share the exact admitted
      // Stats boundary, even when an earlier Stats task delayed this writer.
      canonicalItems = prepareCanonicalSettingsItems(normalizedItems, settingsCache, { now: policyBoundaryAt });
    }
    let persistedChangedKeys = [];
    let observationFencedBeforeWrite = false;
    if (persist) {
      if (collectionAdmission.beforeChange(settingsCache, { ...settingsCache, ...canonicalItems },
        policyBoundaryAt === null ? Date.now() : policyBoundaryAt)) {
        settingsChangeVersion += 1;
        observationFencedBeforeWrite = true;
      }
      try {
        const persistenceStarted = BUILD_INCLUDE_DEBUG_TOOLS ? performance.now() : null;
        persistedChangedKeys = normalizeChangedKeys(await settingsPersistence.applyPatch(
          canonicalItems,
          { emitSettingsUpdated: !!emitSettingsUpdated },
        ));
        if (BUILD_INCLUDE_DEBUG_TOOLS) console.debug('[SETTINGS_FLOW][timing]', JSON.stringify({
          phase: 'persistence', actionReason,
          durationMs: performance.now() - persistenceStarted,
        }));
      } catch (error) {
        settingsCacheLoaded = false;
        // The write may have reached storage. Both model tokens and audible
        // anchors must lose continuity until canonical hydration succeeds.
        invalidateSettingsObservation();
        logSettingsFlowFailure('persist_failed', {
          actionReason,
          itemKeys,
          sender: senderSummary,
        }, error);
        throw error;
      }
    }
    nextChangedKeys = persist
      ? normalizeChangedKeys([...hydrationChangedKeys, ...persistedChangedKeys])
      : normalizeChangedKeys(Array.isArray(changedKeys) ? changedKeys : []);
    version = persist && nextChangedKeys.length > 0 && !observationFencedBeforeWrite
      ? (settingsChangeVersion += 1)
      : getSettingsChangeVersion();
    committedItems = persist
      ? createSettingsCommittedItems(canonicalItems)
      : {};
    let derivedCacheItems = {};
    if (persist && DOMAIN_RULE_PERSISTENCE_KEYS.some((key) => Object.hasOwn(canonicalItems, key))) {
      const readKeys = [
        'domainHmacSecret',
        ...Object.entries(DOMAIN_RULE_DERIVED_CACHE_KEYS)
          .filter(([key]) => Object.hasOwn(canonicalItems, key))
          .map(([, key]) => key),
      ];
      try {
        // Persistence computes these private artifacts. Read its current typed
        // result before publishing one consistent raw-rule/hash cache snapshot.
        const cacheReadbackStarted = beginSettingsFlowTiming();
        const storedItems = await settingsPersistence.get(Object.fromEntries(
          readKeys.map((key) => [key, undefined]),
        ));
        endSettingsFlowTiming('private_cache_readback', cacheReadbackStarted);
        derivedCacheItems.domainHmacSecret = requireCanonicalDomainHmacSecret(storedItems.domainHmacSecret);
        for (const key of readKeys.slice(1)) {
          derivedCacheItems[key] = key === 'siteGoalHashes'
            ? requireCanonicalDomainGoalHashMap(storedItems[key])
            : requireCanonicalDomainHashList(storedItems[key]);
        }
      } catch (error) {
        settingsCacheLoaded = false;
        invalidateSettingsObservation();
        logSettingsFlowFailure('canonical_cache_readback_failed', {
          actionReason, changedKeys: nextChangedKeys, itemKeys, sender: senderSummary,
        }, error);
        const failure = { stage: 'cache_readback', error: describeSettingsError(error) };
        const failures = [failure];
        if (typeof changePipeline.invalidateBootPrewarmSnapshot === 'function') {
          try {
            changePipeline.invalidateBootPrewarmSnapshot(actionReason);
          } catch (invalidationError) {
            logSettingsFlowFailure('boot_prewarm_invalidation_failed', {
              actionReason, changedKeys: nextChangedKeys, sender: senderSummary,
            }, invalidationError);
            failures.push({
              stage: 'boot_prewarm_invalidation', error: describeSettingsError(invalidationError),
            });
          }
        }
        // The durable write succeeded. Preserve its public ACK, invalidate the
        // read cache, and let explicit propagation retry hydrate before effects.
        return { status: 'cache_readback_failed', result: {
          changedKeys: nextChangedKeys,
          version,
          committedItems,
          applied: {
            refreshed: false, syncScripts: false, broadcast: false, invalidatedFilterCache: false,
          },
          propagation: {
            status: 'schedule_failed', taskId: null, commitVersion: version,
            changedKeys: [...nextChangedKeys], failures,
          },
          postCommitFailures: failures,
        } };
      }
    }

    if (persist && Object.keys(canonicalItems).length > 0) {
      applySettingsCache({ ...canonicalItems, ...derivedCacheItems });
      if (onCachePublished !== null) {
        try {
          await onCachePublished();
        } catch (error) {
          // The durable settings ACK remains true. Runtime retirement failures
          // remain explicit and the ordinary propagation owner retries effects.
          postCommitFailures.push({ stage: 'tracking_boundary', error: describeSettingsError(error) });
        }
      }
    }

    return { status: 'published' };
    }

    let commitResult;
    if (persist && changesTrackingPolicyBoundary(settingsCache, canonicalItems)) {
      if (typeof trackingPolicyMutationOwner !== 'function') {
        throw new Error('SETTINGS_TRACKING_POLICY_MUTATION_OWNER_REQUIRED');
      }
      commitResult = await trackingPolicyMutationOwner({ commit });
    } else {
      commitResult = await commit();
    }
    if (commitResult.status === 'cache_readback_failed') return commitResult.result;
    if (commitResult.status !== 'published') throw new Error('SETTINGS_TRACKING_POLICY_COMMIT_RESULT_INVALID');

    // The Stats boundary is now released. Observers and propagation may await
    // their own Stats work while this settings mutation retains FIFO ordering.

    if (persist && Object.hasOwn(canonicalItems, 'blockedUrls')) {
      try {
        // This is committed membership, observed before the mutation lane can
        // accept a later removal. A requested patch is never milestone evidence.
        const journeyStarted = beginSettingsFlowTiming();
        await siteRegistrationCommitObserver({
          protectedSiteCount: new Set(settingsCache.blockedUrls).size,
        });
        endSettingsFlowTiming('registration_journey_receipt', journeyStarted);
      } catch (error) {
        logSettingsFlowFailure('registration_journey_observation_failed', {
          actionReason, changedKeys: nextChangedKeys, sender: senderSummary,
        }, error);
        postCommitFailures.push({ stage: 'registration_journey', error: describeSettingsError(error) });
      }
    }

    if (persist && nextChangedKeys.length === 0) {
      return {
        changedKeys: [],
        version,
        committedItems,
        applied: {
          refreshed: false,
          syncScripts: false,
          broadcast: false,
          invalidatedFilterCache: false,
        },
        ...(postCommitFailures.length > 0 ? { postCommitFailures } : {}),
      };
    }

    const shouldRefresh = !persist && shouldRefreshSettingsCache(nextChangedKeys);
    const shouldSyncScripts = shouldSyncManagedContentScripts(nextChangedKeys);
    const shouldBroadcast = shouldBroadcastProtection(nextChangedKeys);
    const shouldInvalidateFilterCache = invalidateFilterCache
      && shouldInvalidateFilterSettingsCache(nextChangedKeys);
    const shouldAutoPurge = shouldAutoPurgeBlockedSites({
      changedKeys: nextChangedKeys,
      sender,
    });
    const shouldSyncBlockedBookmarksEffect = shouldSyncBlockedBookmarks({
      changedKeys: nextChangedKeys,
    });
    const shouldRunRuntimeAdapters = shouldRunRuntimeSettingsAdapters(nextChangedKeys);
    const postCommitPlan = buildPostCommitSettingsEffectPlan({
      shouldRefresh: shouldRefresh || (!persist && (
        shouldSyncScripts || (refreshForBroadcast && shouldBroadcast)
      )),
      shouldAutoPurge,
      shouldSyncBlockedBookmarks: shouldSyncBlockedBookmarksEffect,
      shouldRunRuntimeAdapters,
      shouldSyncScripts,
      shouldBroadcast,
    });
    const hasPostCommitWork = hasPostCommitSettingsWork(postCommitPlan);

    if (typeof changePipeline.invalidateBootPrewarmSnapshot === 'function') {
      try {
        changePipeline.invalidateBootPrewarmSnapshot(actionReason);
      } catch (error) {
        logSettingsFlowFailure('boot_prewarm_invalidation_failed', {
          actionReason,
          changedKeys: nextChangedKeys,
          sender: senderSummary,
        }, error);
        if (!persist) throw error;
        postCommitFailures.push({
          stage: 'boot_prewarm_invalidation',
          error: describeSettingsError(error),
        });
      }
    }

    if (shouldInvalidateFilterCache) {
      settingsPersistence.invalidateFilterSettingsCache();
    }

    const result = {
      changedKeys: nextChangedKeys,
      version,
      committedItems,
      applied: {
        refreshed: false,
        syncScripts: false,
        broadcast: false,
        invalidatedFilterCache: shouldInvalidateFilterCache,
      },
    };
    if (hasPostCommitWork) {
      try {
        if (typeof changePipeline.schedulePostCommitSettingsEffects !== 'function') {
          throw new Error('SETTINGS_PROPAGATION_COORDINATOR_REQUIRED');
        }
        const propagation = await changePipeline.schedulePostCommitSettingsEffects({
          actionReason,
          commitVersion: version,
          changedKeys: nextChangedKeys,
          ...postCommitPlan,
        }, {
          waitForCompletion: !persist,
          ...(propagationWaitTimeoutMs > 0 ? { timeoutMs: propagationWaitTimeoutMs } : {}),
        });
        result.propagation = propagation;
        if (!persist) {
          if (propagation?.status !== 'succeeded') {
            const error = new Error('SETTINGS_PROPAGATION_FAILED');
            error.code = 'SETTINGS_PROPAGATION_FAILED';
            error.propagation = propagation;
            throw error;
          }
          result.applied.refreshed = (
            propagation?.applied?.refreshed === true
            || (reportBroadcastAsRefresh && propagation?.applied?.broadcast === true)
          );
          result.applied.syncScripts = propagation?.applied?.syncScripts === true;
          result.applied.broadcast = propagation?.applied?.broadcast === true;
        }
      } catch (error) {
        logSettingsFlowFailure('schedule_post_commit_failed', {
          actionReason,
          changedKeys: nextChangedKeys,
          sender: senderSummary,
        }, error);
        postCommitFailures.push({
          stage: 'schedule_post_commit',
          error: describeSettingsError(error),
        });
        result.propagation = {
          status: 'schedule_failed',
          taskId: null,
          commitVersion: version,
          changedKeys: [...nextChangedKeys],
          failures: [{
            stage: 'checkpoint',
            error: describeSettingsError(error),
          }],
        };
        if (!persist) {
          if (error instanceof Error) {
            if (!error.propagation) error.propagation = result.propagation;
            throw error;
          }
          const propagationError = new Error('SETTINGS_PROPAGATION_SCHEDULE_FAILED');
          propagationError.code = 'SETTINGS_PROPAGATION_SCHEDULE_FAILED';
          propagationError.propagation = result.propagation;
          throw propagationError;
        }
      }
    }
    if (postCommitFailures.length > 0) {
      result.postCommitFailures = postCommitFailures;
    }
    return result;
  }

  function applySettingsChange(options = {}) {
    assertSettingsPreparationInactive();
    assertProfileMutationAdmissionOpen();
    if (options?.persist === true) {
      assertGenericSettingsMutationAllowed(options?.items);
      return enqueueSettingsMutation(() => applySettingsChangeNow(options));
    }
    return applySettingsChangeNow(options);
  }

  function waitForSettingsPropagationTask(taskId, options = {}) {
    const { timeoutMs = 0 } = options;
    assertSettingsPreparationInactive();
    assertProfileMutationAdmissionOpen();
    if (!Number.isInteger(taskId) || taskId <= 0) {
      return Promise.reject(new Error('SETTINGS_PROPAGATION_TASK_ID_INVALID'));
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
      return Promise.reject(new Error('SETTINGS_PROPAGATION_TASK_TIMEOUT_INVALID'));
    }
    if (typeof changePipeline.waitForPostCommitSettingsTask !== 'function') {
      return Promise.reject(new Error('SETTINGS_PROPAGATION_TASK_WAITER_REQUIRED'));
    }
    return changePipeline.waitForPostCommitSettingsTask(taskId, options);
  }

  function commitSettingsMutation({
    actionReason = 'settings_mutation',
    prepare,
    sender = null,
    emitSettingsUpdated = false,
    invalidateFilterCache = true,
    refreshForBroadcast = false,
    reportBroadcastAsRefresh = false,
  } = {}) {
    assertSettingsPreparationInactive();
    assertProfileMutationAdmissionOpen();
    if (typeof prepare !== 'function') {
      return Promise.reject(new Error('SETTINGS_MUTATION_PREPARE_REQUIRED'));
    }
    if (isNativeAsyncFunction(prepare)) {
      return Promise.reject(new Error('SETTINGS_MUTATION_PREPARE_ASYNC_FORBIDDEN'));
    }
    return enqueueSettingsMutation(async () => {
      await ensureSettingsCacheNow();
      let items;
      settingsMutationPreparationActive = true;
      try {
        const preparedItems = prepare(cloneSettingsMutationSnapshot(settingsCache));
        if (isThenable(preparedItems)) {
          if (preparedItems instanceof Promise) {
            void preparedItems.catch(() => {});
          }
          throw new Error('SETTINGS_MUTATION_PREPARE_ASYNC_FORBIDDEN');
        }
        items = cloneSettingsMutationSnapshot(preparedItems);
      } finally {
        settingsMutationPreparationActive = false;
      }
      if (!items || typeof items !== 'object' || Array.isArray(items)) {
        throw new Error('SETTINGS_MUTATION_ITEMS_INVALID');
      }
      return applySettingsChangeNow({
        actionReason,
        items,
        sender,
        persist: true,
        emitSettingsUpdated,
        invalidateFilterCache,
        refreshForBroadcast,
        reportBroadcastAsRefresh,
        preCommittedChangedKeys: [],
      });
    });
  }

  function runExclusiveExternalSettingsMutation({
    actionReason = 'external_settings_mutation',
    mutate,
  } = {}) {
    assertSettingsPreparationInactive();
    assertProfileMutationAdmissionOpen();
    if (typeof mutate !== 'function') {
      return Promise.reject(new Error('SETTINGS_EXTERNAL_MUTATION_OWNER_REQUIRED'));
    }
    if (isNativeAsyncFunction(mutate)) {
      return Promise.reject(new Error('SETTINGS_EXTERNAL_MUTATION_ASYNC_OWNER_FORBIDDEN'));
    }
    if (typeof changePipeline.schedulePostCommitSettingsEffects !== 'function') {
      return Promise.reject(new Error('SETTINGS_PROPAGATION_COORDINATOR_REQUIRED'));
    }
    if (typeof changePipeline.waitForPostCommitSettingsTask !== 'function') {
      return Promise.reject(new Error('SETTINGS_PROPAGATION_TASK_WAITER_REQUIRED'));
    }

    const mutation = enqueueSettingsMutation(async () => {
      invalidateSettingsObservation();
      let mutationResult;
      let mutationError = null;
      let settingsChanged = true;
      let pendingMutation;
      try {
        settingsExternalMutationInvocationActive = true;
        pendingMutation = mutate();
      } catch (error) {
        mutationError = error;
      } finally {
        settingsExternalMutationInvocationActive = false;
      }
      if (!mutationError) {
        try {
          const outcome = requireExternalSettingsMutationOutcome(await pendingMutation);
          mutationResult = outcome.result;
          settingsChanged = outcome.settingsChanged;
        } catch (error) {
          mutationError = error;
        }
      }

      settingsCacheLoaded = false;
      let hydrationError = null;
      try {
        await refreshSettingsCacheNow();
      } catch (error) {
        hydrationError = error;
      }

      const version = getSettingsChangeVersion();
      const invalidationFailures = [];
      if (
        (settingsChanged || mutationError)
        && typeof changePipeline.invalidateBootPrewarmSnapshot === 'function'
      ) {
        try {
          changePipeline.invalidateBootPrewarmSnapshot(actionReason);
        } catch (error) {
          invalidationFailures.push({
            stage: 'boot_prewarm_invalidation',
            error,
          });
        }
      }
      if (settingsChanged || mutationError) {
        try {
          settingsPersistence.invalidateFilterSettingsCache();
        } catch (error) {
          invalidationFailures.push({
            stage: 'filter_settings_cache_invalidation',
            error,
          });
        }
      }

      let propagationReceipt = null;
      let scheduleError = null;
      const reconcileRequired = settingsChanged
        || !!mutationError
        || !!hydrationError
        || invalidationFailures.length > 0;
      if (reconcileRequired) {
        try {
          propagationReceipt = await changePipeline.schedulePostCommitSettingsEffects({
            actionReason,
            commitVersion: version,
            changedKeys: FULL_SETTINGS_RECONCILE_CHANGED_KEYS,
            shouldRefresh: true,
            shouldAutoPurge: false,
            shouldSyncBlockedBookmarks: true,
            shouldRunRuntimeAdapters: true,
            shouldSyncScripts: true,
            shouldBroadcast: true,
          }, {
            waitForCompletion: false,
          });
        } catch (error) {
          logSettingsFlowFailure('external_mutation_reconcile_schedule_failed', {
            actionReason,
            changedKeys: FULL_SETTINGS_RECONCILE_CHANGED_KEYS,
          }, error);
          scheduleError = error;
        }
      }
      if (
        reconcileRequired
        && !scheduleError
        && (propagationReceipt?.status !== 'scheduled' || !Number.isInteger(propagationReceipt.taskId))
      ) {
        const error = new Error('SETTINGS_EXTERNAL_MUTATION_PROPAGATION_RECEIPT_INVALID');
        error.code = 'SETTINGS_EXTERNAL_MUTATION_PROPAGATION_RECEIPT_INVALID';
        error.propagation = propagationReceipt;
        scheduleError = error;
      }

      return {
        actionReason,
        changedKeys: [...FULL_SETTINGS_RECONCILE_CHANGED_KEYS],
        hydrationError,
        invalidationFailures,
        mutationError,
        mutationResult,
        propagationReceipt,
        reconcileRequired,
        scheduleError,
        settingsChanged,
        version,
      };
    });

    return mutation.then(async ({
      actionReason: committedActionReason,
      changedKeys,
      hydrationError,
      invalidationFailures,
      mutationError,
      mutationResult,
      propagationReceipt,
      reconcileRequired,
      scheduleError,
      settingsChanged,
      version,
    }) => {
      let propagation = reconcileRequired ? null : {
        status: 'not_required',
        taskId: null,
        commitVersion: version,
        changedKeys: [],
        failures: [],
      };
      let waitError = null;
      if (reconcileRequired && !scheduleError) {
        try {
          propagation = await changePipeline.waitForPostCommitSettingsTask(
            propagationReceipt.taskId,
          );
        } catch (error) {
          waitError = error;
          logSettingsFlowFailure('external_mutation_reconcile_failed', {
            actionReason: committedActionReason,
            changedKeys,
          }, error);
        }
      }

      let propagationError = scheduleError || waitError;
      if (reconcileRequired && !propagationError && propagation?.status !== 'succeeded') {
        propagationError = new Error('SETTINGS_EXTERNAL_MUTATION_PROPAGATION_FAILED');
        propagationError.code = 'SETTINGS_EXTERNAL_MUTATION_PROPAGATION_FAILED';
        propagationError.propagation = propagation;
        logSettingsFlowFailure('external_mutation_reconcile_failed', {
          actionReason: committedActionReason,
          changedKeys,
        }, propagationError);
      }

      const reconciliation = {
        hydrationFailure: hydrationError ? describeSettingsError(hydrationError) : null,
        invalidationFailures: invalidationFailures.map((failure) => ({
          stage: failure.stage,
          error: describeSettingsError(failure.error),
        })),
        propagation,
        propagationFailure: propagationError ? describeSettingsError(propagationError) : null,
        receipt: propagationReceipt,
      };
      const primaryError = mutationError
        || hydrationError
        || invalidationFailures[0]?.error
        || propagationError;
      if (primaryError) {
        throw attachExternalSettingsReconciliation(primaryError, reconciliation);
      }

      return {
        changedKeys: settingsChanged ? changedKeys : [],
        mutationResult,
        propagation,
        settingsChanged,
        version,
      };
    });
  }

  function quiesceForProfileMutation() {
    if (profileMutationPhase === SETTINGS_PROFILE_MUTATION_PHASES.QUIESCING) {
      return profileMutationQuiescePromise;
    }
    if (profileMutationPhase === SETTINGS_PROFILE_MUTATION_PHASES.QUIESCED) {
      return Promise.resolve(Object.freeze({ quiesced: true, reused: true }));
    }
    if (profileMutationPhase !== SETTINGS_PROFILE_MUTATION_PHASES.OPEN) {
      throw new Error(`SETTINGS_PROFILE_MUTATION_PHASE_INVALID:${profileMutationPhase}`);
    }

    profileMutationPhase = SETTINGS_PROFILE_MUTATION_PHASES.QUIESCING;
    profileMutationQuiescePromise = settingsMutationTail.then(() => {
      settingsCacheLoaded = false;
      settingsCacheLoadPromise = null;
      profileMutationPhase = SETTINGS_PROFILE_MUTATION_PHASES.QUIESCED;
      return Object.freeze({ quiesced: true, reused: false });
    });
    return profileMutationQuiescePromise;
  }

  function runExclusiveTerminalSettingsMutation({
    mutate,
  } = {}) {
    assertSettingsPreparationInactive();
    if (profileMutationPhase !== SETTINGS_PROFILE_MUTATION_PHASES.QUIESCED) {
      return Promise.reject(new Error(
        `SETTINGS_TERMINAL_MUTATION_REQUIRES_QUIESCED:${profileMutationPhase}`,
      ));
    }
    if (typeof mutate !== 'function') {
      return Promise.reject(new Error('SETTINGS_TERMINAL_MUTATION_OWNER_REQUIRED'));
    }
    if (isNativeAsyncFunction(mutate)) {
      return Promise.reject(new Error('SETTINGS_TERMINAL_MUTATION_ASYNC_OWNER_FORBIDDEN'));
    }

    return enqueueSettingsMutation(async () => {
      if (profileMutationPhase !== SETTINGS_PROFILE_MUTATION_PHASES.QUIESCED) {
        throw new Error(
          `SETTINGS_TERMINAL_MUTATION_REQUIRES_QUIESCED:${profileMutationPhase}`,
        );
      }
      let pendingMutation;
      try {
        settingsExternalMutationInvocationActive = true;
        pendingMutation = mutate();
      } finally {
        settingsExternalMutationInvocationActive = false;
      }
      try {
        const outcome = requireExternalSettingsMutationOutcome(await pendingMutation);
        return outcome.result;
      } finally {
        settingsCacheLoaded = false;
        settingsCacheLoadPromise = null;
      }
    });
  }

  function mergeNudgeConfig(partial) {
    return mergeNudgeRuntimeConfig(partial);
  }

  function setSiteRegistrationAdmissionOwner(owner) {
    if (typeof owner !== 'function') throw new Error('SETTINGS_SITE_REGISTRATION_ADMISSION_OWNER_REQUIRED');
    if (siteRegistrationAdmissionOwner !== null) throw new Error('SETTINGS_SITE_REGISTRATION_ADMISSION_OWNER_ALREADY_BOUND');
    siteRegistrationAdmissionOwner = owner;
  }

  function setSiteRegistrationCommitObserver(observer) {
    if (typeof observer !== 'function') throw new Error('SETTINGS_SITE_REGISTRATION_COMMIT_OBSERVER_REQUIRED');
    if (siteRegistrationCommitObserver !== null) throw new Error('SETTINGS_SITE_REGISTRATION_COMMIT_OBSERVER_ALREADY_BOUND');
    siteRegistrationCommitObserver = observer;
  }

  function setTrackingPolicyMutationOwner(owner) {
    if (typeof owner !== 'function') throw new Error('SETTINGS_TRACKING_POLICY_MUTATION_OWNER_REQUIRED');
    if (trackingPolicyMutationOwner !== null) throw new Error('SETTINGS_TRACKING_POLICY_MUTATION_OWNER_ALREADY_BOUND');
    trackingPolicyMutationOwner = owner;
  }

  return {
    applySettingsChange,
    commitSettingsMutation,
    configureChangePipeline,
    setSiteRegistrationAdmissionOwner,
    setSiteRegistrationCommitObserver,
    setTrackingPolicyMutationOwner,
    ensureSettingsCache,
    getSettingsCache: () => {
      assertProfileMutationAdmissionOpen();
      return settingsCache;
    },
    getSettingsChangeVersion,
    getCollectionAdmission: () => {
      assertProfileMutationAdmissionOpen();
      return collectionAdmission.snapshot();
    },
    mergeNudgeConfig,
    refreshSettingsCache,
    runExclusiveExternalSettingsMutation,
    quiesceForProfileMutation,
    runExclusiveTerminalSettingsMutation,
    waitForSettingsPropagationTask,
  };
}
