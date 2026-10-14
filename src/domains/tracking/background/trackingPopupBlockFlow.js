import {
    FILTERING_MODES,
    resolveFilteringModeBySchedule,
} from '../../settings/config/blockingPolicy.js';
import {
    shouldCollectDomainUsage,
} from '../../settings/config/dataCollectionPolicy.js';
import { normalizeDomain } from '../../../lib/domain.js';
import {
    getHostname,
    isHostnameInList,
} from '../../../lib/index.js';
import {
    hasOriginPermissionForDomain,
    requireConcreteOriginPermissions,
} from '../../../lib/permissions.js';
import { STORAGE_SESSION_KEYS } from '../../../platform/storage/runtime/RuntimeSessionRepository.js';

const HOT_UNMANAGED_FAVICON_MIN_ACTIVE_MS = 20 * 60_000;
const HOT_UNMANAGED_FAVICON_MAX_DOMAINS = 6;
const HOT_UNMANAGED_FAVICON_CACHE_TTL_MS = 30_000;
const POPUP_PENDING_BLOCKS_SESSION_KEY = STORAGE_SESSION_KEYS.PENDING_POPUP_BLOCK_DOMAINS;
const POPUP_PENDING_BLOCK_TTL_MS = 10 * 60_000;

function resolveRulesAwareFilteringMode(settings, now = Date.now()) {
    return resolveFilteringModeBySchedule({
        filteringMode: settings?.filteringMode || FILTERING_MODES.BLOCKLIST,
        schedule: settings?.relaxationSchedule,
        ts: now,
    });
}

function normalizePendingPopupBlockEntries(entries, now = Date.now()) {
    const source = Array.isArray(entries) ? entries : [];
    const seen = new Set();
    const next = [];

    source.forEach((entry) => {
        const domain = normalizeDomain(entry?.domain || entry);
        if (!domain || seen.has(domain)) return;

        const requestedAtRaw = Number(entry?.requestedAt);
        const requestedAt = Number.isFinite(requestedAtRaw) && requestedAtRaw > 0
            ? Math.floor(requestedAtRaw)
            : now;
        if (now - requestedAt > POPUP_PENDING_BLOCK_TTL_MS) return;

        if (Object.hasOwn(entry, 'goalMinutes')) throw new Error('POPUP_REGISTRATION_TIME_FORBIDDEN');

        seen.add(domain);
        next.push({ domain, requestedAt });
    });

    return next;
}

function requirePermissionSnapshot(snapshot) {
    if (
        !snapshot
        || typeof snapshot !== 'object'
        || Array.isArray(snapshot)
        || !Array.isArray(snapshot.permissions)
        || !Array.isArray(snapshot.origins)
    ) {
        throw new Error('TRACKING_POPUP_BLOCK_FLOW_PERMISSION_RESULT_INVALID');
    }
    return {
        permissions: snapshot.permissions,
        origins: requireConcreteOriginPermissions(
            snapshot.origins,
            'TRACKING_POPUP_BLOCK_FLOW_ORIGIN_CONTRACT_INVALID',
        ),
    };
}

function requireSiteRuleMutationResult(result) {
    if (
        !result
        || typeof result !== 'object'
        || Array.isArray(result)
        || !Array.isArray(result.changedKeys)
    ) {
        throw new Error('TRACKING_POPUP_BLOCK_FLOW_SITE_RULE_RESULT_INVALID');
    }
    return result;
}

export function createTrackingPopupBlockFlow({
    sessionStore,
    settingsCache,
    upsertPendingPopupBlockedSite,
    syncManagedContentScripts,
    getGrantedPermissions,
    loadStatsCache,
    getStatsCache,
    getStatsDateStr,
    broadcastSettingsUpdate = null,
} = {}) {
    if (!sessionStore || typeof sessionStore.get !== 'function' || typeof sessionStore.set !== 'function') {
        throw new Error('TRACKING_POPUP_BLOCK_FLOW_SESSION_STORE_REQUIRED');
    }
    if (typeof loadStatsCache !== 'function' || typeof getStatsCache !== 'function' || typeof getStatsDateStr !== 'function') {
        throw new Error('TRACKING_POPUP_BLOCK_FLOW_STATS_ACCESSORS_REQUIRED');
    }
    if (typeof upsertPendingPopupBlockedSite !== 'function') {
        throw new Error('TRACKING_POPUP_BLOCK_FLOW_SITE_RULE_OWNER_REQUIRED');
    }
    if (typeof syncManagedContentScripts !== 'function') {
        throw new Error('TRACKING_POPUP_BLOCK_FLOW_CONTENT_SCRIPT_SYNC_REQUIRED');
    }
    if (typeof getGrantedPermissions !== 'function') {
        throw new Error('TRACKING_POPUP_BLOCK_FLOW_PERMISSION_OWNER_REQUIRED');
    }

    let hotUnmanagedFaviconDomainsCache = new Set();
    let hotUnmanagedFaviconCacheAt = 0;
    let hotUnmanagedFaviconCacheDateStr = '';
    let hotUnmanagedFaviconCachePromise = null;
    let popupBlockProcessPromise = null;
    let pendingPopupBlockMutationTail = Promise.resolve();

    function enqueuePendingPopupBlockMutation(operation) {
        const run = pendingPopupBlockMutationTail.then(operation, operation);
        pendingPopupBlockMutationTail = run.catch(() => undefined);
        return run;
    }

    async function readPendingPopupBlockEntries(now = Date.now()) {
        const session = await sessionStore.get({
            [POPUP_PENDING_BLOCKS_SESSION_KEY]: [],
        });
        return normalizePendingPopupBlockEntries(session?.[POPUP_PENDING_BLOCKS_SESSION_KEY], now);
    }

    async function writePendingPopupBlockEntries(entries = []) {
        await sessionStore.set({
            [POPUP_PENDING_BLOCKS_SESSION_KEY]: entries,
        });
    }

    async function resolveHotUnmanagedFaviconDomains(now = Date.now()) {
        const currentDateStr = getStatsDateStr() || '';
        const cacheFresh = (
            hotUnmanagedFaviconCacheAt > 0
            && now - hotUnmanagedFaviconCacheAt < HOT_UNMANAGED_FAVICON_CACHE_TTL_MS
            && hotUnmanagedFaviconCacheDateStr === currentDateStr
        );
        if (cacheFresh) return hotUnmanagedFaviconDomainsCache;
        if (hotUnmanagedFaviconCachePromise) return hotUnmanagedFaviconCachePromise;

        hotUnmanagedFaviconCachePromise = (async () => {
            await loadStatsCache(now);
            const statsCache = getStatsCache();
            const dateStr = getStatsDateStr();
            const dayData = dateStr ? statsCache?.dates?.[dateStr] : null;
            const domainEntries = dayData?.domains && typeof dayData.domains === 'object'
                ? Object.entries(dayData.domains)
                : [];

            const blockedUrls = Array.isArray(settingsCache.blockedUrls) ? settingsCache.blockedUrls : [];
            const allowedUrls = Array.isArray(settingsCache.allowedUrls) ? settingsCache.allowedUrls : [];
            const filteringMode = resolveRulesAwareFilteringMode(settingsCache, now);

            if (filteringMode === FILTERING_MODES.ALLOWLIST) {
                hotUnmanagedFaviconDomainsCache = new Set();
                hotUnmanagedFaviconCacheAt = now;
                hotUnmanagedFaviconCacheDateStr = dateStr || '';
                return hotUnmanagedFaviconDomainsCache;
            }

            const candidates = domainEntries
                .map(([domain, stat]) => ({
                    domain: String(domain || '').trim().toLowerCase(),
                    activeMs: Math.max(0, Number(stat?.active || 0)),
                }))
                .filter((entry) => entry.domain && entry.activeMs >= HOT_UNMANAGED_FAVICON_MIN_ACTIVE_MS)
                .filter((entry) => !isHostnameInList(entry.domain, blockedUrls))
                .filter((entry) => !isHostnameInList(entry.domain, allowedUrls))
                .sort((a, b) => b.activeMs - a.activeMs || a.domain.localeCompare(b.domain))
                .slice(0, HOT_UNMANAGED_FAVICON_MAX_DOMAINS)
                .map((entry) => entry.domain);

            hotUnmanagedFaviconDomainsCache = new Set(candidates);
            hotUnmanagedFaviconCacheAt = now;
            hotUnmanagedFaviconCacheDateStr = dateStr || '';
            return hotUnmanagedFaviconDomainsCache;
        })().finally(() => {
            hotUnmanagedFaviconCachePromise = null;
        });

        return hotUnmanagedFaviconCachePromise;
    }

    async function shouldCaptureFaviconForPage({ pageUrl, hostname } = {}) {
        const resolvedHostname = String(hostname || getHostname(pageUrl) || '').trim().toLowerCase();
        if (!resolvedHostname) return false;

        const blockedUrls = Array.isArray(settingsCache.blockedUrls) ? settingsCache.blockedUrls : [];
        const allowedUrls = Array.isArray(settingsCache.allowedUrls) ? settingsCache.allowedUrls : [];
        if (isHostnameInList(resolvedHostname, blockedUrls)) return true;
        if (isHostnameInList(resolvedHostname, allowedUrls)) return true;

        if (!shouldCollectDomainUsage(resolvedHostname, settingsCache)) return false;

        const hotDomains = await resolveHotUnmanagedFaviconDomains();
        return hotDomains.has(resolvedHostname);
    }

    async function queuePendingPopupBlockDomain(
        domain,
        {
            now = Date.now(),
            ...other
        } = {},
    ) {
        const normalized = normalizeDomain(domain);
        if (!normalized) return [];
        if (Object.keys(other).length) throw new Error('POPUP_REGISTRATION_FIELD_INVALID');

        return enqueuePendingPopupBlockMutation(async () => {
            const pending = await readPendingPopupBlockEntries(now);
            const next = pending.filter((entry) => entry.domain !== normalized);
            next.push({
                domain: normalized,
                requestedAt: now,
            });
            await writePendingPopupBlockEntries(next);
            return next;
        });
    }

    async function cancelPendingPopupBlockDomain(domain, now = Date.now()) {
        const normalized = normalizeDomain(domain);
        if (!normalized) return [];

        return enqueuePendingPopupBlockMutation(async () => {
            const pending = await readPendingPopupBlockEntries(now);
            const next = pending.filter((entry) => entry.domain !== normalized);
            await writePendingPopupBlockEntries(next);
            return next;
        });
    }

    async function processPendingPopupBlockDomains(reason = 'manual') {
        if (popupBlockProcessPromise) return popupBlockProcessPromise;

        popupBlockProcessPromise = enqueuePendingPopupBlockMutation(async () => {
            const now = Date.now();
            const pending = await readPendingPopupBlockEntries(now);
            if (!pending.length) {
                await writePendingPopupBlockEntries([]);
                return {
                    reason,
                    processedDomains: [],
                    pendingDomains: [],
                    blockedChanged: false,
                    siteGoalsChanged: false,
                };
            }

            const granted = requirePermissionSnapshot(await getGrantedPermissions());
            const { permissions, origins } = granted;
            const hasScripting = permissions.includes('scripting');

            const readyEntries = hasScripting
                ? pending
                    .filter((entry) => hasOriginPermissionForDomain(origins, entry.domain))
                : [];
            const readyDomains = readyEntries.map((entry) => entry.domain);
            const readySet = new Set(readyDomains);

            let blockedChanged = false;
            let siteGoalsChanged = false;
            for (const { domain } of readyEntries) {
                const result = requireSiteRuleMutationResult(
                    await upsertPendingPopupBlockedSite({ domain }),
                );
                blockedChanged = blockedChanged || result.changedKeys.includes('blockedUrls');
                siteGoalsChanged = siteGoalsChanged || result.changedKeys.includes('siteGoals');
            }

            const nextPending = pending.filter((entry) => !readySet.has(entry.domain));
            await writePendingPopupBlockEntries(nextPending);

            return {
                reason,
                processedDomains: readyDomains,
                pendingDomains: nextPending.map((entry) => entry.domain),
                blockedChanged,
                siteGoalsChanged,
            };
        }).finally(() => {
            popupBlockProcessPromise = null;
        });

        return popupBlockProcessPromise;
    }

    async function handlePermissionAdded() {
        let pendingProcessError = null;
        try {
            await processPendingPopupBlockDomains('permissions_added');
        } catch (error) {
            pendingProcessError = error;
        }

        await syncManagedContentScripts({
            injectOpenTabs: true,
            reason: 'permissions_added',
        });
        if (typeof broadcastSettingsUpdate === 'function') {
            await broadcastSettingsUpdate();
        }
        if (pendingProcessError) throw pendingProcessError;
    }

    async function handlePermissionRemoved() {
        await syncManagedContentScripts({
            injectOpenTabs: false,
            reason: 'permissions_removed',
        });
        if (typeof broadcastSettingsUpdate === 'function') {
            await broadcastSettingsUpdate();
        }
    }

    return {
        shouldCaptureFaviconForPage,
        queuePendingPopupBlockDomain,
        cancelPendingPopupBlockDomain,
        processPendingPopupBlockDomains,
        handlePermissionAdded,
        handlePermissionRemoved,
    };
}
