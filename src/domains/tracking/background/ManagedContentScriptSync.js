import { requireSettingsPropagationContext, throwIfSettingsPropagationCancelled } from '../../settings/contracts/settingsPropagationContext.js';
import {
  hasChromeScripting,
  scriptingRegisterContentScripts,
  scriptingUpdateContentScripts,
  scriptingUnregisterContentScripts,
  tabsQuery,
} from '../../../platform/chrome/ChromeService.js';
import {
  buildOriginPatternsForDomain,
  getHostname,
  hasOriginPermissionForDomain,
  requireConcreteOriginPermissions,
} from '../../../lib/index.js';
import {
  buildSiteRuleHostCandidates,
  isHostnameInSiteList,
} from '../../../lib/siteIdentity.js';
import { normalizeManagedContentScriptFiles } from './contentScriptPath.js';

function isWebUrl(url) {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
}

function isNonexistentManagedScriptError(message) {
  const normalized = String(message || '')
    .toLowerCase()
    .trim();
  return (
    (normalized.includes('nonexistent') && normalized.includes('script id'))
    || (normalized.includes('no script') && normalized.includes('id'))
    || (normalized.includes('not found') && normalized.includes('script'))
    || (
      normalized.includes('script')
      && (
        normalized.includes('does not exist')
        || normalized.includes('not fully registered')
      )
    )
  );
}

function normalizeHostname(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function expandManagedDomains(domains = []) {
  const seen = new Set();
  const expanded = [];
  (Array.isArray(domains) ? domains : []).forEach((domain) => {
    buildSiteRuleHostCandidates(domain).forEach((candidate) => {
      if (!candidate || seen.has(candidate)) return;
      seen.add(candidate);
      expanded.push(candidate);
    });
  });
  return expanded;
}

function buildExactOriginPatternsForDomain(domain) {
  return buildOriginPatternsForDomain(domain)
    .filter((pattern) => !String(pattern || '').includes('*://*.'));
}

function normalizePrepaintVisualScripts(scripts = []) {
  if (!Array.isArray(scripts) || scripts.length === 0) return [];
  const seenIds = new Set();
  return scripts.reduce((acc, script) => {
    const id = typeof script?.id === 'string' ? script.id.trim() : '';
    const tierId = typeof script?.tierId === 'string' ? script.tierId.trim() : '';
    const css = normalizeManagedContentScriptFiles(script?.css || []);
    if (!id || !tierId || css.length === 0 || seenIds.has(id)) return acc;
    seenIds.add(id);
    acc.push({ id, tierId, css });
    return acc;
  }, []);
}

function normalizeMediaFrameContentScript(script = null) {
  if (!script || typeof script !== 'object') return null;
  const id = typeof script?.id === 'string' ? script.id.trim() : '';
  const js = normalizeManagedContentScriptFiles(script?.js || []);
  if (!id || js.length === 0) return null;
  return { id, js };
}

function createManagedContentScriptSyncError(code, message, details = {}) {
  const error = new Error(String(message || code || 'MANAGED_CONTENT_SCRIPT_SYNC_FAILED'));
  error.code = code;
  error.details = details;
  return error;
}

function createCatchUpPlanDiagnostic({
  reason = 'unspecified',
  injectOpenTabs = false,
  registeredDomainCount = 0,
  catchUpDomainCount = 0,
  queriedTabCount = 0,
  webTabCount = 0,
  targetCount = 0,
} = {}) {
  return {
    reason: typeof reason === 'string' && reason.trim() ? reason.trim() : 'unspecified',
    injectOpenTabs: injectOpenTabs === true,
    registeredDomainCount,
    catchUpDomainCount,
    queriedTabCount,
    webTabCount,
    targetCount,
  };
}

function requireManagedContentScriptOwner(fn, errorCode) {
  if (typeof fn !== 'function') {
    throw new Error(errorCode);
  }
  return fn;
}

function requireBooleanOwnerResult(value, errorCode) {
  if (typeof value !== 'boolean') {
    throw new Error(errorCode);
  }
  return value;
}

function requirePermissionSnapshot(snapshot) {
  if (
    !snapshot
    || typeof snapshot !== 'object'
    || Array.isArray(snapshot)
    || !Array.isArray(snapshot.permissions)
    || !Array.isArray(snapshot.origins)
  ) {
    throw new Error('MANAGED_CONTENT_SCRIPT_PERMISSION_SNAPSHOT_INVALID');
  }
  return {
    permissions: snapshot.permissions,
    origins: requireConcreteOriginPermissions(
      snapshot.origins,
      'MANAGED_CONTENT_SCRIPT_ORIGIN_CONTRACT_INVALID',
    ),
  };
}

export function createManagedContentScriptSync({
  settingsService,
  settingsCache,
  managedContentScriptId,
  contentScriptFiles,
  mediaFrameContentScript = null,
  prepaintVisualScripts = [],
  prepaintVisualPlanProvider = null,
  hasScriptingPermission,
  getGrantedPermissions,
}) {
  const readScriptingPermission = requireManagedContentScriptOwner(
    hasScriptingPermission,
    'MANAGED_CONTENT_SCRIPT_SCRIPTING_PERMISSION_OWNER_REQUIRED',
  );
  const readGrantedPermissions = requireManagedContentScriptOwner(
    getGrantedPermissions,
    'MANAGED_CONTENT_SCRIPT_PERMISSION_SNAPSHOT_OWNER_REQUIRED',
  );
  const managedScriptFiles = normalizeManagedContentScriptFiles(contentScriptFiles);
  const normalizedMediaFrameContentScript = normalizeMediaFrameContentScript(mediaFrameContentScript);
  const normalizedPrepaintVisualScripts = normalizePrepaintVisualScripts(prepaintVisualScripts);
  const prepaintVisualScriptIds = normalizedPrepaintVisualScripts.map((script) => script.id);
  let registrationSignatureCache = '';
  let mediaFrameRegistrationSignatureCache = '';
  let prepaintVisualRegistrationSignatureCache = '';
  let registeredDomainsCache = new Set();
  let catchUpReconciledDomainsCache = new Set();

  function createInjectionSummary({
    attemptedCount = 0,
    successCount = 0,
    failureCount = 0,
    failures = [],
  } = {}) {
    return {
      attemptedCount: Number.isFinite(attemptedCount) ? Math.max(0, Math.floor(attemptedCount)) : 0,
      successCount: Number.isFinite(successCount) ? Math.max(0, Math.floor(successCount)) : 0,
      failureCount: Number.isFinite(failureCount) ? Math.max(0, Math.floor(failureCount)) : 0,
      failures: Array.isArray(failures) ? failures : [],
    };
  }

  function createPrepaintVisualSummary({
    registeredHosts = [],
    missingHosts = [],
    registrations = [],
  } = {}) {
    return {
      registeredHosts: Array.from(new Set(registeredHosts)).sort(),
      missingHosts: Array.from(new Set(missingHosts)).sort(),
      registrations,
      scriptIds: prepaintVisualScriptIds,
    };
  }

  function createMediaFrameSummary({
    registered = false,
    matches = [],
  } = {}) {
    return {
      scriptId: normalizedMediaFrameContentScript?.id || null,
      js: normalizedMediaFrameContentScript?.js ? [...normalizedMediaFrameContentScript.js] : [],
      allFrames: true,
      registered: normalizedMediaFrameContentScript ? registered === true : false,
      matches: Array.from(new Set(Array.isArray(matches) ? matches : [])).sort(),
    };
  }

  async function unregisterContentScriptIds(ids, label = 'managed content script') {
    let succeeded = true;
    for (const id of ids.filter(Boolean)) {
      const unregisterError = await scriptingUnregisterContentScripts([id]);
      if (!unregisterError) continue;

      const isNonexistent = isNonexistentManagedScriptError(unregisterError);
      if (isNonexistent) {
        console.debug(
          `[ManagedContentScriptSync] ${label} unregister skipped (already absent):`,
          unregisterError
        );
        continue;
      }

      succeeded = false;
      console.warn(`[ManagedContentScriptSync] ${label} unregister failed:`, unregisterError);
    }
    return succeeded;
  }

  async function applyContentScriptConfig(scriptConfig, { label = 'managed content script' } = {}) {
    const updateError = await scriptingUpdateContentScripts([scriptConfig]);
    if (!updateError) return null;
    if (!isNonexistentManagedScriptError(updateError)) return updateError;

    const unregistered = await unregisterContentScriptIds([scriptConfig.id], label);
    if (!unregistered) return `${label} unregister failed`;
    return scriptingRegisterContentScripts([scriptConfig]);
  }

  async function applyManagedContentScript({ matches }) {
    return applyContentScriptConfig({
      id: managedContentScriptId,
      matches,
      js: managedScriptFiles,
      runAt: 'document_start',
      allFrames: false,
      persistAcrossSessions: false,
    });
  }

  async function applyMediaFrameContentScript({ matches }) {
    if (!normalizedMediaFrameContentScript) return null;
    return applyContentScriptConfig({
      id: normalizedMediaFrameContentScript.id,
      matches,
      js: normalizedMediaFrameContentScript.js,
      runAt: 'document_start',
      allFrames: true,
      persistAcrossSessions: false,
    }, { label: 'media frame content script' });
  }

  async function buildPrepaintVisualRegistrationPlan({
    grantedOrigins = [],
    registeredDomains = [],
    now = Date.now(),
  } = {}) {
    if (
      normalizedPrepaintVisualScripts.length === 0
      || typeof prepaintVisualPlanProvider !== 'function'
    ) {
      return {
        summary: createPrepaintVisualSummary(),
        registrations: [],
      };
    }

    const plans = await prepaintVisualPlanProvider({ now });
    const scriptsByTier = new Map(
      normalizedPrepaintVisualScripts.map((script) => [script.tierId, script])
    );
    const matchesByTier = new Map(
      normalizedPrepaintVisualScripts.map((script) => [script.tierId, []])
    );
    const seenPatternByTier = new Map(
      normalizedPrepaintVisualScripts.map((script) => [script.tierId, new Set()])
    );
    const registeredHosts = [];
    const missingHosts = [];

    (Array.isArray(plans) ? plans : []).forEach((plan) => {
      const hostname = normalizeHostname(plan?.host?.hostname || plan?.hostname);
      const script = scriptsByTier.get(String(plan?.tierId || ''));
      if (!hostname || !script || plan?.decision?.shouldApply !== true) return;

      if (!isHostnameInSiteList(hostname, registeredDomains)) return;

      if (!hasOriginPermissionForDomain(grantedOrigins, hostname)) {
        missingHosts.push(hostname);
        return;
      }

      const patterns = buildExactOriginPatternsForDomain(hostname);
      if (patterns.length === 0) {
        missingHosts.push(hostname);
        return;
      }

      registeredHosts.push(hostname);
      const matches = matchesByTier.get(script.tierId);
      const seen = seenPatternByTier.get(script.tierId);
      patterns.forEach((pattern) => {
        if (seen.has(pattern)) return;
        seen.add(pattern);
        matches.push(pattern);
      });
    });

    const registrations = normalizedPrepaintVisualScripts.map((script) => {
      const matches = [...(matchesByTier.get(script.tierId) || [])].sort();
      return {
        id: script.id,
        tierId: script.tierId,
        matches,
        css: script.css,
        config: {
          id: script.id,
          matches,
          css: script.css,
          runAt: 'document_start',
          allFrames: false,
          persistAcrossSessions: false,
        },
      };
    });

    return {
      summary: createPrepaintVisualSummary({
        registeredHosts,
        missingHosts,
        registrations: registrations.map(({ id, tierId, matches, css }) => ({
          id,
          tierId,
          matches,
          css,
        })),
      }),
      registrations,
    };
  }

  async function applyPrepaintVisualContentScripts(registrations = []) {
    let applySucceeded = true;
    const failures = [];
    for (const registration of registrations) {
      if (!registration?.id) continue;
      if (!Array.isArray(registration.matches) || registration.matches.length === 0) {
        const unregistered = await unregisterContentScriptIds([registration.id], 'prepaint visual content script');
        applySucceeded = unregistered && applySucceeded;
        continue;
      }

      const applyError = await applyContentScriptConfig(registration.config, {
        label: 'prepaint visual content script',
      });
      if (applyError) {
        applySucceeded = false;
        failures.push({
          id: registration.id,
          tierId: registration.tierId,
          matches: Array.isArray(registration.matches) ? [...registration.matches] : [],
          css: Array.isArray(registration.css) ? [...registration.css] : [],
          error: String(applyError),
        });
        console.warn('[ManagedContentScriptSync] Prepaint visual content script registration failed:', applyError);
      }
    }
    return { succeeded: applySucceeded, failures };
  }

  async function syncManagedContentScripts({
    injectOpenTabs = true,
    reason = 'unspecified',
    propagationContext = null,
    assertPermissionsCurrent = null,
  } = {}) {
    if (assertPermissionsCurrent !== null && typeof assertPermissionsCurrent !== 'function') {
      throw new Error('MANAGED_CONTENT_SCRIPT_PERMISSION_FENCE_INVALID');
    }
    requireSettingsPropagationContext(propagationContext);
    assertPermissionsCurrent?.('registration_start');
    throwIfSettingsPropagationCancelled(propagationContext, 'registration_start');
    await settingsService.ensureSettingsCache();
    assertPermissionsCurrent?.('registration_settings_ready');
    throwIfSettingsPropagationCancelled(propagationContext, 'registration_settings_ready');
    if (settingsCache.permissionMode !== 'selective') {
      throw new Error('MANAGED_CONTENT_SCRIPT_PERMISSION_MODE_CONTRACT_INVALID');
    }
    let injectionSummary = createInjectionSummary();
    let catchUpTabs = [];
    let catchUpPlanDiagnostic = createCatchUpPlanDiagnostic({ reason, injectOpenTabs });
    let prepaintVisual = createPrepaintVisualSummary();
    let mediaFrame = createMediaFrameSummary();

    const blockedUrls = Array.isArray(settingsCache.blockedUrls) ? settingsCache.blockedUrls : [];
    const allowedUrls = Array.isArray(settingsCache.allowedUrls) ? settingsCache.allowedUrls : [];
    const targetDomains = expandManagedDomains([...blockedUrls, ...allowedUrls]);

    const hasScripting = requireBooleanOwnerResult(
      await readScriptingPermission({ permissions: ['scripting'] }),
      'MANAGED_CONTENT_SCRIPT_SCRIPTING_PERMISSION_RESULT_INVALID',
    );
    throwIfSettingsPropagationCancelled(propagationContext, 'registration_permission_ready');
    assertPermissionsCurrent?.('registration_permission_ready');
    if (!hasScripting) {
      if (hasChromeScripting()) {
        await unregisterContentScriptIds(
          [
            managedContentScriptId,
            normalizedMediaFrameContentScript?.id,
            ...prepaintVisualScriptIds,
          ],
          'managed content script'
        );
      }
      registrationSignatureCache = '';
      mediaFrameRegistrationSignatureCache = '';
      prepaintVisualRegistrationSignatureCache = '';
      registeredDomainsCache = new Set();
      catchUpReconciledDomainsCache = new Set();
      return {
        registeredDomains: [],
        missingDomains: targetDomains.slice(),
        hasScripting: false,
        matches: [],
        scriptFiles: managedScriptFiles,
        mediaFrame,
        prepaintVisual,
        catchUpTabs,
        catchUpPlanDiagnostic,
        injectionSummary,
      };
    }

    if (managedScriptFiles.length === 0) {
      console.warn('[ManagedContentScriptSync] No valid content script files to register.');
      await unregisterContentScriptIds(
        [
          normalizedMediaFrameContentScript?.id,
          ...prepaintVisualScriptIds,
        ],
        'managed content script',
      );
      registrationSignatureCache = '';
      mediaFrameRegistrationSignatureCache = '';
      prepaintVisualRegistrationSignatureCache = '';
      catchUpReconciledDomainsCache = new Set();
      return {
        registeredDomains: [],
        missingDomains: targetDomains.slice(),
        hasScripting: true,
        matches: [],
        scriptFiles: managedScriptFiles,
        mediaFrame,
        prepaintVisual,
        catchUpTabs,
        catchUpPlanDiagnostic,
        injectionSummary,
      };
    }

    const granted = requirePermissionSnapshot(await readGrantedPermissions());
    throwIfSettingsPropagationCancelled(propagationContext, 'registration_origins_ready');
    assertPermissionsCurrent?.('registration_origins_ready');
    const grantedOrigins = granted.origins;

    const registeredDomains = [];
    const missingDomains = [];
    targetDomains.forEach((domain) => {
      if (hasOriginPermissionForDomain(grantedOrigins, domain)) {
        registeredDomains.push(domain);
      } else {
        missingDomains.push(domain);
      }
    });

    const matches = [];
    const seen = new Set();
    registeredDomains.forEach((domain) => {
      const patterns = buildOriginPatternsForDomain(domain);
      patterns.forEach((pattern) => {
        if (!seen.has(pattern)) {
          seen.add(pattern);
          matches.push(pattern);
        }
      });
    });

    const sortedMatches = [...matches].sort();
    // Embedded-player access is independent of protection-site enrollment.
    // Only the small child receiver uses these already granted web origins.
    const mediaFrameMatches = [...new Set(grantedOrigins.filter(origin => /^(https?|\*):\/\//.test(origin)))].sort();
    const registeredDomainSet = new Set(registeredDomains);
    catchUpReconciledDomainsCache = new Set(
      [...catchUpReconciledDomainsCache]
        .filter((domain) => registeredDomainSet.has(domain)),
    );
    mediaFrame = createMediaFrameSummary({
      registered: mediaFrameMatches.length > 0,
      matches: mediaFrameMatches,
    });
    const nextRegistrationSignature = JSON.stringify({
      matches: sortedMatches,
      files: managedScriptFiles,
    });
    const nextMediaFrameRegistrationSignature = JSON.stringify({
      matches: mediaFrameMatches,
      script: normalizedMediaFrameContentScript,
    });
    const signatureChanged = nextRegistrationSignature !== registrationSignatureCache;
    const mediaFrameSignatureChanged = normalizedMediaFrameContentScript
      ? nextMediaFrameRegistrationSignature !== mediaFrameRegistrationSignatureCache
      : mediaFrameRegistrationSignatureCache !== '';
    let applySucceeded = true;
    const prepaintPlan = await buildPrepaintVisualRegistrationPlan({
      grantedOrigins,
      registeredDomains,
      now: Date.now(),
    });
    prepaintVisual = prepaintPlan.summary;
    // Once the first registration mutation starts, complete this batch and
    // commit its observed signatures. The next serialized sync reconciles it.
    throwIfSettingsPropagationCancelled(propagationContext, 'registration_plan_ready');
    assertPermissionsCurrent?.('registration_plan_ready');
    const nextPrepaintVisualRegistrationSignature = JSON.stringify(
      prepaintPlan.registrations.map(({ id, tierId, matches, css }) => ({
        id,
        tierId,
        matches,
        css,
      }))
    );
    const prepaintVisualSignatureChanged = (
      nextPrepaintVisualRegistrationSignature !== prepaintVisualRegistrationSignatureCache
    );

    if (signatureChanged) {
      if (matches.length === 0) {
        applySucceeded = await unregisterContentScriptIds([managedContentScriptId], 'managed content script');
      } else {
        const applyError = await applyManagedContentScript({ matches });
        if (applyError) {
          applySucceeded = false;
          console.warn('[ManagedContentScriptSync] Managed content script registration failed:', applyError);
          throw createManagedContentScriptSyncError(
            'MANAGED_CONTENT_SCRIPT_REGISTRATION_FAILED',
            applyError,
            { managedContentScriptId, matches: sortedMatches }
          );
        }
      }

      if (applySucceeded) {
        registrationSignatureCache = nextRegistrationSignature;
        registeredDomainsCache = new Set(registeredDomains);
      } else {
        // Keep caches stale so the next sync retries registration.
        registrationSignatureCache = '';
        throw createManagedContentScriptSyncError(
          'MANAGED_CONTENT_SCRIPT_UNREGISTER_FAILED',
          'managed content script unregister failed',
          { managedContentScriptId, matches: sortedMatches }
        );
      }
    }

    if (mediaFrameSignatureChanged) {
      if (!normalizedMediaFrameContentScript || mediaFrameMatches.length === 0) {
        const unregistered = await unregisterContentScriptIds(
          [normalizedMediaFrameContentScript?.id],
          'media frame content script',
        );
        if (unregistered) {
          mediaFrameRegistrationSignatureCache = normalizedMediaFrameContentScript
            ? nextMediaFrameRegistrationSignature
            : '';
        } else {
          mediaFrameRegistrationSignatureCache = '';
          throw createManagedContentScriptSyncError(
            'MEDIA_FRAME_CONTENT_SCRIPT_UNREGISTER_FAILED',
            'media frame content script unregister failed',
            { scriptId: normalizedMediaFrameContentScript?.id || null, matches: sortedMatches }
          );
        }
      } else {
        const applyError = await applyMediaFrameContentScript({ matches: mediaFrameMatches });
        if (applyError) {
          mediaFrameRegistrationSignatureCache = '';
          console.warn('[ManagedContentScriptSync] Media frame content script registration failed:', applyError);
          throw createManagedContentScriptSyncError(
            'MEDIA_FRAME_CONTENT_SCRIPT_REGISTRATION_FAILED',
            applyError,
            {
              scriptId: normalizedMediaFrameContentScript.id,
              js: normalizedMediaFrameContentScript.js,
              matches: sortedMatches,
            }
          );
        }
        mediaFrameRegistrationSignatureCache = nextMediaFrameRegistrationSignature;
      }
    }

    if (prepaintVisualSignatureChanged) {
      const prepaintApplyResult = await applyPrepaintVisualContentScripts(prepaintPlan.registrations);
      if (prepaintApplyResult.succeeded) {
        prepaintVisualRegistrationSignatureCache = nextPrepaintVisualRegistrationSignature;
      } else {
        prepaintVisualRegistrationSignatureCache = '';
        throw createManagedContentScriptSyncError(
          'PREPAINT_VISUAL_CONTENT_SCRIPT_REGISTRATION_FAILED',
          'prepaint visual content script registration failed',
          {
            scriptIds: prepaintVisualScriptIds,
            failures: prepaintApplyResult.failures,
          }
        );
      }
    }

    if (injectOpenTabs && applySucceeded) {
      const requiresServiceInitCatchUp = reason === 'service_init';
      const catchUpDomains = requiresServiceInitCatchUp
        ? [...registeredDomains]
        : registeredDomains.filter(
          (domain) => !catchUpReconciledDomainsCache.has(domain),
        );
      if (catchUpDomains.length > 0 && matches.length > 0) {
        const tabs = await tabsQuery({});
        const webTabs = tabs.filter((tab) => tab?.id && tab?.url && isWebUrl(tab.url) && tab.discarded !== true);
        catchUpTabs = webTabs
          .filter((tab) => {
            const hostname = getHostname(tab.url);
            return hostname && isHostnameInSiteList(hostname, catchUpDomains);
          })
          .filter((tab) => Number.isInteger(Number(tab?.id)) && isWebUrl(tab?.url))
          .sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0))
          .map((tab) => ({
            tabId: Number(tab.id),
            url: String(tab.url || ''),
          }));
        catchUpPlanDiagnostic = createCatchUpPlanDiagnostic({
          reason,
          injectOpenTabs,
          registeredDomainCount: registeredDomains.length,
          catchUpDomainCount: catchUpDomains.length,
          queriedTabCount: tabs.length,
          webTabCount: webTabs.length,
          targetCount: catchUpTabs.length,
        });
      } else {
        catchUpPlanDiagnostic = createCatchUpPlanDiagnostic({
          reason,
          injectOpenTabs,
          registeredDomainCount: registeredDomains.length,
          catchUpDomainCount: catchUpDomains.length,
        });
      }
      catchUpReconciledDomainsCache = new Set(registeredDomains);
    } else {
      catchUpPlanDiagnostic = createCatchUpPlanDiagnostic({
        reason,
        injectOpenTabs,
        registeredDomainCount: registeredDomains.length,
      });
    }

    return {
      registeredDomains,
      missingDomains,
      hasScripting: true,
      matches: sortedMatches,
      scriptFiles: managedScriptFiles,
      mediaFrame,
      prepaintVisual,
      catchUpTabs,
      catchUpPlanDiagnostic,
      injectionSummary,
    };
  }

  return { syncManagedContentScripts };
}
