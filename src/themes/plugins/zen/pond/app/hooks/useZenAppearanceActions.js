import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useZenAppearanceStore } from '../../state/stores/useZenAppearanceStore.js';
import { resolveZenKoiRosterSnapshotDomains } from '../../roster/zenKoiRosterContract.js';

const normalizeDomain = (value) => {
    if (typeof value !== 'string') return '';
    return value.trim();
};

const buildDomainSet = (rosterSnapshot) => {
    const domainSet = new Set();
    resolveZenKoiRosterSnapshotDomains(rosterSnapshot).forEach((domain) => {
        const normalized = normalizeDomain(domain);
        if (normalized) domainSet.add(normalized);
    });
    return domainSet;
};

const useZenAppearanceActions = ({
    t,
    lockedTarget,
    hoveredDomain,
    rosterSnapshot,
    onRerollScene,
}) => {
    const {
        rerollWithinBreed,
        rerollBreed,
        rerollFull,
        domainAppearanceMap,
    } = useZenAppearanceStore(useShallow((state) => ({
        rerollWithinBreed: state.rerollWithinBreed,
        rerollBreed: state.rerollBreed,
        rerollFull: state.rerollFull,
        domainAppearanceMap: state.domainAppearanceMap || {},
    })));
    const activeDomainForReroll = lockedTarget || hoveredDomain || null;
    const domainBadgeText = activeDomainForReroll ? t('tools:koi_tuner.domain_badge', {
        domain: activeDomainForReroll,
    }) : '';
    const domainSelectPromptText = t('tools:koi_tuner.select_url_prompt', {});
    const rerollWithinLabel = t('tools:koi_tuner.reroll_within_breed', {});
    const rerollBreedLabel = t('tools:koi_tuner.reroll_breed', {});
    const rerollAllColorLabel = t('tools:koi_tuner.reroll_all_color', {});
    const rerollAllBreedLabel = t('tools:koi_tuner.reroll_all_breed', {});
    const rerollSceneLabel = t('tools:koi_tuner.reroll_scene', {});
    const applyDomainAppearanceToFish = useCallback(() => {
        // Worker-only runtime: fish appearance ownership lives in worker.
    }, []);
    const handleRerollWithinBreed = useCallback(() => {
        if (!activeDomainForReroll) return;
        const paletteIndex = Number(domainAppearanceMap?.[activeDomainForReroll]?.paletteIndex);
        rerollWithinBreed(activeDomainForReroll, {
            paletteIndex: Number.isFinite(paletteIndex) ? paletteIndex : null,
        });
    }, [activeDomainForReroll, domainAppearanceMap, rerollWithinBreed]);
    const handleRerollBreed = useCallback(() => {
        if (!activeDomainForReroll) return;
        const paletteIndex = Number(domainAppearanceMap?.[activeDomainForReroll]?.paletteIndex);
        rerollBreed(activeDomainForReroll, {
            currentPaletteIndex: Number.isFinite(paletteIndex) ? paletteIndex : null,
        });
    }, [activeDomainForReroll, domainAppearanceMap, rerollBreed]);
    const handleRerollAllColor = useCallback(() => {
        const domainSet = buildDomainSet(rosterSnapshot);
        domainSet.forEach((domain) => {
            const paletteIndex = Number(domainAppearanceMap?.[domain]?.paletteIndex);
            rerollWithinBreed(domain, {
                paletteIndex: Number.isFinite(paletteIndex) ? paletteIndex : null,
            });
        });
    }, [rosterSnapshot, domainAppearanceMap, rerollWithinBreed]);
    const handleRerollAllBreed = useCallback(() => {
        const domainSet = buildDomainSet(rosterSnapshot);
        domainSet.forEach((domain) => {
            const paletteIndex = Number(domainAppearanceMap?.[domain]?.paletteIndex);
            rerollFull(domain, {
                currentPaletteIndex: Number.isFinite(paletteIndex) ? paletteIndex : null,
                resetBreedMatch: true,
            });
        });
    }, [rosterSnapshot, domainAppearanceMap, rerollFull]);
    const handleRerollScene = useMemo(() => (
        typeof onRerollScene === 'function' ? onRerollScene : () => {}
    ), [onRerollScene]);

    return {
        activeDomainForReroll,
        domainBadgeText,
        domainSelectPromptText,
        rerollWithinLabel,
        rerollBreedLabel,
        rerollAllColorLabel,
        rerollAllBreedLabel,
        rerollSceneLabel,
        applyDomainAppearanceToFish,
        handleRerollWithinBreed,
        handleRerollBreed,
        handleRerollAllColor,
        handleRerollAllBreed,
        handleRerollScene,
    };
};

export { useZenAppearanceActions };
