import { useMemo } from 'react';
import { requireSitesGlobalExposureAverage } from '@/domains/stats/contracts/sitesGlobalExposureAverageContract.js';
import { requireSitesRecordingPolicy } from '@/domains/stats/contracts/sitesRecordingContracts.js';

const EMPTY_SITE_DETAILS = Object.freeze({});
const EMPTY_SITE_INTELS = Object.freeze({});
const EMPTY_SITE_REGISTRY = Object.freeze({
    entries: Object.freeze([]),
    byDomain: EMPTY_SITE_DETAILS,
});
function resolveGlobalExposureAverage(sitesSnapshot) {
    if (sitesSnapshot == null) return null;
    return requireSitesGlobalExposureAverage(sitesSnapshot.globalExposureAverage);
}

export function useSitesSnapshotViewModel({
    sitesSnapshot,
}) {
    const scoreSetupDrafts = useMemo(() => {
        const recommendations = sitesSnapshot?.scoreSetup?.recommendations;
        return recommendations && typeof recommendations === 'object' ? recommendations : null;
    }, [sitesSnapshot?.scoreSetup?.recommendations]);
    const siteDetails = useMemo(() => {
        const next = sitesSnapshot?.siteDetails;
        return next && typeof next === 'object' ? next : EMPTY_SITE_DETAILS;
    }, [sitesSnapshot?.siteDetails]);
    const observedSiteDetails = useMemo(() => {
        const next = sitesSnapshot?.observedSiteDetails;
        return next && typeof next === 'object' ? next : EMPTY_SITE_DETAILS;
    }, [sitesSnapshot?.observedSiteDetails]);
    const siteRegistry = useMemo(() => {
        const next = sitesSnapshot?.siteRegistry;
        if (!next || typeof next !== 'object' || !Array.isArray(next.entries)) {
            return EMPTY_SITE_REGISTRY;
        }
        return next;
    }, [sitesSnapshot?.siteRegistry]);
    const siteIntels = useMemo(() => {
        const next = sitesSnapshot?.siteIntels;
        return next && typeof next === 'object' ? next : EMPTY_SITE_INTELS;
    }, [sitesSnapshot?.siteIntels]);
    const totalExposure = Number(sitesSnapshot?.totalExposure) || 0;
    const globalExposureAverage = resolveGlobalExposureAverage(sitesSnapshot);

    const trackedTargets = useMemo(() => {
        return siteRegistry.entries
            .filter((entry) => entry?.type === 'tracked' && typeof entry?.domain === 'string')
            .map((entry) => entry.domain);
    }, [siteRegistry.entries]);

    return {
        trackedTargets,
        siteDetails,
        observedSiteDetails,
        siteRegistry,
        siteIntels,
        scoreSetupDrafts,
        totalExposure,
        globalExposureAverage,
        recording: sitesSnapshot == null ? null : requireSitesRecordingPolicy(sitesSnapshot.recording),
    };
}
